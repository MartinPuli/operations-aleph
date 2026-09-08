# Warden — current 26.10-second v10 sequence

**1920 × 1080, 30 fps, 783 frames.** V10 strengthens the prompt → drafts → human review → activation sequence and shortens the film by 1.90 seconds. Four narration gaps account for 0.80 seconds; removing spoken “CLI” and its adjacent pause accounts for 1.10 seconds. Both picture and narration now say **Codex**. No new audio is generated.

V9’s prompt top padding and the rule-panel geometry remain. The approved v8 outro retains its exact choreography on the original internal clock; its current output range is **22.20–26.10 seconds**. `production/v10-audio-cuts.json`, `production/v10-motion.json` and `assets/js/pace-map.js` define this revision. The v10 master and companions are exported and media verification passes. `production/FINAL-QA.md` records the full review and verification.

| Output time | Complete headline | Visible action |
| --- | --- | --- |
| 0–1.95 s | One click can leak client data. | Dark neutral Workspace. “Draft a client update.” The confidential client brief slots in, Send clicks at 0.72 s, and complete response lines follow. Attachment transition begins at 1.46 s. |
| 1.95–3.94 s | Here’s what leaves your company. | Contact, bank details and pricing rows visibly copy from Company across the boundary to External AI. The outgoing request fills with the same information; “Confidential data shared” completes the event. |
| 3.94–4.66 s | Private pricing leaves, too. | Private pricing code sends its illustrated price value to the external request. |
| 4.66–5.43 s | Private pricing leaves, too. | A matching internal pricing plan continues the same action and dark visual language. |
| 5.43–6.55 s | Take control with Warden. | The route becomes a policy boundary and opens into the manager composer. The complete prompt and lines enter from 5.43–5.83 s, retaining v9 top padding. |
| 6.55–7.28 s | Describe what to protect. | “Help our team write client emails without exposing confidential information.” Send presses at 6.98 s. The submitted prompt docks at 7.05–7.27 s as the proposed-rules panel starts entering at 7.26 s. |
| 7.28–8.52 s | Warden drafts your rules. | The panel settles by 7.47 s. Complete rows arrive at 7.42 / 7.53 / 7.64 s and finish by 7.84 s: BLOCK Client contact details, BLOCK Bank account details, REVIEW Non-public pricing. They remain inactive drafts; no fixed count is promised. |
| 8.52–10.90 s | Review. Then activate. | The cursor inspects the three proposals at 8.52 / 8.82 / 9.12 s. Activate rules presses at 10.35 s; active status starts at 10.44 s. The camera begins pulling back at approximately 10.697 s. |
| 10.90–11.80 s | Warden enforces your rules. | The pullback finishes around 11.035 s, revealing Product, Engineering and Operations holding their laptops. Narration preserves connected-request scope. |
| 11.80–13.60 s | “Include the client’s details.” | Enter the employee’s laptop. A private-data request approaches the configured boundary before its decision. |
| 13.60–15.00 s | Blocked by your rule. | The request stops; the whole blocked heading resolves after impact. “Before it reaches the model.” |
| 15.00–16.60 s | You make the call. | A separate sensitive request remains pending for human review. Approve and Block are visible and neither is executed. |
| 16.60–18.10 s | Public work goes through. | A separate public-information request passes. “Public information. Allowed.” |
| 18.10–21.05 s | Connect their AI tools. | Whole people/laptops connect separately: Claude Code, Codex and compatible tools. The removed “CLI” does not appear in the label or narration. |
| 21.05–22.20 s | One policy across your teams. | The same people retain their identities as tool labels become configured outcomes. |
| 22.20–26.10 s | Download for free. | A centered brand aperture opens the dark ink stage through 22.57 s. The same 3D shield turns at center and settles larger at left beside the official letters-only wordmark. One mint download action with a drawn arrow reveals at 23.26–23.51 s; URL below it at 23.31–23.54 s. Platforms reveal at 23.88–24.10 s; Open source. Free for everyone. appears under the wordmark at 24.30–24.54 s. Static by 25.15 s through the end. |

Outro layout on the 1920 × 1080 frame remains: aperture center **(960, 450)**; settled symbol bounds **x314–686 / y138–598**; letters-only wordmark **(780, 267), 830 × 199**; mint action **(450, 728), 1020 × 126**. The original mesh, material and turn are retained, including v8’s final environment yaw of **−0.44**. Every outro event is its original output time minus 1.90 seconds.

## Narration and sound

The original Derek / Eleven v3 performance is edited, not regenerated. Original-audio intervals removed are **6.615–6.865**, **8.605–8.775**, **10.700–10.780**, **11.365–11.665** and **21.000–22.100 seconds**. `production/v10-audio-cuts.json` defines the complete mapping. The first four intervals shorten pauses; the last removes spoken “CLI” and its adjacent pause while preserving **Codex** and **or**. `production/voiceover-v10-en.txt` is the current script.

Approximate phrase onsets, mapped from the original alignment aids, are: Take control **5.429 s**, Describe **6.695**, Warden drafts **8.401**, Review **9.773**, Activate **10.346**, Connected requests **10.915**, Block **13.739**, Review sensitive requests **14.993**, Public work **16.675**, Connect **18.203**, Codex **19.603**, Get Warden **22.587**, Free for everyone **23.484** and Open source **24.529**. These are editing aids, not listening approval.

The existing native ElevenLabs effects are independently re-anchored to the picture rather than cut with the narration. The completed audio is `assets/audio/warden-launch-v10-mix.wav`. Encoded v10 audio measures −17.5 LUFS, −1.8 dBTP and 2.3 LU LRA, rounded. Automatic recognition verifies the edited 69-word script after brand-homophone normalization, including the ASR spelling “codecs” for Codex; that spelling does not indicate lost speech.

## Delivery and verification

Completed exports are `renders/warden-launch-26s-v10.mp4`, matching `-silent.mp4` and `-poster.png` companions, plus `renders/warden-prompt-v10.mp4`. The poster samples **8.9 seconds**; the **6.1-second** prompt excerpt covers master time **5.1–11.2 seconds**. The file-name shorthand is 26s; verification confirms **26.100 seconds / 783 Full HD frames at 30 fps**, H.264/yuv420p, BT.709 and AAC 48 kHz stereo. Source checks pass with zero errors/warnings, zero layout issues across nine samples and 11/11 text-contrast checks. Twenty-eight encoded-frame samples were captured. `production/FINAL-QA.md` owns the full review and final verification. No new v10 outro excerpt was needed; the approved v8 outro remains visually unchanged.

V9 spacing, v8 outro choreography and earlier renders remain meaningful revision history. The original narration provenance is in `production/VOICEOVER.md`; older source backups remain in `production/28s-v5-before-outro/` and `production/31s-v4-before-v5/`.

All records, prompts and decisions are illustrative. Multiple drafts require the capable compiler path; protection applies to configured connected requests. Free/open-source and platform positioning are owner-confirmed, with published installer availability unverified by this film work.
