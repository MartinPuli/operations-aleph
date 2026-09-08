# Warden — 21.90-second v11 launch film

V11 is the current exported edit for X: **1920 × 1080, 30 fps, 657 frames, 21.90 seconds**. The filenames use the shorthand “22s.” The master and silent companion have been exported and verified; see `production/FINAL-QA.md`.

The film opens with a useful outcome: an active policy stops a confidential client file while public work continues. A manager then describes what to protect, reviews Warden’s proposed rules and explicitly activates them. Connected tool workspaces lead into a side-by-side private-file/public-update example and the approved continuous 3D outro.

The earlier cartoon team and cream-colored product scenes are replaced by a dark product workbench. Complete prompts, rule rows, tool windows and result panels carry the motion. The existing official 3D shield, silver/mint material and closing choreography remain.

## Current source and intended delivery

`index.html` owns the 21.90-second output timeline and loads the two new scene sources, `assets/js/hook-v11.js` and `assets/js/product-workbench-v11.js`. It retains `assets/js/end-card.js` and `assets/js/end-logo-3d.js` for the outro. The old `pace-map.js` and earlier scene modules are history, not the v11 renderer’s timing authority.

Verified exports:

- `renders/warden-launch-22s-v11.mp4` — narrated master.
- `renders/warden-launch-22s-v11-silent.mp4` — silent companion.
- `renders/warden-launch-22s-v11-poster.png` — poster at 2.8 seconds.

`STORYBOARD.md` describes the sequence. `production/v11-motion.json` records output ranges, canonical scene clocks and mapped visual actions. The full manager prompt is **“Help our team write client emails without exposing confidential information.”** Warden proposes illustrative Client contact details — BLOCK, Bank account details — BLOCK and Non-public pricing — REVIEW drafts. The interface makes no fixed rule-count claim.

## Voice and sound

The new English performance is **Liam**, voice ID `TX3LPaxmHKxFdv7VOQHJ`, model **Eleven v3** (`eleven_v3`). Selected source: `assets/audio/warden-liam-v11-take1.mp3`, measured at **20.64 seconds**, with no tempo or pitch change. `production/voiceover-v11-en.txt` contains the exact script; `production/voice-v11-take1-words.json` is an automatic alignment aid, not listening approval.

The existing generation in ElevenLabs Flow `mlIvhilVFN6WUmcmE8vf` produced two completed takes and two failed generations. Both completed takes were downloaded through the authorized native UI; the UI reported no charge for the failed generations. Take 2 is retained as `assets/audio/warden-liam-v11-take2.mp3`. This documentation does not initiate or imply another generation.

The assembled `assets/audio/warden-launch-v11-mix.wav` is the sole audio source in `index.html`, at unity gain. It combines the unchanged-speed Liam take with eight short cues made from existing native ElevenLabs latch/transfer sources. `production/sound-design-v11.json` records a 21.90-second, 48 kHz stereo WAV and analytical measurements of −17.08 LUFS and −1.20 dBTP. These are mix measurements, not measurements of a final encoded video. No subjective listening approval is claimed.

## Product scope and revision history

These are authored product examples, not a recorded live compiler run. Multiple drafts require a capable configured compiler; a local fallback can produce fewer. Drafts require human review and activation. The illustrated enforcement applies to connected requests and configured policies, not every Gmail, Outlook, ordinary Claude web chat or unconnected workflow. The outcomes do not establish universal detection or guarantee that all confidential data will be caught.

Product, Engineering and Operations are identified through workspaces for Claude Code, Codex and compatible tools. Free/open-source positioning and macOS, Windows and Linux scope are owner-confirmed; this film does not verify current published installers. The 1,000-download launch target is an aspiration, and no campaign publication is claimed.

V10 exports and provenance remain historical: `production/index-v10-before-v11.html`, `production/v10-motion.json`, `production/v10-audio-cuts.json`, `production/voiceover-v10-en.txt` and `renders/warden-launch-26s-v10.mp4`. `production/FINAL-QA-v10.md` retains the historical v10 review.
