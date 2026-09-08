#!/usr/bin/env python3
"""Build the 17-second v12 dialogue, rhythmic bed and native-contact mix.

Uses the local, unchanged v11 PCM/measurement helpers. All v12 timing, segment
editing, dynamic speech-band carve, outputs and provenance are defined here.
No generation, network, automatic retiming or source overwrite. Voice segments
must cover the complete selected source contiguously; their output gaps are
explicit. The 3ms paired edge fades occur in measured sentence silences, not
in words. They do not overlap across the deliberately inserted pauses.

python scripts/build-v12-mix.py --config production/v12-sound-plan.json
"""
from array import array
from pathlib import Path
import argparse
import importlib.util
import json
import math
import tempfile
import sys

spec = importlib.util.spec_from_file_location('warden_v11_audio_helpers', Path(__file__).with_name('build-v11-mix.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
SR = b.SR


def silence_stats(samples, seconds, width=.006):
    first = max(0, round((seconds - width / 2) * SR)) * 2
    last = min(len(samples), round((seconds + width / 2) * SR) * 2)
    clip = samples[first:last]
    return {'rms_dbfs': b.db(math.sqrt(sum(x*x for x in clip) / max(1, len(clip)))),
            'peak_dbfs': b.db(max((abs(x) for x in clip), default=0))}


def validate_segments(segments, source_duration, duration):
    prior_source = 0.0
    prior_end = 0.0
    for segment in segments:
        a, z = segment['source']
        a = b.number(a, 'segment source start', 0, source_duration)
        z = b.number(z, 'segment source end', a + 1 / SR, source_duration + 1 / SR)
        t = b.number(segment['output_start'], 'segment output start', 0, duration)
        if abs(a - prior_source) > 1 / SR:
            raise ValueError('Voice segments must preserve every source sample once, in order')
        if t < prior_end - 1 / SR or t + z - a > duration + 1 / SR:
            raise ValueError('Voice segments overlap or exceed the film')
        prior_source, prior_end = z, t + z - a
    if abs(prior_source - source_duration) > 1 / SR:
        raise ValueError('Voice segments must include the full source tail')


def speech_depth(voice, hop=480, lookahead=.025, attack=.020, release=.140):
    # Use this take's own active RMS distribution. No comparison with another
    # narrator and no processing of the voice itself.
    rms = []
    for frame in range(0, len(voice)//2, hop):
        chunk = voice[frame*2:min(len(voice), (frame+hop)*2)]
        rms.append(b.db(math.sqrt(sum(x*x for x in chunk) / max(1, len(chunk)))))
    active = sorted(x for x in rms if x > -55)
    if not active:
        raise ValueError('No measurable speech for score carve')
    reference = active[round((len(active)-1)*.60)]
    floor, full = reference - 22, reference - 3
    ahead = math.ceil(lookahead * SR / hop)
    levels = [max(rms[i:min(len(rms), i+ahead+1)]) for i in range(len(rms))]
    smoothed, state = [], 0.0
    for level in levels:
        desired = max(0, min(1, (level-floor)/(full-floor)))
        tau = attack if desired > state else release
        coefficient = math.exp(-hop/SR/tau)
        state = desired + coefficient*(state-desired)
        smoothed.append(state)
    return smoothed, {'reference_rms_dbfs': reference, 'floor_dbfs': floor, 'full_dbfs': full,
                      'hop_seconds': hop/SR, 'lookahead_seconds': lookahead,
                      'attack_seconds': attack, 'release_seconds': release}


def linear_lane(t, points):
    if t <= points[0][0]:
        return points[0][1]
    for a, z in zip(points, points[1:]):
        if t <= z[0]:
            return a[1] + (z[1]-a[1]) * (t-a[0]) / (z[0]-a[0])
    return points[-1][1]


def dynamic_carve(score, voice, temp, settings):
    b.wav(temp/'bed-before-carve.wav', score, 'pcm_f64le')
    low, mid, high = [temp/f'carve-{name}.wav' for name in ['low', 'mid', 'high']]
    crossover = settings.get('speech_band_hz', [350, 4200])
    b.run('ffmpeg', '-v', 'error', '-y', '-i', temp/'bed-before-carve.wav', '-filter_complex',
          f'acrossover=split={crossover[0]} {crossover[1]}:order=4th[lo][mi][hi]',
          '-map', '[lo]', '-c:a', 'pcm_f64le', low,
          '-map', '[mi]', '-c:a', 'pcm_f64le', mid,
          '-map', '[hi]', '-c:a', 'pcm_f64le', high)
    lo, mi, hi = [b.decode(path) for path in [low, mid, high]]
    if any(len(x) != len(score) for x in [lo, mi, hi]):
        raise ValueError('Speech-band split changed the bed duration')
    depth, record = speech_depth(voice)
    broad_db = b.number(settings.get('broadband_duck_db', -2.5), 'broadband duck', -12, 0)
    mid_db = b.number(settings.get('additional_mid_duck_db', -4.5), 'speech band duck', -12, 0)
    lane = settings.get('gain_lane_db', [[0, 0], [17, 0]])
    result = array('d', [0]) * len(score)
    frames = len(score)//2
    for frame in range(frames):
        point = frame/480
        index = min(len(depth)-1, int(point))
        value = depth[index] + (depth[min(index+1, len(depth)-1)]-depth[index]) * (point-index)
        broad = 10**((broad_db*value + linear_lane(frame/SR, lane))/20)
        middle = 10**(mid_db*value/20)
        for channel in (0,1):
            i=frame*2+channel
            result[i] = (lo[i]+hi[i]+mi[i]*middle)*broad
    record.update(speech_band_hz=crossover, broadband_duck_db=broad_db,
                  additional_mid_duck_db=mid_db, gain_lane_db=lane,
                  source='Edited clean dialogue envelope; only the bed is carved')
    return result, record


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--config', required=True)
    parser.add_argument('--project', default=str(Path(__file__).resolve().parent.parent))
    args = parser.parse_args()
    root = Path(args.project).resolve()
    config_path = b.path_at(root,args.config)
    cfg = json.loads(config_path.read_text())
    if cfg.get('version') != 12 or cfg.get('timings_locked') is not True:
        raise ValueError('Only a locked v12 timing plan may be mixed')
    duration = b.number(cfg['duration'], 'duration', .1, 180)
    fps = b.number(cfg['fps'], 'fps', 1, 120)
    if abs(duration*fps-round(duration*fps)) > 1e-6:
        raise ValueError('Duration is not on the video frame grid')
    outputs = {name:b.path_at(root,path) for name,path in cfg['outputs'].items()}
    if len(set(outputs.values())) != len(outputs):
        raise ValueError('Output paths must be distinct')
    for path in outputs.values():
        if 'v12' not in path.name or path.exists():
            raise ValueError('Use new v12 output paths; existing files are protected')
    voice_path = b.path_at(root,cfg['voice']['path'])
    inputs = {voice_path} | {b.path_at(root,s['path']) for s in cfg['sources'].values()} | {b.path_at(root,cfg['score']['path'])}
    if inputs & set(outputs.values()):
        raise ValueError('An output would replace an input')
    if cfg['voice'].get('tempo',1) != 1:
        raise ValueError('This approved mix preserves original speed. Re-align an explicit derived source before any retime.')
    original = b.decode(voice_path, unity_mono=True)
    if b.digest(voice_path) != cfg['voice']['sha256']:
        raise ValueError('Selected voice hash changed')
    source_duration = len(original)/2/SR
    validate_segments(cfg['voice']['segments'], source_duration, duration)
    samples = round(duration*SR)*2
    voice, sfx, bed = [array('d',[0])*samples for _ in range(3)]
    report = {'version':12,'duration':duration,'video_frames':round(duration*fps),'fps':fps,
              'sample_rate':SR,'channels':2,'config':str(config_path),'config_sha256':b.digest(config_path),
              'limits':'Analytical source/timing/level verification. No listening or final encoded-video approval is implied.'}
    with tempfile.TemporaryDirectory(prefix='warden-v12-mix-') as directory:
        temp=Path(directory)
        # One gain across the complete take, before inserting the planned gaps.
        normalized, norm=b.normalize(original,cfg['voice']['target_lufs'],cfg['voice']['ceiling_dbtp'],temp/'voice-raw.wav')
        records=[]
        for item in cfg['voice']['segments']:
            a,z=item['source']; stats={}
            for edge,t in [('start',a),('end',z)]:
                if 0<t<source_duration:
                    stats[edge]=silence_stats(original,t)
                    if stats[edge]['rms_dbfs'] > -55:
                        raise ValueError(f'Voice edge {t:.3f} is not a measured quiet boundary')
            clip=array('d',normalized[round(a*SR)*2:round(z*SR)*2])
            b.fades(clip,.003,.003)
            b.place(voice,clip,item['output_start'],duration,item['id'])
            records.append(dict(item,output_end=item['output_start']+len(clip)/2/SR,
                                edge_fade_seconds=.003,edge_measurements=stats))
        report['voice']={'path':str(voice_path),'sha256':b.digest(voice_path),'source_duration':source_duration,
                         'tempo_changed':False,'pitch_changed':False,'all_source_samples_preserved_once':True,
                         'normalization':norm,'segments':records,'final_end':records[-1]['output_end']}
        phrases=b.phrases_from(cfg,duration)
        processed=[b.effect(item,cfg['sources'],root,phrases,duration) for item in cfg['events']]
        if len({record['id'] for _,_,record in processed}) != len(processed):
            raise ValueError('Duplicate contact event ids')
        for clip,start,record in processed:
            b.place(sfx,clip,start,duration,record['id'])
        report['events']=[r for _,_,r in processed]
        music=cfg['score']; path=b.path_at(root,music['path'])
        if b.digest(path) != music['sha256']:
            raise ValueError('Music source hash changed')
        music_duration=float(b.probe(path)['format']['duration'])
        segments=[]
        for index,item in enumerate(music['segments']):
            a,z=item['source']
            if not 0 <= a < z <= music_duration:
                raise ValueError('Music excerpt outside its source')
            chain=f'atrim=start={a}:end={z},asetpts=PTS-STARTPTS'
            clip=b.decode(path,chain)
            if abs(len(clip)/2/SR-(z-a)) > 1/SR:
                raise ValueError('Music excerpt has unexpected decoded duration')
            b.fades(clip,item.get('fade_in',.04),item.get('fade_out',.04))
            clip=b.scale(clip,item.get('gain_db',0))
            b.place(bed,clip,item['output_start'],duration,f'music segment {index}')
            segments.append(dict(item,effective_filter=chain))
        b.wav(temp/'bed-stitched.wav',bed,'pcm_f64le')
        bed=b.decode(temp/'bed-stitched.wav',music['filters'])
        bed,bed_norm=b.normalize(bed,music['target_lufs'],-12,temp/'bed-level.wav')
        bed,carve=dynamic_carve(bed,voice,temp,music['carve'])
        report['score']={'path':str(path),'sha256':b.digest(path),'provenance':music['provenance'],
                         'segments':segments,'filters':music['filters'],'normalization':bed_norm,'carve':carve}
        total=array('d',(v+s+m for v,s,m in zip(voice,sfx,bed)))
        total,master_norm=b.normalize(total,cfg['master']['target_lufs'],cfg['master']['ceiling_dbtp'],temp/'premix.wav')
        gain=master_norm['constant_gain_db']
        candidates={}
        for name,signal in [('mix',total),('dialogue',b.scale(voice,gain)),('sfx',b.scale(sfx,gain)),('bed',b.scale(bed,gain))]:
            candidate=temp/f'{name}.wav'; b.wav(candidate,signal)
            meta=b.probe(candidate)
            if abs(float(meta['format']['duration'])-duration)>1/SR:
                raise ValueError('Output length differs from the film')
            candidates[name]=candidate
        measured=b.levels(candidates['mix'])
        if measured['true_peak_dbtp']>cfg['master']['ceiling_dbtp']+.05:
            raise ValueError('Final measured true peak exceeds ceiling')
        report['master']={'path':str(outputs['mix']),'sha256':b.digest(candidates['mix']),
                          'normalization':master_norm,'measured':measured,'codec':'pcm_s24le'}
        report['stems']={name:{'path':str(outputs[name]),'sha256':b.digest(path),
                              'level':b.levels(path)} for name,path in candidates.items() if name!='mix'}
        # Inspect mono fold-down independently; the render still uses stereo.
        b.run('ffmpeg','-v','error','-y','-i',candidates['mix'],'-af','pan=mono|c0=.5*c0+.5*c1','-c:a','pcm_s24le',temp/'mono.wav')
        report['mono_fold_down']=b.levels(temp/'mono.wav')
        for name,path in candidates.items():
            outputs[name].parent.mkdir(parents=True,exist_ok=True)
            with outputs[name].open('xb') as f:f.write(path.read_bytes())
        outputs['report'].parent.mkdir(parents=True,exist_ok=True)
        with outputs['report'].open('x') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps({'status':'created','master':report['master'],'voice_end':report['voice']['final_end'],
                      'native_contacts':len(processed),'report':str(outputs['report'])},indent=2))

if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,OSError) as error:
        print(f'V12 mix not built: {error}',file=sys.stderr);sys.exit(1)
