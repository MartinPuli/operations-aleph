"""Preserve the single Derek take, accelerate at fixed pitch, and align its words.

ASR and silence boundaries are editing aids, not listening or pronunciation QA.
No synthesis, interior cuts, or artificial speech is performed here.
"""
from array import array
from pathlib import Path
import hashlib, json, math, re, subprocess

B=Path(__file__).resolve().parent.parent
SOURCE=B/'assets/audio/warden-derek-v5.mp3'
PACED=B/'assets/audio/warden-derek-v5-paced.wav'
MIX=B/'assets/audio/warden-derek-v5-mix.wav'
SCRIPT=B/'production/voiceover-v5-en.txt'
WORDS=B/'production/voice-v5-words.json'
SR,TEMPO,START,END=48000,1.10,0.0,30.0
DURATION=(END-START)/TEMPO

def run(args):return subprocess.run(args,capture_output=True,text=True,check=True)
def probe(path):return json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]).stdout)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def pathstr(path):return str(path.relative_to(B))
def output_time(t):return round((t-START)/TEMPO,6)
def measure(path,stereo=False):
    af=('pan=stereo|c0=c0|c1=c0,' if stereo else '')+'loudnorm=I=-20.5:TP=-3:LRA=7:print_format=json'
    result=run(['ffmpeg','-hide_banner','-i',str(path),'-af',af,'-f','null','-']).stderr
    info=json.loads(re.findall(r'\{[\s\S]*?\}',result)[-1])
    return {'integrated_lufs':float(info['input_i']),'true_peak_dbtp':float(info['input_tp']),'loudness_range_lu':float(info['input_lra'])}

raw_probe=probe(SOURCE)
assert float(raw_probe['format']['duration'])==END
silence=run(['ffmpeg','-hide_banner','-i',str(SOURCE),'-af','silencedetect=noise=-48dB:d=0.05','-f','null','-']).stderr
intervals=[];start=None
for row in silence.splitlines():
    m=re.search(r'silence_start: ([0-9.]+)',row)
    if m:start=float(m.group(1))
    m=re.search(r'silence_end: ([0-9.]+)',row)
    if m and start is not None:intervals.append([start,float(m.group(1))]);start=None
samples=array('f',subprocess.check_output(['ffmpeg','-v','error','-i',str(SOURCE),'-ar',str(SR),'-ac','1','-f','f32le','-']))
def peak(a,b):return round(20*math.log10(max(max(abs(x) for x in samples[round(a*SR):round(b*SR)]),1e-12)),3)
edge_peaks={'first_40ms_dbfs':peak(0,.04),'last_40ms_dbfs':peak(29.96,30)}

pace_filter=f'atempo={TEMPO:.8f},apad=whole_dur={DURATION:.12f},atrim=duration={DURATION:.12f}'
run(['ffmpeg','-v','error','-y','-i',str(SOURCE),'-af',pace_filter,'-t',f'{DURATION:.12f}','-ar',str(SR),'-ac','1','-c:a','pcm_s24le',str(PACED)])
pace_levels=measure(PACED)
# A constant gain keeps the performance untouched. The true-peak ceiling wins
# over the loudness target by only 0.15 dB, leaving a 0.05 dB measurement margin.
gain_db=min(-20.5-pace_levels['integrated_lufs'],-3.05-pace_levels['true_peak_dbtp'])
normalizer=f'volume={gain_db:.8f}dB,apad=whole_dur={DURATION:.12f},atrim=duration={DURATION:.12f}'
run(['ffmpeg','-v','error','-y','-i',str(PACED),'-af',normalizer,'-t',f'{DURATION:.12f}','-ar',str(SR),'-ac','1','-c:a','pcm_s24le',str(MIX)])
pace_probe,mix_probe=probe(PACED),probe(MIX)
for info in [pace_probe,mix_probe]:
    assert abs(float(info['format']['duration'])-DURATION)<2/SR
    assert int(info['streams'][0]['sample_rate'])==SR and info['streams'][0]['channels']==1
mix_levels,stereo_levels=measure(MIX),measure(MIX,True)
assert mix_levels['true_peak_dbtp']<=-3 and -20.8<=mix_levels['integrated_lufs']<=-20.3

raw=json.loads(WORDS.read_text())
entries=[w for w in raw['transcription'] if w['text'].strip()]
script_words=re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)?",SCRIPT.read_text())
assert len(entries)==len(script_words)==70
norm=lambda s:re.sub(r'[^a-z]','',s.lower())
words=[];mismatches=[]
for i,(entry,intended) in enumerate(zip(entries,script_words)):
    observed=entry['text'].strip();a=entry['offsets']['from']/1000;b=entry['offsets']['to']/1000
    assert START<=a<=b<=END
    if norm(observed)!=norm(intended):mismatches.append({'index':i,'script':intended,'asr':observed})
    words.append({'index':i,'script':intended,'asr':observed,'raw_start':a,'raw_end':b,'start':output_time(a),'end':output_time(b)})
assert not mismatches
ranges=[('hook',0,3),('client_bank_details',4,7),('sent_outside',8,11),('data_leak',12,15),('take_control',16,19),('describe_protection',20,26),('draft_rules',27,30),('review',31,31),('activate',32,32),('connected_requests',33,41),('block_private_data',42,44),('review_sensitive_requests',45,47),('public_work',48,51),('connect_claude_code',52,54),('codex_cli',55,56),('compatible_tools',57,59),('across_teams',60,62),('get_warden',63,64),('free_for_everyone',65,67),('open_source',68,69)]
# These are directly measured following-silence endpoints near the ASR start.
# A word may start before its aligned interval; retain both estimates explicitly.
onsets={'take_control':5.9722,'describe_protection':7.639955,'draft_rules':9.703129,'review':11.212381,'activate':11.930612,'connected_requests':12.886621,'block_private_data':15.993333,'review_sensitive_requests':17.371791,'public_work':19.22195,'connect_claude_code':20.902971,'codex_cli':22.442948,'get_warden':26.935601,'free_for_everyone':27.922812,'open_source':29.072313}
phrases=[]
for name,first,last in ranges:
    ws=words[first:last+1]
    row={'id':name,'text':' '.join(w['script'] for w in ws),'first_word_index':first,'last_word_index':last,'raw_start':ws[0]['raw_start'],'raw_end':ws[-1]['raw_end'],'start':ws[0]['start'],'end':ws[-1]['end']}
    if name in onsets:
        row.update({'following_waveform_onset_raw':onsets[name],'following_waveform_onset':output_time(onsets[name]),'onset_note':'Measured silence endpoint near automatic phrase start; boundary aid, not a listened-to semantic onset.'})
    phrases.append(row)
limitations='Automatic Whisper recognition and mapped timing, not continuous listening, emotional-delivery or pronunciation approval. Pitch-preserving atempo is nominally linear; small local timing differences remain possible.'
alignment={'source':pathstr(SOURCE),'output':pathstr(PACED),'alignment_source':pathstr(WORDS),'transform':{'raw_start':START,'raw_end':END,'tempo':TEMPO,'formula':'raw_seconds / 1.10'},'duration':float(pace_probe['format']['duration']),'word_count':70,'asr_differences':mismatches,'limitations':limitations,'phrases':phrases,'words':words}
(B/'production/voice-v5-paced-words.json').write_text(json.dumps(alignment,indent=2)+'\n')
(B/'production/voice-v5-phrase-onsets.json').write_text(json.dumps({'duration':float(mix_probe['format']['duration']),'basis':'Whisper ASR with separate measured waveform onset aids','limitations':limitations,'phrases':phrases},indent=2)+'\n')
edit={'source':pathstr(SOURCE),'source_sha256':sha(SOURCE),'source_probe_duration':END,'source_sample_rate':44100,'source_channels':1,'trim_start':START,'trim_end':END,'trim_note':'No trim: the leading pause is already about 90 ms and the last 40 ms peaks at -28.94 dBFS. Preserve the whole source instead of dropping unreviewed tail signal.','edge_sample_peaks':edge_peaks,'source_silence_intervals':intervals,'tempo':TEMPO,'pitch_preserving':True,'interior_cuts':[],'theoretical_duration':DURATION,'actual_duration':float(pace_probe['format']['duration']),'output':pathstr(PACED),'output_sha256':sha(PACED),'output_sample_rate':SR,'output_channels':1,'output_codec':'pcm_s24le','filter':pace_filter,'paced_levels':pace_levels,'normalized_output':pathstr(MIX),'normalized_sha256':sha(MIX),'normalized_duration':float(mix_probe['format']['duration']),'normalization':{'method':'Measured EBU R128 constant gain, no compressor or limiter','gain_db':gain_db,'filter':normalizer,'mono':mix_levels,'duplicated_unity_stereo':stereo_levels,'true_peak_ceiling_dbtp':-3},'raw_to_output':{'formula':'raw_seconds / 1.10','valid_raw_interval':[START,END]},'content_check':{'script_sha256':sha(SCRIPT),'script_word_count':70,'asr_word_count':70,'substantive_differences':mismatches,'all_word_intervals_retained':True,'note':'Punctuation and capitalization ignored; all words match in order, including Warden, Claude Code and Codex CLI. This does not establish pronunciation by listening.'},'phrases':phrases,'limits':limitations}
(B/'production/voice-v5-edit.json').write_text(json.dumps(edit,indent=2)+'\n')
prov=B/'production/elevenlabs-v5-mcp.json';p=json.loads(prov.read_text())
p.update({'status':'Generated take retrieved through authenticated browser UI by root; local asset probed and processed','local_audio_path':pathstr(SOURCE),'local_audio_sha256':sha(SOURCE),'local_audio_probe_duration':END,'retrieval_method':'Root downloaded the existing MCP generation through its visible ElevenLabs Flow canvas; no regeneration.','voice_edit':'production/voice-v5-edit.json','paced_audio_path':pathstr(PACED),'mix_audio_path':pathstr(MIX)})
p['notes']=[n.replace('No OAuth tokens or browser profiles were read. No browser interaction occurred.','MCP discovery and generation read no OAuth tokens or browser profiles. Root later retrieved this existing take through the authenticated visible UI.') for n in p.get('notes',[]) if not n.startswith('Do not generate again')]+['Root resolved the MCP Flows-read restriction by downloading this same take in the authenticated UI. The prior retrieval_block remains historical evidence.']
prov.write_text(json.dumps(p,indent=2)+'\n')
print(json.dumps({'duration':edit['actual_duration'],'mix_duration':edit['normalized_duration'],'mono':mix_levels,'duplicated_stereo':stereo_levels,'word_count':70,'phrases':phrases},indent=2))
