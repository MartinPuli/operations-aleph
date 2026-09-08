# V12 sound plan — pending Lukas timing

Target: 17 seconds / 510 frames at 30 fps. This is a proposed sound edit, not a completed mix. Do not assign final accents or retime speech until the selected Lukas take and its measured word timings are available. Prefer original-speed speech; any necessary, explicitly selected tempo change must be pitch-preserving and no greater than 1.10×, and all phrase times must then be re-mapped.

The added energy should come from a restrained rhythmic foundation plus object contacts that mark cause and effect. The narration remains the foreground. Avoid an opening bass boom, reverse pickups, long whooshes, generic interface chimes, simulated typing and a separate sound for every text/rule/platform entrance.

## Verified sources

Only these two standalone SFX have verified native ElevenLabs provenance:

- `assets/audio/elevenlabs-v4/warden-eleven-rule-latch-v4.wav`: 0.480 s, 48 kHz stereo PCM16. Native brief: compact magnetic/ceramic closure with a short warm body. Use edited contacts; preserve its source identity.
- `assets/audio/elevenlabs-v4/warden-eleven-data-transfer-v4.wav`: 0.480 s, 48 kHz stereo PCM16. Native brief: a short directional granular transfer ending in a dry cutoff.

Hashes, actual media properties and candidate-score measurements are recorded in `v12-sound-assets.json`; native source provenance is in `elevenlabs-sfx-v4-provenance.json`. Other `warden-designed/*` files are locally synthesized effects and are not additional native ElevenLabs sources. Prior mixed stems contain timing/balancing decisions from older versions and should not be dropped into v12 wholesale.

`assets/audio/warden-commercial-score.wav` is an original deterministic local composition, not ElevenLabs music or a third-party catalog track. It is 32 seconds at 120 BPM, stereo 48 kHz PCM24, measured −15.01 LUFS / −1.63 dBTP. Its source and provenance live in `production/new-score/`. Reusing an excerpt is an edit of that existing recording, not a fresh generated music asset.

## Rhythmic bed proposal

Use source **11.000–13.000 s** as the first candidate: one two-second, four-beat cycle at 120 BPM. It follows the old 10-second block/recovery and ends before the reverse pickup scheduled at 13.2 seconds. Its measured level is −15.68 LUFS / −6.28 dBTP before treatment. The source arrangement identifies it as the quieter passage; residual tails may remain and a listening review is still needed.

Start the bed around **0.25–0.50 s**, after the opening consonants. Keep its 0.5-second beat grid continuous while the voice and picture establish the actual edit boundaries. Repeat the two-second excerpt with short, phase-consistent seam treatment that does not shorten the beat spacing. Do not quantize or accelerate the voice to the music.

After activation, one or two bars of source **16.000–18.000 s** can add its existing sixteenth-note detail; that interval has no explicitly scheduled scene impact or sweep. It measures −14.86 LUFS / −4.87 dBTP before treatment. Change only on a matching bar boundary. This is an optional energy lift, subject to the harmonic/edit seam review; the quieter bar alone is a usable fallback.

For the final download line, reduce the rhythmic bed rather than add more percussion. A possible closing tail is source **30.000–32.000 s**, which omits the original impact at 29 seconds. Fade it in briefly at the actual CTA anchor and let it resolve by 17 seconds. If its chord change draws attention away from the voice, use the same bed with a controlled fade instead. Do not add the score's original 26-second logo motif or 29-second hit.

Provisional bed level: about **−30 LUFS before voice ducking**, with 3–5 dB of additional dynamic space during speech. Remove sub-bass below roughly 80–100 Hz, then derive a modest speech-band carve from the actual voice/bed relationship. The carve and duck affect the bed only. Preserve the clean Lukas voice unless measurement or listening establishes a defect. Do not diagnose it from another narrator's spectrum.

Nominal 17-second shape, to be resolved against actual words:

| Window | Sound behavior |
| --- | --- |
| 0–0.25 s | Voice gets the entrance; no added bass hit. |
| 0.25–5 s | Quiet dry pulse establishes forward motion; the first meaningful blocked contact supplies the main accent. |
| 5–9 s | Bed stays low while instruction, review and activation remain intelligible; one stronger activation latch closes the sequence. |
| 9–13.5 s | Optional denser bar supports connected work; separate restrained connection contacts follow the visible latches. |
| 13.5–17 s | Bed drops beneath the download/open-source line, a single logo-settle contact, then a short musical release. |

These windows are a proposal, not measured scene or phrase timings.

## Foley tied to actions

Place each processed transient's **peak** on the visible action. Preserve any small lead-in before the peak; do not align the file boundary blindly. Peak targets below are initial mix settings, subject to the actual voice level and final true-peak measurement.

| Action anchor | Native source edit | Initial peak target |
| --- | --- | --- |
| First private-file stop | Latch 0.055–0.235 s, 180 Hz high-pass / 6.8 kHz low-pass | −15 to −17 dBFS |
| First public crossing | Transfer 0.238–0.335 s | −23 dBFS |
| Send press | Transfer 0.238–0.335 s, slightly darker than crossing | −24 dBFS |
| Draft assembly lands | One transfer 0.145–0.335 s across the whole assembly, not one click per row | −23 dBFS |
| Activate press | Latch 0.045–0.260 s | −16 to −18 dBFS |
| First tool latch | Transfer 0.145–0.225 s | −23 dBFS |
| Second tool latch | Transfer 0.238–0.335 s | −22 dBFS |
| Proof: private remains blocked | Latch 0.055–0.235 s with less low body than opening | −22 dBFS |
| Proof: public update completes | Transfer 0.238–0.335 s | −21 dBFS |
| Official logo settles | Latch 0.055–0.235 s, compact tail | −20 dBFS |

Ten action accents are the maximum proposed palette, not a required count. If two actions land within about 120 ms, use one contact or omit the subordinate accent. Do not move an accent off its visual event just to escape a syllable; lower it or omit it. Leave “Warden,” “you control,” “activate” and the download line room to read clearly in speech. Keep low-frequency contact bodies centered and preserve the transfer's existing directional texture.

## Builder changes needed before execution

`build-v11-mix.py` already handles local source hashes for SFX, bounded trims, filtered-peak alignment, explicit phrase anchors, source-preserving voice gain, exact sample length and independently measured output loudness/true peak. Preserve those safeguards in a separate v12 builder.

Do not run the v11 builder unchanged:

- Output/report protection and metadata are explicitly v11; v12 needs its own filenames and version.
- It only accepts one contiguous score excerpt. V12 needs explicit local score segments/loops and preserved beat spacing, with source hashes and trim-bound checks.
- Its score duck uses whole phrase spans. Adjacent phrase blocks keep that attenuation effectively constant; a continuous-speech v12 bed needs the actual speech envelope or measured word/phrase gaps, plus a modest dynamic spectral carve.
- `voice.tempo` in the v11 config is not applied by the builder. A v12 builder must either reject values other than 1 or explicitly implement and record `atempo` up to 1.10 with output-clock re-alignment. Never silently ignore a requested change.

Before output: validate measured voice fits the final duration, all anchors use final output time, no source is overwritten, and tails remain inside 17 seconds. Start with a final mix target around −16.5 LUFS and a −1.2 dBTP ceiling; retain the stronger clean voice even if peak headroom prevents reaching the exact LUFS target. Report actual values after rendering, not just targets. Check mono fold-down and voice-plus-bed overlap around dense speech. Final encode still needs its own measurement and listening review.

No new generation is necessary to test this plan. Native music becomes useful only if the existing excerpt's seams or melodic content fail the listening review; do not generate more cues merely to increase their number.
