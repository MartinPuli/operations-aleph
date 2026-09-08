# Warden commercial score

Original 32-second instrumental and sound-design bed, composed specifically for the new Warden commercial. Tempo: 120 BPM; 64 beats / 16 bars. No narration. This is a separate musical composition from the earlier 36-second launch score.

Master: [warden-commercial-score.wav](/Users/martinezequielpulitano/warden/videos/warden-launch/assets/audio/warden-commercial-score.wav). Preview: [warden-commercial-score.mp3](/Users/martinezequielpulitano/warden/videos/warden-launch/assets/audio/warden-commercial-score.mp3).

| Time | Musical / editorial cue |
| --- | --- |
| 0.000 s | Immediate low impact and active original synth motif. Dry rhythmic foundation enters immediately. |
| 4.000 s | Aperture assembly: reversed tonal pickup, low impact and metallic lock; harmony changes. |
| 8.000 s | Push: rising noise/tonal pickup into a heavier low accent. |
| 10.000 s | Contained block impact; a short centered knock. |
| 10.105–10.305 s | Deliberate 0.20-second space after the impact, approximately −64.4 dBFS RMS. Bed eases back through 10.39 s; groove resumes at 10.5 s. |
| 14.000 s | Three routes: left/center/right metallic ticks at 14.000 / 14.125 / 14.250, then a fuller phrase. |
| 14–20 s | Rising activity: additional sixteenth-note detail and syncopated chord stabs. |
| 20.000 s | Light local world: brighter major harmony and an airy upper-register chord gesture. |
| 26.000 s | Logo resolution: original D–A–D–F-sharp phrase. Rhythm simplifies and clears around it. |
| 29.000 s | Final resolved D-add9 chord with one grounded pulse; no further drum groove. |
| 32.000 s | Clean end after a three-second harmonic tail. Last audio sample is zero in both channels. |

All sound sources are synthesized locally by [generate_score.py](/Users/martinezequielpulitano/warden/videos/warden-launch/production/new-score/generate_score.py): additive detuned chord voices, a shaped harmonic bass, FM-like keys, noise percussion, inharmonic metallic modes and reverse pickups. No external audio files, samples, catalog tracks or model-generated music were used. Fixed seed `814306` makes the score reproducible. Runtime requires Python with NumPy and FFmpeg.

The score is designed to feel rhythmically active and precise, with a strong interruption at the block and a warmer resolution as the local world appears. Stereo delays provide width while bass and main impacts remain centered. The pulse, chord voicings, melodic phrases and drum detail evolve across sections rather than repeating a single ambient figure.

Mastering: FFmpeg two-pass EBU R128 loudness normalization, target −15 LUFS integrated with a −1.2 dBTP ceiling. Independent final measurements:

| File | Integrated loudness | True peak | Format / timing |
| --- | --- | --- | --- |
| WAV master | −15.01 LUFS | −1.63 dBTP | 48 kHz, stereo, 24-bit PCM; exactly 32.000000 s / 1,536,000 samples |
| MP3 preview | −15.01 LUFS | −1.61 dBTP | 48 kHz, stereo, 256 kb/s; encoder delay metadata present |

Use the WAV at timeline time zero for exact synchronization. The WAV begins and ends at zero; the final 0.2 seconds measure approximately −61.6 dBFS RMS. Stereo correlation across the file is 0.463. No clipping was detected by the loudness/true-peak analysis. The verification pass was analytical; no subjective listening pass is claimed.
