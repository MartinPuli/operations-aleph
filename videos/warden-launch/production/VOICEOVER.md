# English narration — v10

The current script is `voiceover-v10-en.txt`: it says **Codex**, without CLI. The existing Derek / Eleven v3 take is reused. Four measured silent intervals totaling0.80s and the1.10s CLI region are removed; other spoken phrases retain their current pitch, speed and gain. The edited voice lasts25.372729s inside the26.10s film. `v10-audio-cuts.json`, `voice-v10-phrase-onsets.json` and `sound-design-v10.json` record exact cuts, onsets, native effects and measurements. The original take and every prior mix remain preserved.

Current mix: `assets/audio/warden-launch-v10-mix.wav`. Source measurements: −17.52LUFS and−2.05dBTP. Final encoded verification is in `FINAL-QA.md`. This revision made no new ElevenLabs generation.

---

## Preserved v5–v7 provenance

# English narration — unchanged Derek take in the 28-second v7 cut

Current v7 revision: roomier prompt and rule-panel spacing only. Rows use an 86px pitch with a 56px badge-to-name gap; the footer and activation cursor move together. Timing, Derek narration, native effects and the v6 3D outro remain unchanged. Delivery: `renders/warden-launch-28s-v7.mp4`; layout record: `production/v7-spacing.json`.

The exact **70-word** script is `voiceover-v5-en.txt`. The final line is **Get Warden. Free for everyone. Open source.** V6 reuses the complete v5 narration without another generation or voice edit. The completed video is 28 seconds; its H.264/BT.709 picture and AAC stereo media verification pass.

## Actual generation and retrieval

- Voice: **Derek — Fun & Energetic**, verified with native `creative_list_voices`.
- Voice ID: `Q0Et7LOU7VpeoeCRQAVS`.
- Model: **Eleven v3** (`eleven_v3`).
- Performance directions submitted: `[urgent]` for the opening and `[excited]` before the Warden pitch. These are requested directions, not a listening assessment.
- Exactly **one** native MCP generation followed one successful estimate. No generation retry was made.
- The MCP accepted synthesis, while Flow read tools returned a missing-`flows` permission error. The root task downloaded that same completed take through its authenticated visible Flow canvas.
- Original: `assets/audio/warden-derek-v5.mp3`, **30.000 seconds**, mono, 44.1 kHz.
- Full prompt, estimate, voice lookup and run IDs: `elevenlabs-v5-mcp.json`; original accepted response: `elevenlabs-v5-generation-response.json`.

Do not attribute older Hale, Multilingual v2, stability or native Mejorar settings to this take. Additional voice/model parameters were not supplied or verified for this MCP generation.

## Processing and measured voice levels

The entire 30-second source is retained. The leading pause is already about 90 ms; the final 40 ms contains measurable signal, so no unreviewed edge or interior audio was cut. **Pitch-preserving atempo=1.10** creates `assets/audio/warden-derek-v5-paced.wav`, **27.272729 seconds**, mono, 48 kHz, 24-bit PCM.

`assets/audio/warden-derek-v5-mix.wav` has the identical duration and format. A constant **−1.74 dB** gain adjustment, without a compressor or limiter, measures **−20.65 LUFS mono, −3.05 dBTP**. Unity duplication into L/R measures **−17.64 LUFS stereo**. Use this normalized mono file for the final mix; do not apply the default attenuating mono-to-stereo conversion.

`voice-v5-edit.json` records hashes, source sample levels, silence intervals, finite output duration, normalization and the transformation **paced seconds = raw seconds / 1.10**. `prepare_voice_v5.py` reproduces the edit. The preserved v5 voice/SFX WAV measures −17.62 LUFS, −2.05 dBTP and 2.1 LU LRA; `sound-design-v5.json` records its unity voice-sum verification. V6 adds only the outro effects over that unchanged mix.

## Alignment aids

| Approximate paced onset | Spoken section |
| --- | --- |
| 0.100 s | One quick AI task. |
| 1.427 s | Your client’s bank details… |
| 2.664 s | …sent outside the company. |
| 4.009 s | That’s a data leak. |
| 5.429 s | Take control with Warden. |
| 6.945 s | Describe what your team needs to protect. |
| 8.821 s | Warden drafts the rules. |
| 10.193 / 10.846 s | Review. Activate. |
| 11.715 s | Connected requests get checked before they reach the model. |
| 14.539 / 15.793 / 17.475 s | Block private data. Review sensitive requests. Keep public work moving. |
| 19.003 / 20.403 s | Connect Claude Code, Codex CLI… |
| 21.436 s | …or compatible tools… |
| 22.955 s | …across your teams. |
| 24.487 s | Get Warden. |
| 25.384 / 26.429 s | Free for everyone. Open source. |

The table combines automatic ASR starts with separate measured following-pause endpoints where helpful. `voice-v5-words.json` contains raw Whisper output; `voice-v5-paced-words.json` maps all 70 word intervals; `voice-v5-phrase-onsets.json` preserves both timing bases. All 70 script words match after punctuation/case normalization, including Warden, Claude Code and Codex CLI. This does not certify pronunciation, emotional delivery or intelligibility by listening.

## Picture and sound status

`v5-timing.json` remains the 28-second story map; the v6 outro begins at 24.10 seconds. The 3D logo turns through 24.75, complete Download / for free. lines resolve by 24.84 / 25.41, and platform / open-source details by 26.00 / 26.44. The frame is static by 27.05. Narration onsets and all 1,309,091 normalized voice samples remain unchanged.

`assets/audio/warden-launch-v6-mix.wav` is 28 seconds, stereo 48 kHz / 24-bit PCM. It preserves the v5 mix at unity and adds native outro accents only; PCM before 24.10 seconds and the final latch at 27.45 are bit-identical to v5. The WAV measures −17.61 LUFS / −2.05 dBTP; encoded audio measures −17.64 LUFS / −2.08 dBTP / 2.0 LU LRA. `sound-design-v6.json` records the additive mix and exact PCM checks.

Master `renders/warden-launch-28s-v7.mp4`, its silent companion, poster at 27.45 seconds and `renders/warden-outro-v6.mp4` are exported. `FINAL-QA.md` owns current verification. The previous v5 source is preserved in `28s-v5-before-outro/`; v4 records remain in `31s-v4-before-v5/`.
