# Warden landing

Static, same-origin files with no build step or package installation. The page uses Warden’s white identity: an unboxed silver shield on graphite, white download actions, and light product workspaces. The hero reads “Your AI. Your rules.” and lets visitors run illustrative requests through block, review and allow states. Four chapters follow one illustrative workday; the closing sentence remains **“Writing them down was never the hard part.”**

## Run locally

From the repository root:

```bash
python3 -m http.server 8080 --directory landing
```

Open `http://localhost:8080`. Serve over HTTP so the local JavaScript modules load correctly. The root [`vercel.json`](../vercel.json) deploys `landing/` with empty install and build commands.

## Story and interaction

| Part | What it shows |
| --- | --- |
| Interactive hero | An immediate white download sits beside the official 3D shield. Pointer movement turns the reflected light; a click, tap, Enter or Space runs the next example. “Blocked by Warden” remains above the verdict line. Supporting links appear after the first result settles. |
| Policy handoff | A request, the official 3D shield and a decision record connect the hero to the workday. |
| 01 · Write | A white policy editor sits beside the narration on desktop. Proposed rules arrive from the instruction; native disclosures reveal the full policy and ID. Human activation remains separate. |
| 02 · Hit | A later request hits the policy; the same refusal is shown in Claude Code, Codex and OpenCode. |
| 03 · Log | The refusal and a separate review appear in the same illustrative activity record. |
| 04 · Spend | Reported session usage reaches a configured role ceiling; the next request waits for review. |
| Closing | The official 3D shield shares a composition with the original closing sentence and macOS/Windows downloads. Linux and other builds remain linked below. |

Each chapter plays its three beats once when enough of its product panel is visible, then holds. Its step buttons let a visitor choose a beat, and Replay restarts that chapter. The write panel also offers Draft and Activate controls and native full-rule disclosures. Manual input cancels the old playback timers; a visitor’s tool selection is retained. Scrolling remains native, without pinning or scrubbing.

These are prewritten product examples, not a live compiler, gateway or policy editor. The controls change presentation only; no policy is activated outside the page. Keep the proposed-rule review and human activation distinct.

## Progressive enhancement

- `light.js` draws the request path and pointer response on a 2D canvas. The interface and decision line remain readable without canvas; unavailable interaction does not expose an inert button.
- Header and hero link directly to the platform installer from the first frame. The alternate platform, film and free/open-source lines reserve their space but stay hidden until the renderer reports the settled verdict, around 1.4 seconds. Missing canvas keeps the readable result; a bounded fallback prevents a stalled renderer from trapping the links. No-JS and reduced motion show them immediately. The sticky header keeps the download available throughout the page.
- `shield.js` and the vendored Three.js modules load near either shield. Each shield runs one 1.9-second entrance, then stops requesting animation frames. Fine-pointer input gently changes its real rotation and reflection, settling back to rest. Rendering pauses offscreen or in a hidden tab; a static local PNG remains if loading or WebGL fails.
- Reduced motion shows completed chapter states and the shield’s final pose, with typing and transitions disabled. Without JavaScript, the markup and radio-based tool switch remain readable; the head watchdog removes animation hiding if the main module fails to load. A late module restores the interactive controls when it becomes ready.
- **Watch the film** is a normal media link enhanced into a dialog. The 17-second launch MP4 is assigned only after the visitor chooses to play; it has `preload="none"`. Closing pauses playback and returns focus. Native links remain the fallback for no JavaScript or unsupported dialogs.

## Files and sources

| File | Role |
| --- | --- |
| `index.html` | Original story, illustrative product content, controls and download links. |
| `foundation-v2.css` | Neutral palette, locally hosted Manrope, page frame, controls, navigation and film dialog. |
| `experience-v2.css` | Unboxed hero, light/dark story composition, 3D object placement, responsive motion and closing. |
| `product-scenes-v2.css` | White composer, rule rows, native tool selector, terminals, decision log and role ceilings. |
| `story-depth.js` | Scales and plays the official 3D policy handoff. |
| `app.js` | Chapter playback, manual steps/replay, tool choice, film modal and platform link ordering. |
| `analytics-entry.js`, `analytics-config.js`, `analytics.js` | Independent, explicit PostHog measurement with production-host gating and isolated local test mode. |
| `light.js` | Pointer/touch policy interaction, request paths and three illustrative decisions. |
| `shield.js`, `assets/3d/` | Local official-symbol renderer, vendored Three.js, its license and static fallback. |
| `assets/brand/Manrope-Variable.ttf`, `Manrope-OFL.txt` | Self-hosted variable font from the official Google Fonts repository, under the SIL Open Font License. |
| `assets/launch/` | Approved launch film and poster; optional extracted media. |
| `llms.txt` | Concise product scope and links for automated readers. |

Brand geometry comes from [`brand/`](../brand/README.md). The product examples should remain grounded in [`web/`](../web/), [`src/policy/compile.ts`](../src/policy/compile.ts), [`web/js/draft-set.js`](../web/js/draft-set.js), [`integrations/warden-hook.mjs`](../integrations/warden-hook.mjs), [`src/guard/budget.ts`](../src/guard/budget.ts) and [`src/audit/`](../src/audit/).

Downloads use this repository’s [latest release](https://github.com/Wardenlabs/warden/releases/latest): macOS Apple Silicon and Windows x64 links, plus releases/source for Linux and other builds. Keep platform availability tied to actual release assets. Product evidence and limitations remain in [`SECURITY.md`](../SECURITY.md), [`docs/HOOK-VERIFICATION.md`](../docs/HOOK-VERIFICATION.md), [`REPORT.md`](../REPORT.md) and [`BENCHMARKS.md`](../BENCHMARKS.md).

See [launch measurement](ANALYTICS.md) for the PostHog dashboard, campaign link, test filters, free-plan limits and GitHub download snapshots. Clicks, file downloads and installations are separate metrics.
