#!/usr/bin/env python3
"""Original 32-second Warden commercial score. No samples or external music.

Deterministic additive synthesis using Python + numpy; FFmpeg masters the WAV.
120 BPM, 64 beats, 48 kHz stereo. See notes.md for editorial cues/provenance.
"""
from pathlib import Path
import json
import subprocess
import wave
import numpy as np

SR = 48000
DURATION = 32.0
N = int(SR * DURATION)
RNG = np.random.default_rng(814306)
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "audio"
OUT.mkdir(parents=True, exist_ok=True)
WORK = Path(__file__).resolve().parent
tracks = {name: np.zeros((N, 2), dtype=np.float64) for name in ["drums", "bass", "harmony", "lead", "fx", "reverb"]}
duck = np.ones(N)


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def clock(length):
    return np.arange(round(length * SR), dtype=np.float64) / SR


def smooth(x):
    return np.sin(np.clip(x, 0, 1) * np.pi / 2) ** 2


def add(track, signal, start, amp=1, pan=0, send=0):
    offset = round(start * SR)
    if offset >= N:
        return
    stop = min(N, offset + len(signal))
    signal = signal[:stop - offset] * amp
    if signal.ndim == 1:
        angle = (pan + 1) * np.pi / 4
        signal = signal[:, None] * np.array([np.cos(angle), np.sin(angle)])
    tracks[track][offset:stop] += signal
    tracks["reverb"][offset:stop] += signal * send


def noise(length, highpass=1000, lowpass=9000):
    count = round(length * SR)
    raw = RNG.standard_normal(count)
    freqs = np.fft.rfftfreq(count, 1 / SR)
    filt = (1 - np.exp(-(freqs / highpass) ** 4)) * np.exp(-(freqs / lowpass) ** 4)
    result = np.fft.irfft(np.fft.rfft(raw) * filt, n=count)
    return result / max(np.std(result), 1e-8)


def chord(notes, length, bright=.8, attack=.14):
    t = clock(length)
    out = np.zeros((len(t), 2))
    envelope = smooth(t / attack) * smooth((length - t) / .90)
    for i, note in enumerate(notes):
        f = hz(note)
        phase = RNG.uniform(0, 2*np.pi)
        for channel, cents in [(0, -5-i*.2), (1, 4.8+i*.25)]:
            signal = np.zeros(len(t))
            detune = 2 ** (cents/1200)
            for harmonic in range(1, 10):
                cutoff = np.exp(-(harmonic*f/(1400*bright))**2)
                signal += np.sin(2*np.pi*f*harmonic*detune*t+phase) * cutoff / harmonic ** 1.32
            signal += .16*np.sin(2*np.pi*f*1.001*t+phase*.6)
            signal *= 1 + .035*np.sin(2*np.pi*(.23+i*.011)*t+phase)
            out[:, channel] += signal * envelope / len(notes)
    return out


def key(note, length=.95, decay=.17):
    t = clock(length)
    f = hz(note)
    env = smooth(t/.004) * np.exp(-t/decay) * smooth((length-t)/.09)
    signal = np.sin(2*np.pi*f*t + .65*np.sin(2*np.pi*f*2*t)*np.exp(-t/.07))
    signal += .18*np.sin(2*np.pi*f*2*t)*np.exp(-t/.13)
    signal += .06*np.sin(2*np.pi*f*3.003*t)*np.exp(-t/.11)
    return signal * env


def sub(note, length=.40, bite=.55):
    t = clock(length)
    f = hz(note)
    phase = 2*np.pi*f*t
    signal = np.sin(phase)
    for harmonic in range(2, 8):
        signal += (bite / harmonic**1.6) * np.sin(harmonic*phase) * np.exp(-t*harmonic/1.0)
    env = smooth(t/.007) * np.exp(-t/1.2) * smooth((length-t)/.075)
    return np.tanh(signal*1.15)/1.15 * env


def kick():
    t = clock(.36)
    freq = 46+115*np.exp(-t/.014)
    phase = np.cumsum(freq)/SR*2*np.pi
    body = np.sin(phase)*np.exp(-t/.085)
    tick = noise(.36,1800,4100)*np.exp(-t/.006)*.065
    return (body+tick) * smooth(t/.0015)*smooth((.36-t)/.05)


def snare():
    t = clock(.21)
    body = np.sin(2*np.pi*178*t)*np.exp(-t/.027)*.38
    air = noise(.21,1200,7400) * (np.exp(-t/.034)+.30*np.exp(-np.maximum(t-.013,0)/.022)*(t>=.013))
    return (body+.30*air)*smooth(t/.001)*smooth((.21-t)/.045)


def hat(opened=False):
    length=.24 if opened else .10
    t=clock(length)
    return noise(length,4600,9700)*smooth(t/.001)*np.exp(-t/(.049 if opened else .018))*smooth((length-t)/.02)


def click(tone=720, length=.15):
    t=clock(length)
    signal=np.zeros(len(t))
    for multiple,amp,decay in [(1,.65,.019),(1.43,.30,.026),(2.09,.22,.015),(2.83,.10,.011)]:
        signal += amp*np.sin(2*np.pi*tone*multiple*t)*np.exp(-t/decay)
    return signal*smooth(t/.001)*smooth((length-t)/.025)


def impact(length=1.5, metal=.15):
    t=clock(length)
    f=42+70*np.exp(-t/.04)
    low=np.sin(np.cumsum(f)/SR*2*np.pi)*np.exp(-t/.19)
    upper=(np.sin(2*np.pi*146*t)+.45*np.sin(2*np.pi*223*t))*.15*np.exp(-t/.11)
    air=noise(length,1300,6700)*np.exp(-t/.11)*metal
    return (low+upper+air)*smooth(t/.002)*smooth((length-t)/.2)


def sweep(length, rise=True, strength=1):
    t=clock(length)
    progress=t/length
    swell=smooth(progress)**1.6 if rise else np.exp(-t/.22)
    # A low noise whoosh, not a sine siren. End is softened to avoid a click.
    signal=noise(length,550,5700)*swell*smooth(t/.02)*smooth((length-t)/.02)
    return signal*strength


# Tonal arc: tense but inviting D minor, then a clear major-color lift at 20 s.
sections=[
    (0,4,[50,57,60,64,69],38),
    (4,8,[53,57,60,62,65],34),
    (8,10,[53,58,62,65,69],31),
    (10.3,14,[50,57,60,64,69],38),
    (14,16,[53,57,60,64,67],41),
    (16,18,[52,55,60,62,67],36),
    (18,20,[53,57,58,62,69],31),
    (20,22,[54,57,61,64,69],38),
    (22,24,[55,59,62,66,69],31),
    (24,26,[57,59,61,64,69],33),
    (26,29,[54,57,62,64,69],38),
    (29,32,[50,57,62,64,66,69],38),
]


def current(t):
    return next((s for s in reversed(sections) if t>=s[0]),sections[0])


for start,end,notes,root in sections:
    duration=min(DURATION-start,end-start+.70)
    add("harmony",chord(notes,duration,1.08 if start>=20 else .80,attack=.05 if start==0 else .17),start,.245,send=.25)

# Four-on-floor foundation with syncopated omissions and ghost kicks.
for count,beat in enumerate(np.arange(0,29,.5)):
    if 9.5<=beat<10.5 or 25.5<=beat<26:
        continue
    energy=.91 if beat<8 else (.68 if 10<=beat<14 else 1)
    if beat>=26:
        energy=.76
    if count%8 not in [3,7] or (14<=beat<20 and count%4==3):
        add("drums",kick(),beat,.41*energy)
        st=round(beat*SR);dt=clock(.3)
        end=min(N,st+len(dt))
        duck[st:end] *= (1-.26*np.exp(-dt[:end-st]/.07))
    if count%8==6 and 4<=beat<25:
        add("drums",kick(),beat+.375,.145)
    if count%2==1:
        add("drums",snare(),beat+.003,.135*energy,pan=.02,send=.06)

# Dry swung hats, sparse ghost sixteenths, alternating metallic details.
for i,when in enumerate(np.arange(0.25,28.75,.25)):
    if 9.5<=when<10.5 or 25.4<=when<26:
        continue
    energy=.76 if 10<=when<14 else 1
    level=(.038 if i%2==0 else .020)*RNG.uniform(.8,1.08)*energy
    add("drums",hat(i%8==6),when+(0.012 if i%2 else 0),level,pan=(-.32 if i%2 else .28))
    if 14<=when<26 and i%4==2:
        add("drums",hat(),when+.132,.012,pan=-.46)
    if i%8 in [1,4] and (when<8 or 14<=when<26):
        add("drums",click(620 if i%8==1 else 870),when+.06,.061,pan=(-.48 if i%8==1 else .48),send=.08)

# Bass phrase changes articulation every bar; upper harmonics remain audible on phones.
for bar in np.arange(0,28,2):
    for index,(off,length,amp) in enumerate([(0,.39,.24),(.75,.22,.16),(1,.38,.205),(1.625,.24,.14)]):
        when=bar+off
        if 9.4<=when<10.5 or 25.4<=when<26 or when>=28:
            continue
        root=current(when)[3]
        note=root+12 if index==3 and bar%4 else root
        add("bass",sub(note,length,.72 if when>=14 else .57),when+.013,amp*(.75 if 10<=when<14 else 1))

# Main original motif is rhythmically active, with different voicings and replies.
motif=[(0.00,1,0),(.375,3,0),(.75,4,0),(1.25,2,12),(1.75,3,0),(2.25,1,0),(2.625,4,0),(3.25,2,0),(3.75,3,12)]
for phrase in [0,4,10.5,14,18,22]:
    for index,(off,tone,octave) in enumerate(motif):
        when=phrase+off
        if when>=26 or 9.45<=when<10.5:
            continue
        notes=current(when)[2]
        note=notes[min(tone,len(notes)-1)]+octave
        level=.092 if when<8 else (.055 if when<14 else .092)
        add("lead",key(note,1.10,.165),when+.009,level,pan=(-.26 if index%2 else .26),send=.65)

# Dense chord stabs build energy without another repeating melodic loop.
for when in [1.875,3.5,5.875,7.5,14.75,15.5,16.75,17.5,18.5,19.25,20.75,21.5,22.75,23.5,24.5,25.0]:
    notes=current(when)[2][1:]
    for i,note in enumerate(notes):
        add("lead",key(note,.72,.13),when,.032,pan=(i-1.5)*.18,send=.45)

# Scene accents are original sound design, built from the same tonal material.
for when,amp in [(0,.31),(4,.30),(8,.31),(14,.29),(20,.25),(26,.28)]:
    add("fx",impact(1.45,.13),when,amp,send=.12)
    add("fx",click(510 if when<20 else 710,.22),when+.013,.11,pan=.12,send=.3)
for target,length,level in [(4,.65,.040),(8,.70,.043),(10,.38,.030),(14,.8,.042),(20,1.1,.043),(26,.9,.044)]:
    add("fx",sweep(length),target-length,level,pan=-.12,send=.08)
    notes=current(max(0,target-.1))[2]
    reverse=key(notes[3]+12,length,.23)[::-1].copy()
    reverse *= smooth(clock(length)/.04)*smooth((length-clock(length))/.014)
    add("fx",reverse,target-length,.078,pan=.2,send=.25)

# The contained block hit: a short, centered knock that cuts to near-silence.
add("fx",impact(.45,.055),10,.36)
add("fx",click(410,.085),10,.15)

# Three-route cue: distinct stereo ticks resolve into one shared harmonic pulse.
for when,pan,note in [(14,-.58,65),(14.125,0,69),(14.25,.58,72)]:
    add("fx",click(hz(note)*2,.13),when,.064,pan=pan,send=.13)

# Bright local-world cue at 20 seconds, a small bell chord with no harsh top end.
for index,note in enumerate([69,73,76]):
    add("lead",key(note,2,.38),20+index*.125,.065,pan=(index-1)*.24,send=.70)

# Logo motif, then one confident final chord at 29 s and a three-second tail.
for when,note,level in [(26,62,.12),(26.25,69,.09),(26.5,74,.10),(27.0,78,.065),(28.25,76,.047)]:
    add("lead",key(note,2.8,.35),when,level,pan=(note-69)*.03,send=.9)
add("drums",kick(),29,.31)
add("bass",sub(38,1.60,.40),29,.19)
for i,note in enumerate([62,66,69,74,76]):
    add("lead",key(note,3,.54),29+i*.007,.050,pan=(i-2)*.11,send=.8)

# Tempo-related stereo delays plus a diffuse late field, with all tails retained.
wet=tracks["reverb"]
ambience=np.zeros_like(wet)
for delay,gain,swapped in [(.1875,.22,True),(.375,.18,True),(.563,.13,False),(.753,.11,True),(1.123,.075,False),(1.497,.05,True),(1.879,.035,False),(2.239,.023,True)]:
    shift=round(delay*SR)
    ambience[shift:] += (wet[:-shift,::-1] if swapped else wet[:-shift])*gain
mix=tracks["drums"]+tracks["bass"]+tracks["fx"]
mix += tracks["harmony"]*duck[:,None]+tracks["lead"]*(.55+.45*duck[:,None])+ambience

# Authored editorial breath: impact at 10, 0.20-second near-silence, then restart.
t=np.arange(N)/SR
breath=np.ones(N)
fall=(t>=10.075)&(t<10.105)
breath[fall]=1-.995*smooth((t[fall]-10.075)/.03)
breath[(t>=10.105)&(t<10.305)]=.005
rise=(t>=10.305)&(t<10.39)
breath[rise]=.005+.995*smooth((t[rise]-10.305)/.085)
mix *= breath[:,None]
mix=np.tanh(mix*1.18)/1.18
mix *= (smooth(t/.009)*smooth((DURATION-t)/.85))[:,None]
mix *= .89/max(np.max(np.abs(mix)),1e-9)

raw=WORK/"commercial-premaster.wav"
with wave.open(str(raw),"wb") as wav:
    wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(SR)
    wav.writeframes(np.round(np.clip(mix,-1,1)*32767).astype('<i2').tobytes())


def measure(path):
    p=subprocess.run(["ffmpeg","-hide_banner","-i",str(path),"-af","loudnorm=I=-15:TP=-1.2:LRA=8:print_format=json","-f","null","-"],capture_output=True,text=True,check=True)
    return json.loads(p.stderr[p.stderr.rfind('{'):p.stderr.rfind('}')+1])


stats=measure(raw)
normalizer=(f"loudnorm=I=-15:TP=-1.2:LRA=8:measured_I={stats['input_i']}:"
            f"measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}:"
            f"measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}:linear=true")
final=OUT/"warden-commercial-score.wav"
subprocess.run(["ffmpeg","-y","-hide_banner","-loglevel","error","-i",str(raw),"-af",normalizer,"-ar",str(SR),"-c:a","pcm_s24le","-t","32",str(final)],check=True)
subprocess.run(["ffmpeg","-y","-hide_banner","-loglevel","error","-i",str(final),"-c:a","libmp3lame","-b:a","256k",str(OUT/"warden-commercial-score.mp3")],check=True)
verified=measure(final)
metadata={
    "title":"Warden — original commercial score",
    "duration_seconds":32,"bpm":120,"beats":64,"sample_rate":48000,"channels":2,
    "provenance":"Original deterministic synthesis. No third-party recordings, samples, music, model-generated audio or externally licensed motifs used. Source retained alongside this metadata.",
    "mastering":"FFmpeg two-pass EBU R128 normalization; target -15 LUFS integrated, ceiling -1.2 dBTP, 48 kHz 24-bit stereo WAV, plus 256 kb/s MP3.",
    "verified_wav":{"integrated_lufs":float(verified["input_i"]),"true_peak_dbtp":float(verified["input_tp"]),"loudness_range_lu":float(verified["input_lra"])},
    "cue_times_seconds":[0,4,8,10,14,20,26,29,32],
    "near_silence_window_seconds":[10.105,10.305],
    "seed":814306,
}
(WORK/"measurements.json").write_text(json.dumps(metadata,indent=2)+"\n")
raw.unlink()
print(json.dumps({"wav":str(final),"mp3":str(OUT/"warden-commercial-score.mp3"),"measurement":metadata["verified_wav"]},indent=2))
