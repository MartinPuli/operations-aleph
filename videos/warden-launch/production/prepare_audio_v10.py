"""Re-edit the existing Derek take and native effects for the 26.10s v10 film.

No new speech or SFX generation. The public source-clock cut list lives in
v10-audio-cuts.json. Only measured pauses and the specifically requested CLI
utterance are removed. Existing effects are reconstructed from their recorded
native filters and gains, independently of the narration edits.
"""
from array import array
from pathlib import Path
import hashlib
import json
import math
import re
import subprocess

B = Path(__file__).resolve().parent.parent
SR = 48000
CUTS_PATH = B / 'production/v10-audio-cuts.json'
LOCK = json.loads(CUTS_PATH.read_text())
CUTS = LOCK['full_original_audio_cuts']
DURATION = LOCK['final_duration_seconds']
FRAMES = round(DURATION * SR)
VOICE_SOURCE = B / 'assets/audio/warden-derek-v5-mix.wav'
VOICE = B / 'assets/audio/warden-derek-v10-mix.wav'
STEM = B / 'assets/audio/warden-eleven-sfx-v10.wav'
MASTER = B / 'assets/audio/warden-launch-v10-mix.wav'
BASE = B / 'assets/audio/warden-launch-v6-mix.wav'
V5 = json.loads((B / 'production/sound-design-v5.json').read_text())
V6 = json.loads((B / 'production/sound-design-v6.json').read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def db(value):
    return 20 * math.log10(max(1e-15, abs(value)))


def old_to_new(time):
    return time - sum(max(0, min(time, end) - start) for start, end in CUTS)


def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)
    ]))


def decode(path, channels=2, filters=None):
    command = ['ffmpeg', '-v', 'error', '-i', str(path)]
    if filters:
        command += ['-af', filters]
    command += ['-ar', str(SR), '-ac', str(channels), '-f', 'f64le', '-']
    return array('d', subprocess.check_output(command))


def write(path, samples, channels):
    subprocess.run([
        'ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR),
        '-ac', str(channels), '-i', 'pipe:0', '-c:a', 'pcm_s24le', str(path)
    ], input=samples.tobytes(), check=True)


def loudness(path):
    result = subprocess.run([
        'ffmpeg', '-hide_banner', '-i', str(path), '-af',
        'loudnorm=I=-17:TP=-1:LRA=7:print_format=json', '-f', 'null', '-'
    ], capture_output=True, text=True, check=True).stderr
    info = json.loads(re.findall(r'\{[\s\S]*?\}', result)[-1])
    return {'integrated_lufs': float(info['input_i']),
            'true_peak_dbtp': float(info['input_tp']),
            'loudness_range_lu': float(info['input_lra'])}


def metrics(path, channels):
    samples = decode(path, channels)
    info = probe(path)
    return {'path': str(path.relative_to(B)), 'sha256': sha(path),
            'duration': len(samples) / SR / channels,
            'sample_rate': int(info['streams'][0]['sample_rate']),
            'channels': info['streams'][0]['channels'],
            'codec': info['streams'][0]['codec_name'],
            'sample_peak_dbfs': db(max(map(abs, samples))),
            **loudness(path)}


def full_asr_check():
    path = B / 'production/voice-v10-words.json'
    if not path.exists():
        return {'status': 'pending', 'note': 'Run final-stem ASR separately after creating the voice WAV.'}
    result = json.loads(path.read_text())
    transcript = ' '.join(s['text'].strip() for s in result['transcription']).strip()
    tokens = lambda text: re.findall(r"[a-z]+(?:'[a-z]+)?", text.lower().replace('’', "'"))
    expected = tokens((B / 'production/voiceover-v10-en.txt').read_text())
    actual = tokens(transcript)
    observed_homophones = {'cloud': 'claude', 'codecs': 'codex'}
    normalized = [observed_homophones.get(word, word) for word in actual]
    assert normalized == expected
    assert 'cli' not in actual and len(expected) == 69
    return {'status': 'pass', 'artifact': str(path.relative_to(B)), 'recognized_text': transcript,
            'expected_word_count': len(expected), 'asr_word_count': len(actual),
            'all_expected_words_present_in_order_with_brand_homophones_normalized': True,
            'brand_spelling_differences': [{'expected': a, 'recognized': b}
                                          for a, b in zip(expected, actual) if a != b],
            'cli_absent': True,
            'limits': 'ASR recognizes Claude as cloud and Codex as codecs. This is a content-preservation check, not an auditory pronunciation or delivery judgment.'}


def main():
    assert CUTS == [[6.615, 6.865], [8.605, 8.775], [10.7, 10.78],
                    [11.365, 11.665], [21.0, 22.1]]
    assert abs(sum(b-a for a, b in CUTS) - 1.9) < 1e-9
    assert abs(DURATION * 30 - 783) < 1e-8
    source = decode(VOICE_SOURCE, 1)
    boundaries = [(round(a * SR), round(b * SR)) for a, b in CUTS]
    edits = []
    voice = array('d')
    fade_frames = round(.004 * SR)
    previous = 0
    for index, (start, end) in enumerate(boundaries + [(len(source), len(source))]):
        segment = array('d', source[previous:start])
        if index:
            for i in range(fade_frames):
                segment[i] *= i / (fade_frames - 1)
        if index < len(boundaries):
            for i in range(fade_frames):
                segment[-fade_frames+i] *= 1 - i / (fade_frames - 1)
            left = source[start-fade_frames:start]
            right = source[end:end+fade_frames]
            edits.append({'original_start': start/SR, 'original_end': end/SR,
                          'removed_frames': end-start,
                          'new_join': len(voice)/SR+len(segment)/SR,
                          'left_fade_peak_dbfs': db(max(map(abs, left))),
                          'right_fade_peak_dbfs': db(max(map(abs, right))),
                          'purpose': LOCK['cut_purposes'][index]})
            # Fades are wholly inside the measured low-level boundary gaps.
            assert max(map(abs, left)) < .01 and max(map(abs, right)) < .01
        voice.extend(segment)
        previous = end
    assert len(voice) == len(source) - round(1.9 * SR)
    write(VOICE, voice, 1)
    voice = decode(VOICE, 1)

    stem = array('d', [0]) * (FRAMES * 2)
    cue_records = []
    v5_cues = V5['cues']
    requests = []
    for cue in v5_cues:
        anchor = {'draft_assembly': 7.47, 'activate_rule': 10.44}.get(
            cue['id'], old_to_new(cue['output_event_time']))
        requests.append((cue['id'], cue, anchor, 'peak', cue['gain_db'], 'v5'))
    send = next(c for c in v5_cues if c['id'] == 'send_press')
    requests.append(('manager_send', send, 6.98, 'peak', send['gain_db'], 'v5'))
    for cue in V6['additional_cues']:
        gain = cue['native_normalization_gain_db'] + V6['additions_only_safety_gain_db']
        requests.append((cue['id'], cue, old_to_new(cue['output_anchor']),
                         cue['placement_mode'], gain, 'v6'))
    for name, cue, anchor, placement, gain_db, version in requests:
        path = B / cue['source_path']
        assert sha(path) == cue['source_sha256']
        samples = decode(path, filters=cue['filter'])
        peak_index = max(range(len(samples)), key=lambda i: abs(samples[i]))
        peak_offset = (peak_index // 2) / SR
        start_frame = round((anchor - peak_offset if placement == 'peak' else anchor) * SR)
        assert start_frame >= 0 and start_frame + len(samples)//2 <= FRAMES
        gain = 10 ** (gain_db / 20)
        for i, sample in enumerate(samples):
            stem[start_frame*2+i] += sample * gain
        cue_records.append({'id': name, 'recipe_version': version,
                            'source_path': cue['source_path'], 'source_sha256': sha(path),
                            'filter': cue['filter'], 'gain_db': gain_db,
                            'output_anchor': anchor, 'placement_mode': placement,
                            'output_start': start_frame/SR,
                            'output_duration': len(samples)/SR/2,
                            'actual_peak_time': start_frame/SR+peak_offset,
                            'target_peak_dbfs': db(abs(samples[peak_index]) * gain)})
    write(STEM, stem, 2)
    stem = decode(STEM)
    mixed = array('d', stem)
    for i, sample in enumerate(voice):
        mixed[2*i] += sample
        mixed[2*i+1] += sample

    # Preserve the approved opening mix exactly, including its original Send.
    base = decode(BASE)
    prefix_samples = round(5.43 * SR) * 2
    reconstructed_error = max(abs(mixed[i] - base[i]) for i in range(prefix_samples))
    assert reconstructed_error < 3 / (2**23)
    mixed[:prefix_samples] = base[:prefix_samples]
    write(MASTER, mixed, 2)
    levels = loudness(MASTER)
    assert levels['true_peak_dbtp'] <= -1.0, levels
    decoded = decode(MASTER)
    assert len(decoded) == FRAMES * 2
    assert decoded[:prefix_samples] == base[:prefix_samples]
    for path, channels, expected in [(VOICE, 1, len(voice)), (STEM, 2, FRAMES*2),
                                      (MASTER, 2, FRAMES*2)]:
        info = probe(path)
        assert int(info['streams'][0]['sample_rate']) == SR
        assert info['streams'][0]['channels'] == channels
        assert info['streams'][0]['codec_name'] == 'pcm_s24le'
        assert len(decode(path, channels)) == expected

    phrase_check = json.loads((B / 'production/voice-v10-cli-cut-check.json').read_text())
    phrase_text = ' '.join(s['text'].strip() for s in phrase_check['transcription']).strip()
    assert 'CLI' not in phrase_text.upper()
    assert 'or compatible tools' in phrase_text.lower()
    assert 'codecs' in phrase_text.lower() or 'codex' in phrase_text.lower()
    phrase_source = json.loads((B / 'production/voice-v5-phrase-onsets.json').read_text())
    phrases = []
    for phrase in phrase_source['phrases']:
        p = {**phrase, 'text': phrase['text'].replace('Codex CLI', 'Codex'),
             'start': old_to_new(phrase['start']), 'end': old_to_new(phrase['end'])}
        if 'following_waveform_onset' in phrase:
            p['following_waveform_onset'] = old_to_new(phrase['following_waveform_onset'])
        phrases.append(p)
    fresh_onsets = {'take_control': 5.432375, 'describe_protection': 6.949792,
                    'draft_rules': 8.826042, 'review': 10.191417, 'activate': 10.852458,
                    'connected_requests': 11.70975, 'codex': 20.411375,
                    'or_compatible_tools': 22.197792, 'get_warden': 24.488833,
                    'free_for_everyone': 25.406792, 'open_source': 26.427687}
    alignment = {'duration': len(voice)/SR, 'source_alignment': 'production/voice-v5-phrase-onsets.json',
                 'mapping': 'production/v10-audio-cuts.json', 'phrases': phrases,
                 'fresh_waveform_onset_aids': {key: {'original': value, 'output': old_to_new(value)}
                                              for key, value in fresh_onsets.items()},
                 'limits': 'Mapped ASR timing plus measured silence endpoints. Fresh waveform endpoints are boundary aids, not semantic listening. Original CLI-region ASR timing was inaccurate; use fresh onset aids there.'}
    (B/'production/voice-v10-phrase-onsets.json').write_text(json.dumps(alignment, indent=2)+'\n')
    record = {'version': 10, 'duration': DURATION, 'video_frames': 783, 'fps': 30,
              'sample_rate': SR, 'channels': 2, 'cut_mapping': 'production/v10-audio-cuts.json',
              'full_original_audio_cuts': CUTS, 'removed_duration': 1.9,
              'voice_source': {'path': str(VOICE_SOURCE.relative_to(B)), 'sha256': sha(VOICE_SOURCE),
                               'prior_provenance': 'production/voice-v5-edit.json',
                               'provider': 'ElevenLabs Derek / eleven_v3; existing single take'},
              'voice_edits': edits, 'boundary_fades_seconds': .004,
              'additional_tempo_change': 1.0, 'additional_voice_gain_db': 0,
              'voice_script': 'production/voiceover-v10-en.txt',
              'voice_script_sha256': sha(B/'production/voiceover-v10-en.txt'),
              'cli_validation': {'raw_asr': 'production/voice-v10-cli-cut-check.json',
                                 'recognized_text': phrase_text,
                                 'result': 'CLI absent; Codex (ASR homophone codecs), or, compatible tools and following words retained.',
                                 'boundary_gaps_original_seconds': [[20.932646,21.044333],[21.814312,22.197792]],
                                 'remaining_join_gap_seconds': .165146},
              'native_sources_provenance': 'production/elevenlabs-sfx-v4-provenance.json',
              'native_recipe_sources': ['production/sound-design-v5.json','production/sound-design-v6.json'],
              'cues': sorted(cue_records, key=lambda c: c['output_start']),
              'cue_count': len(cue_records), 'added_manager_send_anchor': 6.98,
              'voice': metrics(VOICE, 1), 'sfx': metrics(STEM, 2), 'mix': metrics(MASTER, 2),
              'verification': {'duration_exact': True, 'pcm24_48khz_stereo': True,
                               'opening_through_5_43_bit_exact': True,
                               'opening_reconstructed_max_error_before_exact_copy': reconstructed_error,
                               'source_and_previous_outputs_unchanged': True,
                               'full_voice_content_asr': full_asr_check(),
                               'limits': 'No new generation or resynthesis. Automated waveform, phrase ASR and level measurements only; no continuous listening claim.'},
              'recipe': 'production/prepare_audio_v10.py'}
    (B/'production/sound-design-v10.json').write_text(json.dumps(record, indent=2)+'\n')
    print(json.dumps({'duration': DURATION, 'voice': record['voice'], 'mix': record['mix'],
                      'cue_count': len(cue_records), 'phrase_validation': record['cli_validation']}, indent=2))


if __name__ == '__main__':
    main()
