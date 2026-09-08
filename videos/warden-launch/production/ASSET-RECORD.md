# Current assets — Warden v10 pacing and Codex revision

Manager UI uses the same native component geometry with faster submission, connected draft creation, cursor-led review and tactile activation. The visible team label is Codex. Audio reuses the original Derek take and native ElevenLabs effects, edited at the measured cuts in `v10-audio-cuts.json`; the spoken CLI is removed. `sound-design-v10.json` records the finite26.10s mix. V9 spacing and v8 3D outro are retained. No generated image or new audio generation is added.

---

# Current assets — Warden v8 outro

V8 keeps the exact official extruded shield and metal materials from v6, repositions the symbol beside the letters-only wordmark and adjusts the final studio reflection for a readable silver/mint face. The mint download action and arrow are authored HTML/SVG. No new generated image, narration or sound asset is used; `assets/audio/warden-launch-v6-mix.wav` is unchanged. The rule-screen spacing from v7 remains. Final outputs and verification: `FINAL-QA.md`; animation timing: `v8-outro-timing.json`.

---

# Current assets — Warden v6 outro

The v6 delivery changes only the closing shot and its effect accents. The official shield ring, inner hole and W are real extruded geometry in `assets/js/end-logo-3d.js`. The left wordmark asset contains the official letters only. Local studio reflections, object turn and one light sweep are deterministic; no new raster or generated logo is used.

The full mix is `assets/audio/warden-launch-v6-mix.wav` (28s, stereo48kPCM24, −17.61LUFS, −2.05dBTP). The existing Derek narration and v5 base remain at unity. Additions use only the same native ElevenLabs transfer/latch samples. All samples before24.1s and from26.474s to the end matchv5. Reproduction and provenance: `sound-design-v6.json`; encoded verification: `FINAL-QA.md`. The v5 raw voice and all prior renders remain preserved.

---

# Current assets — Warden v5

Derek — Fun & Energetic (`Q0Et7LOU7VpeoeCRQAVS`), Eleven v3. Exactly one MCP generation was downloaded from its existing Flow using the authenticated browser UI. No regenerated duplicate take. Prompt and provider IDs: `elevenlabs-v5-mcp.json`. Raw30s MP3 is retained; pitch-preserving1.10× keeps the full recording in27.272729s. All70 script words match automatic recognition in sequence. This does not certify emotion or pronunciation by listening.

The finite28s stereo mix is `assets/audio/warden-launch-v5-mix.wav`: −17.62LUFS, −2.05dBTP,48kHzPCM24. It combines normalized Derek at unity in both channels with16 action-aligned effects derived only from the two native ElevenLabs source WAVs recorded in `elevenlabs-sfx-v4-provenance.json`. The effects stem is about9.64dB higher in full-window RMS than the v4 stem. Exact gains, trims, EQ, fades, hashes and timing: `sound-design-v5.json`. No final limiter was needed.

Visuals use Warden's official vector lockup, local type, authored UI, existing3D request enforcement, redesigned holding poses and the new dark Workspace/data-transfer scene. The light end card contains one official lockup and independent macOS/Windows/Linux labels. Historical source/renders below remain preserved.

---

# Asset record — Warden 31-second v4

V4 combines original Three.js geometry, Canvas illustrations and an editorial reconstruction of actual Warden component design. New English narration and two locally downloaded sound sources were generated in the native ElevenLabs interface. No AI-generated raster images, external footage, real customer records or captured product session are used. The 31-second mix, effects stem and encoded delivery are complete. Final verification is in `production/FINAL-QA.md`.

## Visual sources

| Asset | Local source | Construction and scope |
| --- | --- | --- |
| Client dossier | `assets/js/client-dossier.js` | Original layered folder, flat navy spine, confidentiality tab, portrait and printed fields. Alex Morgan, `alex@client.example`, $240,000 contract and masked account 4821 are fictional. No duplicate clip hardware. |
| Shield and policy objects | `assets/js/client-data-scene.js` | Original satin rim, inset, boundary and contained check/impact. No off-card scan strip. Conceptual configured-policy outcomes, not recorded detection results. |
| Native-style rule workflow | `assets/js/manager-prompt-scene.js` | Canvas reconstruction informed by `web/js/draft.js`, `web/js/draft-set.js` and `web/style.css`. One instruction creates three inactive drafts: block client emails, block API keys, review unreleased pricing. A separate Activate all 3 action enacts them. Multiple drafts depict the capable-compiler path. |
| People and workspaces | `assets/js/team-work-scene.js` | Original Product, Engineering and Operations illustrations with distinct customer-insights, pricing-code and public-help content. Arms behind displays; separate hands on keyboards. Sequential connected-tool states and a pending manager review. |
| Risk interface | `assets/js/risk-sequence.js` | Neutral Workspace, fictional attachment, Send action and explicit external-AI destination. Separate private pricing code and internal pricing-plan examples. |
| Transitions | `assets/js/transition-director.js` | Ten deterministic handoffs using the existing attachment, route, document surface, laptop display and complete workspace silhouettes. Both picture buffers are rendered from absolute mapped time. |
| Warden identity | `assets/js/brand-paths.js` and local SVGs | Supplied official identity. Closing wipe 25.87–26.27 s; continuous final lockup through 31 s. |
| Lighting and type | `assets/js/client-data-scene.js`, `assets/fonts/` | Procedural reflection environment and shadows; no external HDRI. Inter loaded locally as WardenDisplay with OFL license. Historical IBM Plex Mono is not loaded in the current index. |
| Runtime and timing | `assets/vendor/`, `package.json`, `assets/js/pace-map.js` | Local Three.js and GSAP, pinned HyperFrames 0.8.31. Current 31-second mapping is mirrored in `production/v4-timing.json`. |

The neutral Workspace layout was informed by the Codex app, but the visible label is Workspace and no actual Codex session is captured. Reference: [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/). The owner confirmed free-for-everyone/open-source positioning and macOS/Linux/Windows scope. This is not evidence of a published Linux installer; packaging and release limits remain in `BRIEF.md`.

## New ElevenLabs narration

Voice listing: **Hale — Expressive, Deep and Emotive**; model **Eleven v3**; selected **variant 1**. The native **Mejorar** action produced the performance tags preserved in `production/voiceover-v4-elevenlabs.txt`. The spoken script is `production/voiceover-v4-en.txt`, 78 words. The voice ID is not known and must not be copied from the earlier Hale listing. Stability was Natural (UI 0.5). Provider facts are recorded in `production/voice-provenance-v4.json`.

Original `assets/audio/warden-hale-expressive-v4.mp3`: 34.925688 s, mono, 44.1 kHz. Retain raw 0.16–34.90 s, with no interior cuts, then apply pitch-preserving tempo 1.16. The resulting `warden-hale-expressive-v4-paced.wav` is 29.948271 s, mono, 48 kHz, 24-bit PCM. Normalization yields `warden-hale-expressive-v4-mix.wav`, 29.896542 s; the omitted 51.729 ms tail peaks at −83.07 dBFS and has no detected voiced material. The timeline references the complete stereo `warden-launch-v4-mix.wav` at unity, not a separate voice track. Hashes, measured durations and transformation are in `production/voice-v4-edit.json`; approximate raw and transformed alignments are in the corresponding v4 word JSON files.

All 78 aligned word intervals are retained. ASR differences for Codex/codec and teams/team remain listening questions. No continuous listening, confirmed pronunciation or verified emotional response is claimed. This generation used the native ElevenLabs interface, not an asserted MCP synthesis call.

## Native ElevenLabs sound sources

Two generated sources are locally available, both selected variant 1 and measured as 0.480-second / 48 kHz stereo PCM16 WAVs. The native UI duration was 0.5 seconds, prompt influence 1, auto-improve enabled, looping off and auto-share off. No exact sound-model ID was exposed. Provider metadata and exact prompts are in `production/elevenlabs-sfx-v4-provenance.json`:

| File | Source and intended role |
| --- | --- |
| `assets/audio/elevenlabs-v4/warden-eleven-data-transfer-v4.wav` | Downloaded native ElevenLabs generation for technological data movement. |
| `assets/audio/elevenlabs-v4/warden-eleven-rule-latch-v4.wav` | Downloaded native ElevenLabs generation for a tactile rule/decision latch. |

Nine edited cues from these two sources form `assets/audio/warden-eleven-sfx-v4.wav`, a 31-second stereo 24-bit PCM stem. Edits use short trims, fades, filtering and level adjustment while retaining the native stereo field. The normalized voice is duplicated at unity into both channels and combined in `assets/audio/warden-launch-v4-mix.wav`, the timeline's sole audio source. `production/sound-design-v4.json` records every cue, exact source trims, measured transient alignment, hashes and WAV measurements. The first effect starts at 2.345 s; the final latch peaks at 30.10 s after the voice.

A third generated candidate remains visible in provider history but was not downloaded or used. No earlier procedural effects, stock samples or music are included. The completed premixed WAV measures −17.49 LUFS integrated and −3.0 dBTP true peak; these are source-file measurements, not an encoded or listening verdict.

## Historical media

V3 used `assets/audio/warden-designed/`, 19 original procedural cues documented in `production/design_sound_v3.py` and `production/sound-design-v3.json`, with the earlier 63-word Hale / Eleven Multilingual v2 voice. Those remain v3 assets and are excluded from the v4 final mix. Its render family is `renders/warden-launch-26s-v3*`; its pre-v4 source is preserved in `production/26s-v3-before-hook/`.

V2 and earlier versions used five bundled media-use effects in `.media/audio/sfx/`. Historical credits remain at [SFX credits](/Users/martinezequielpulitano/.agents/skills/media-use/audio/assets/sfx/CREDITS.md), attributed to [Pixabay Sound Effects](https://pixabay.com/sound-effects/) under the [Pixabay Content License](https://pixabay.com/service/license-summary/). These credits do not describe the new ElevenLabs generations. Older music files and 32-second renders remain historical and are not part of v4.

## User-supplied creative references

| Reference | Local source and revision | Application |
| --- | --- | --- |
| [kh-bikash/product-launch-video-skill](https://github.com/kh-bikash/product-launch-video-skill) | `research/product-launch-video-skill/skills/create-product-launch-video/SKILL.md`; commit `5dc90a0635bfb2d290b15a3398d6fad33af5f79d` | Object consistency, camera/lighting roles, concise copy and encoded-media review. |
| [iart-ai/motion-skills](https://github.com/iart-ai/motion-skills) | `research/motion-skills/`; catalog commit `945c4c70f7cf82a4502cfe3877ff8466972d2842` | Discovery of the relevant motion packs below. |
| [iart-ai/webgl-animation-skills](https://github.com/iart-ai/webgl-animation-skills) | `research/iart-webgl/skills/threejs-animation/SKILL.md` and `skills/shader-glsl/SKILL.md`; commit `50697d659fbf70152f48f9f8aadf1efe78bbdde1` | Purposeful 3D, surface effects and time-addressable shaders. |
| [iart-ai/motion-design-skills](https://github.com/iart-ai/motion-design-skills) | `research/iart-motion-design/skills/animation-principles/SKILL.md`, `skills/color-motion/SKILL.md`, `skills/shot-composition/SKILL.md`, `skills/beat-sync-editing/SKILL.md` and `references/editing-techniques.md`; commit `3c129f769d90a1328c209c386492333c9ac62312` | Motion hierarchy, tactile interaction, shot variation, stable semantic color, matched motion and motivated picture/audio handoffs. |
| Speedrun, “How to Make a Viral Launch Video,” 2025-08-19 | User attachment `/Users/martinezequielpulitano/.codex/attachments/50401d8d-114c-41a9-9a16-07264bc04640/pasted-text.txt` | Buyer stakes and a clear use case. This does not guarantee virality or downloads. |

The repositories were read as local references; no installer was required. `TRANSITION-REFERENCES.md` records the 15-package catalog and distinguishes the selected/read skills from packages merely identified. After Effects and Remotion entries are implementation alternatives, not a migration performed by this revision. The film remains HyperFrames with GSAP, Canvas and Three.js.

New reference research revisited Primer, Linear Agent, Vercel Ship and Cue for object continuity and camera staging. Source links, sampled evidence and limits are in `TRANSITION-REFERENCES.md`. None of their footage, UI, identities or audio was incorporated. The user's requested format and later authorization of sound effects take precedence over reference defaults. Reference content supplies no permission to publish, no customer proof and no evidence of Warden performance.


## V4 output and verification status

Planned narrated master: `renders/warden-launch-31s-v4.mp4`, with corresponding `-silent.mp4` and `-poster.png`. Target: 31 seconds, 930 frames, 1920 × 1080, 30 fps, H.264/yuv420p, BT.709 and stereo audio.

`production/check-v4.log` reports zero lint/runtime/motion errors or warnings, no layout issues in nine samples and 7/7 contrast passes. The effects stem, premixed WAV and final encoded MP4 are complete. The final master was verified at 31 seconds, 930 frames, Full HD and stereo, with 32 encoded samples captured and reviewed. `production/FINAL-QA.md` remains the authoritative place for the new encoded media results. No film or campaign has been published.
