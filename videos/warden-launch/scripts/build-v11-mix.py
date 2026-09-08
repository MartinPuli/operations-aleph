#!/usr/bin/env python3
"""Build a new v11 voice/score/SFX mix from explicit output-clock JSON.

No synthesis, automatic narration retiming, network access, or source mutation.
Requires Python 3.9+ and FFmpeg/ffprobe. All paths in the config are relative to
--project (default: this script's parent project). Existing outputs are refused.

Inspect filtered native effects and exact peak placements without voice/output:
  python scripts/build-v11-mix.py --config production/v11-sound-plan.json --inspect
Build after final voice and event/phrase timing are selected:
  python scripts/build-v11-mix.py --config production/v11-sound-plan.json \
    --voice assets/audio/CHOSEN-VOICE.wav

An event's `at` is seconds or {"phrase":"id","edge":"start|end","offset":0}.
Phrase times refer to the final film, not a source clock. `voice.start` places
speech; optional trim_start/trim_end are explicit edits, never inferred. Mono
speech duplicates at unity before loudness measurement. No voice EQ/compression
or pace change is applied by default. Optional score receives phrase-driven
attenuation; voice never receives a duck or carve. SFX align processed peaks.
"""
from array import array
from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
import tempfile

SR = 48000


def run(*args, data=None):
    p = subprocess.run([str(a) for a in args], input=data, capture_output=True)
    if p.returncode:
        raise ValueError(f'{args[0]} failed: {p.stderr.decode(errors="replace")[-2000:]}')
    return p.stdout


def number(value, name, low=None, high=None):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
        raise ValueError(f'{name} must be a finite number')
    if low is not None and value < low or high is not None and value > high:
        raise ValueError(f'{name} must be between {low} and {high}')
    return float(value)


def db(value):
    return 20 * math.log10(max(1e-15, abs(value)))


def scale(samples, gain_db):
    gain = 10 ** (gain_db / 20)
    return array('d', (x * gain for x in samples))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def path_at(project, value):
    if not isinstance(value, str) or not value:
        raise ValueError('A local source/output path is required')
    p = Path(value)
    return (p if p.is_absolute() else project / p).resolve()


def probe(path):
    return json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path))


def decode(path, filters='', unity_mono=False):
    chain = [filters] if filters else []
    channels = probe(path)['streams'][0].get('channels')
    if unity_mono and channels == 1:
        chain.append('pan=stereo|c0=c0|c1=c0')
    command = ['ffmpeg', '-v', 'error', '-i', path]
    if chain:
        command += ['-af', ','.join(chain)]
    raw = run(*command, '-ar', SR, '-ac', 2, '-f', 'f64le', '-')
    samples = array('d', raw)
    if sys.byteorder != 'little':
        samples.byteswap()
    if not samples or len(samples) % 2 or not all(math.isfinite(x) for x in samples):
        raise ValueError(f'Invalid or empty decoded audio: {path}')
    return samples


def wav(path, samples, codec='pcm_s24le'):
    copy = array('d', samples)
    if sys.byteorder != 'little':
        copy.byteswap()
    run('ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', SR, '-ac', 2,
        '-i', 'pipe:0', '-c:a', codec, path, data=copy.tobytes())


def levels(path):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af',
                        'loudnorm=I=-16.5:TP=-1.2:LRA=7:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    if p.returncode:
        raise ValueError(f'Loudness measurement failed: {p.stderr[-1200:]}')
    found = re.findall(r'\{[\s\S]*?\}', p.stderr)
    if not found:
        raise ValueError('No loudness result')
    result = json.loads(found[-1])
    values = {'integrated_lufs': float(result['input_i']), 'true_peak_dbtp': float(result['input_tp']),
              'lra_lu': float(result['input_lra'])}
    if not all(math.isfinite(x) for x in values.values()):
        raise ValueError('Audio needs finite non-silent loudness to normalize')
    return values


def normalize(samples, target, ceiling, scratch):
    wav(scratch, samples, 'pcm_f64le')
    measured = levels(scratch)
    gain = min(target - measured['integrated_lufs'], ceiling - measured['true_peak_dbtp'])
    return scale(samples, gain), {'before': measured, 'constant_gain_db': gain,
                                 'target_lufs': target, 'ceiling_dbtp': ceiling,
                                 'peak_limited': gain < target - measured['integrated_lufs'] - .001}


def phrases_from(config, duration):
    items = config.get('phrases', [])
    if isinstance(items, dict):
        items = [dict(v, id=k) for k, v in items.items()]
    phrases = {}
    for p in items:
        key = p['id']
        if key in phrases:
            raise ValueError(f'Duplicate phrase: {key}')
        a = number(p['start'], f'{key} start', 0, duration)
        b = number(p['end'], f'{key} end', a, duration)
        phrases[key] = (a, b)
    return phrases


def anchor(value, phrases):
    if isinstance(value, dict):
        edge = value.get('edge', 'start')
        if edge not in ('start', 'end') or value.get('phrase') not in phrases:
            raise ValueError('Event anchor needs a known phrase and start/end edge')
        return phrases[value['phrase']][0 if edge == 'start' else 1] + number(value.get('offset', 0), 'anchor offset')
    return number(value, 'event at')


def place(destination, clip, start, duration, name):
    frame = round(start * SR)
    if frame < 0 or frame + len(clip) // 2 > round(duration * SR):
        raise ValueError(f'{name} does not fit the film; audio is never silently truncated')
    offset = frame * 2
    for i, sample in enumerate(clip):
        destination[offset + i] += sample


def fades(samples, fade_in, fade_out):
    frames = len(samples) // 2
    for count, ending in [(min(frames, round(fade_in * SR)), False),
                          (min(frames, round(fade_out * SR)), True)]:
        for i in range(count):
            value = i / max(1, count - 1)
            gain = math.sin(value * math.pi / 2) ** 2
            j = (frames - 1 - i if ending else i) * 2
            samples[j] *= gain
            samples[j + 1] *= gain
    return samples


def duck_score(samples, start, phrases, amount, attack, release):
    # A finite gain envelope on the score only. Use union/max for overlap so
    # multiple nearby phrases never multiply attenuation or create pumping.
    hop = 480
    for frame in range(0, len(samples) // 2, hop):
        t = start + frame / SR
        depth = 0.0
        for a, b in phrases.values():
            if a <= t <= b:
                depth = 1.0
                break
            if a - attack < t < a:
                depth = max(depth, (t - a + attack) / attack)
            elif b < t < b + release:
                depth = max(depth, 1 - (t - b) / release)
        gain = 10 ** (amount * depth / 20)
        # 10 ms linear interpolation keeps the automated gain continuous.
        next_t = t + hop / SR
        next_depth = max([max(0, min(1, (next_t - a + attack) / attack,
                                      (b + release - next_t) / release))
                          for a, b in phrases.values()] or [0])
        next_gain = 10 ** (amount * next_depth / 20)
        count = min(hop, len(samples) // 2 - frame)
        for j in range(count):
            g = gain + (next_gain - gain) * j / hop
            samples[2 * (frame + j)] *= g
            samples[2 * (frame + j) + 1] *= g


def effect(event, sources, project, phrases, duration):
    source = sources[event['source']]
    path = path_at(project, source['path'])
    sha = digest(path)
    if source.get('sha256') and sha != source['sha256']:
        raise ValueError(f'Source hash differs: {path.name}')
    a, b = event['trim']
    a = number(a, 'trim start', 0)
    b = number(b, 'trim end', a + 1 / SR)
    source_duration = float(probe(path)['format']['duration'])
    if b > source_duration + 1 / SR:
        raise ValueError(f'Trim exceeds source: {event["id"]}')
    filters = f'atrim=start={a}:end={b},asetpts=PTS-STARTPTS'
    if event.get('filters'):
        filters += ',' + event['filters']
    samples = decode(path, filters)
    fades(samples, number(event.get('fade_in', .004), 'effect fade in', 0),
          number(event.get('fade_out', .02), 'effect fade out', 0))
    peak_index = max(range(len(samples)), key=lambda i: abs(samples[i]))
    peak = abs(samples[peak_index])
    if peak < 1e-8:
        raise ValueError(f'Silent effect: {event["id"]}')
    gain = number(event.get('peak_dbfs', -20), 'effect peak', -60, -3) - db(peak)
    samples = scale(samples, gain)
    peak_offset = peak_index // 2 / SR
    target = anchor(event['at'], phrases)
    mode = event.get('align', 'peak')
    if mode not in ('peak', 'start'):
        raise ValueError('align must be peak or start')
    start = round((target - peak_offset if mode == 'peak' else target) * SR) / SR
    if start < 0 or start + len(samples) / 2 / SR > duration:
        raise ValueError(f'Event falls outside film: {event["id"]}')
    record = dict(event, source_path=str(path), source_sha256=sha, effective_filter=filters,
                  gain_db=gain, output_start=start, duration=len(samples) / 2 / SR,
                  processed_peak_offset=peak_offset, actual_peak_time=start + peak_offset)
    return samples, start, record


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--config', required=True)
    parser.add_argument('--project', default=str(Path(__file__).resolve().parent.parent))
    parser.add_argument('--voice', help='Chosen clean speech source, overrides config.voice.path')
    parser.add_argument('--output', help='New v11 WAV path, overrides config.output')
    parser.add_argument('--inspect', action='store_true', help='Validate/process SFX only; no asset/report output')
    args = parser.parse_args()
    project = Path(args.project).resolve()
    config_path = path_at(project, args.config)
    config = json.loads(config_path.read_text())
    duration = number(config['duration'], 'duration', .1, 180)
    fps = number(config.get('fps', 30), 'fps', 1, 120)
    if abs(duration * fps - round(duration * fps)) > 1e-6:
        raise ValueError('Film duration must be on its frame grid')
    phrases = phrases_from(config, duration)
    processed = [effect(e, config['sources'], project, phrases, duration) for e in config.get('events', [])]
    if len({r['id'] for _, _, r in processed}) != len(processed):
        raise ValueError('Duplicate event IDs')
    if args.inspect:
        print(json.dumps({'status': 'inspected_only', 'duration': duration,
                          'events': [r for _, _, r in processed],
                          'voice_selected': bool(args.voice or config.get('voice', {}).get('path'))}, indent=2))
        return
    voice_settings = config['voice']
    voice_path = path_at(project, args.voice or voice_settings.get('path'))
    output = path_at(project, args.output or config['output'])
    report_path = path_at(project, config['report'])
    if not re.search(r'(?:^|[-_])v11(?:[-_.]|$)', output.name) or not re.search(r'(?:^|[-_])v11(?:[-_.]|$)', report_path.name):
        raise ValueError('Output and report names must contain v11; historical files are protected')
    if output.exists() or report_path.exists():
        raise FileExistsError('Output/report exists. Choose a new v11 filename; no prior delivery is overwritten.')
    source_paths = {path_at(project, x['path']) for x in config['sources'].values()} | {voice_path}
    if config.get('score') and config['score'].get('path'):
        source_paths.add(path_at(project, config['score']['path']))
    if output in source_paths or report_path in source_paths:
        raise ValueError('Output must not replace an input')
    voice_start = number(voice_settings.get('start', 0), 'voice start', 0, duration)
    voice_trim = number(voice_settings.get('trim_start', 0), 'voice trim start', 0)
    voice_filter = f'atrim=start={voice_trim}'
    if voice_settings.get('trim_end') is not None:
        voice_filter += ':end=' + str(number(voice_settings['trim_end'], 'voice trim end', voice_trim))
    voice_filter += ',asetpts=PTS-STARTPTS'
    voice = decode(voice_path, voice_filter, unity_mono=True)
    total = array('d', [0]) * (round(duration * SR) * 2)
    record = {'version': 11, 'duration': duration, 'fps': fps, 'video_frames': round(duration * fps),
              'sample_rate': SR, 'channels': 2, 'config': str(config_path), 'config_sha256': digest(config_path),
              'phrases': config.get('phrases', []), 'events': [r for _, _, r in processed],
              'limits': 'Analytical timing/level validation only. No voice-generation, recognition or listening approval is implied.'}
    with tempfile.TemporaryDirectory(prefix='warden-v11-mix-') as tmp:
        temp = Path(tmp)
        voice, voice_norm = normalize(voice, number(voice_settings.get('target_lufs', -17.5), 'voice LUFS', -40, -10),
                                      number(voice_settings.get('ceiling_dbtp', -3), 'voice ceiling', -12, -1), temp / 'voice.wav')
        place(total, voice, voice_start, duration, 'Full selected voice')
        record['voice'] = {'path': str(voice_path), 'sha256': digest(voice_path), 'filter': voice_filter,
                           'output_start': voice_start, 'duration': len(voice) / 2 / SR,
                           'pitch_and_tempo_changed': False, 'normalization': voice_norm}
        score = config.get('score')
        if score and score.get('enabled', True):
            score_path = path_at(project, score['path'])
            start = number(score.get('start', 0), 'score start', 0, duration)
            length = number(score.get('duration', duration - start), 'score duration', .1, duration - start)
            trim = number(score.get('trim_start', 0), 'score trim start', 0)
            filters = f'atrim=start={trim}:end={trim+length},asetpts=PTS-STARTPTS'
            if score.get('filters'):
                filters += ',' + score['filters']
            bed = decode(score_path, filters)
            bed, norm = normalize(bed, number(score.get('target_lufs', -30), 'score LUFS', -50, -18), -9, temp / 'score.wav')
            fades(bed, number(score.get('fade_in', .2), 'score fade in', 0),
                  number(score.get('fade_out', .5), 'score fade out', 0))
            duck_score(bed, start, phrases, number(score.get('duck_db', -5), 'score duck', -18, 0),
                       number(score.get('attack', .06), 'duck attack', .01, 1),
                       number(score.get('release', .18), 'duck release', .01, 2))
            place(total, bed, start, duration, 'Score')
            record['score'] = dict(score, source_sha256=digest(score_path), normalization=norm,
                                   effective_filter=filters, actual_duration=len(bed) / 2 / SR)
        for samples, start, event in processed:
            place(total, samples, start, duration, event['id'])
        master = config.get('master', {})
        ceiling = number(master.get('ceiling_dbtp', -1.2), 'master ceiling', -6, -.5)
        total, norm = normalize(total, number(master.get('target_lufs', -16.5), 'master LUFS', -24, -12), ceiling, temp / 'premix.wav')
        candidate = temp / 'master.wav'
        wav(candidate, total)
        measured = levels(candidate)
        if measured['true_peak_dbtp'] > ceiling + .05:
            raise ValueError('Final measured true peak exceeds the configured ceiling')
        final_probe = probe(candidate)
        if abs(float(final_probe['format']['duration']) - duration) > 1 / SR:
            raise ValueError('Final WAV duration differs from the film')
        record['master'] = {'path': str(output), 'sha256': digest(candidate), 'codec': 'pcm_s24le',
                            'duration': duration, 'sample_rate': SR, 'channels': 2,
                            'normalization': norm, 'measured': measured}
        output.parent.mkdir(parents=True, exist_ok=True)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with output.open('xb') as dest:
            dest.write(candidate.read_bytes())
        with report_path.open('x') as dest:
            json.dump(record, dest, indent=2)
            dest.write('\n')
    print(json.dumps({'status': 'created', 'master': record['master'], 'events': len(processed), 'report': str(report_path)}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        print(f'Mix not built: {error}', file=sys.stderr)
        sys.exit(1)
