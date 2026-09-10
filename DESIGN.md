---
name: Warden
description: A dark editorial policy control track for connected AI requests.
colors:
  night-950: "#061019"
  night-900: "#081721"
  night-850: "#0d1c27"
  night-800: "#12232e"
  night-750: "#182b36"
  steel-500: "#60727c"
  steel-400: "#80919a"
  steel-300: "#a8b5bb"
  steel-200: "#cbd4d6"
  paper: "#f4f0e7"
  paper-bright: "#fffdf7"
  mint: "#a2edce"
  mint-bright: "#c7f6e2"
  mint-ink: "#0a261d"
  coral: "#f17e8b"
  coral-soft: "#3a2029"
  amber: "#ebc478"
  amber-soft: "#352b1b"
  line-soft: "#1b2c36"
  line: "#2c414d"
  line-strong: "#4c626d"
  allow-bg: "#16372d"
  product-bg: "#0c1b25"
  product-raised: "#122732"
  product-sunken: "#08141d"
  product-line: "#2a424d"
  product-soft-line: "#1c323d"
  product-ink: "#f7f3ea"
  product-secondary: "#b4c2c7"
  product-faint: "#7f929a"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: "clamp(3.15rem, 14vw, 5.25rem)"
    fontWeight: 555
    lineHeight: 0.93
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: "clamp(2.7rem, 10vw, 5.75rem)"
    fontWeight: 510
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: "clamp(2rem, 8vw, 3.75rem)"
    fontWeight: 510
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.012em"
  label:
    fontFamily: 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace'
    fontSize: "0.75rem"
    fontWeight: 520
    letterSpacing: "0.08em"
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  lg: "1rem"
  xl: "1.5rem"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
  "10": "2.5rem"
  "12": "3rem"
  "16": "4rem"
  "20": "5rem"
  "24": "6rem"
components:
  button-primary:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.mint-ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.125rem"
    height: "48px"
  button-primary-hero:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.mint-ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.4rem"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.mint-bright}"
    textColor: "{colors.mint-ink}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.night-900}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.125rem"
    height: "48px"
  policy-field:
    backgroundColor: "{colors.product-raised}"
    textColor: "{colors.product-ink}"
    rounded: "{rounded.md}"
    padding: "1.15rem"
  product-panel:
    backgroundColor: "{colors.product-bg}"
    textColor: "{colors.product-ink}"
    rounded: "{rounded.lg}"
    padding: "1rem"
  badge-block:
    backgroundColor: "rgb(241 126 139 / 0.12)"
    textColor: "{colors.coral}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.45rem"
  badge-review:
    backgroundColor: "rgb(235 196 120 / 0.12)"
    textColor: "{colors.amber}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.45rem"
  badge-active:
    backgroundColor: "rgb(162 237 206 / 0.10)"
    textColor: "{colors.mint}"
    rounded: "{rounded.sm}"
    padding: "0.28rem 0.45rem"
---

# Design System: Warden

## Overview

**Creative North Star: "The Policy Control Track"**

The Policy Control Track treats each connected AI request as an event moving through a modern control room: dark material, sharp evidence, one luminous decision at a time. It combines the pace of racing telemetry with editorial scale, so a manager can understand the rule, the decision, and the record without reading a dashboard full of equal-weight cards.

The page is mobile-first and direct. Large sans statements provide momentum; mono captions, timestamps, rule IDs, and tallies make the evidence feel operational. The official sculpted silver-and-mint shield is the physical checkpoint and remains the only heroic object. Motion explains a request crossing policy, then settles so the reader can inspect the result.

The system is dark and continuous across marketing and product scenes. Surfaces separate through near-night tonal steps, hairlines, and restrained depth. Coral is block, amber is human review or hold, and mint is protection, activation, allow, and the primary action. Every state also carries words or symbols.

**Key Characteristics:**

- Asymmetric editorial compositions anchored by immediate mint download actions.
- One dark control material spanning the landing, policy editor, terminals, and decision record.
- Large system-sans statements paired with compact mono telemetry.
- Semantic coral, amber, and mint states reinforced by labels and icons.
- Finite, causal motion with complete reduced-motion and no-JavaScript states.
- Mobile-first evidence that remains readable at 20rem.

## Colors

Warden uses a deep blue-black neutral ramp, warm paper text, and three bright semantic signals whose meaning never drifts.

### Primary

- **Warden Mint:** The brand and protection signal. Use it for primary downloads, active rules, allowed requests, guidance, focus rings, and the shield's live edge.
- **Signal Mint:** The brighter hover response for mint actions; it is feedback, not a second brand color.
- **Mint Ink:** High-contrast text and icon color on solid mint controls.

### Secondary

- **Block Coral:** The only refusal and policy-block signal. It marks blocked verdicts, rule badges, routes, and matching evidence.
- **Banked Coral:** A low-energy coral plane for blocked-state containers where a solid signal would overwhelm the evidence.

### Tertiary

- **Review Amber:** The only human-review, escalation, held-request, and budget-attention signal.
- **Banked Amber:** The quiet review surface beneath amber evidence.

### Neutral

- **Night Track:** The five-step `night` scale runs from the page background through raised, hover, and selected surfaces without breaking the dark atmosphere.
- **Steel Telemetry:** The four-step `steel` scale separates faint metadata, supporting copy, borders, and low-priority marks.
- **Warm Paper:** `paper` carries body copy and `paper-bright` carries decisive headlines; both avoid the cold glare of pure interface white.
- **Control Hairlines:** `line-soft`, `line`, and `line-strong` define nested structure before shadow does.
- **Product Material:** The `product` surfaces and text tones form one slightly lighter product plane for the editor, terminals, decision log, and usage evidence.

**The Three Verdict Rule.** Coral always means block, amber always means review or hold, and mint always means active or allow. Pair each with explicit text, an icon, or both.

**The Dark Continuity Rule.** Marketing and product evidence share one dark material; do not insert detached white or beige application panels.

## Typography

**Display Font:** System sans (`-apple-system`, BlinkMacSystemFont, Segoe UI, Inter fallback, sans-serif)

**Body Font:** System sans (`-apple-system`, BlinkMacSystemFont, Segoe UI, Inter fallback, sans-serif)

**Label/Mono Font:** System mono (`ui-monospace`, SFMono-Regular, SF Mono, Menlo, Consolas, monospace)

**Character:** The sans face is compact, contemporary, and slightly tightly tracked at every scale. Huge statements create the editorial rhythm; mono text makes operational facts feel measured rather than decorative.

### Hierarchy

- **Display** (555, `clamp(3.15rem, 14vw, 5.25rem)`, 0.93): The hero statement. It grows at 48rem, becomes a wide-screen clamp at 64rem, and reaches 8rem only beyond 100rem.
- **Headline** (510, `clamp(2.7rem, 10vw, 5.75rem)`, 0.98): Section-level arguments and the closing sentence.
- **Title** (510, `clamp(2rem, 8vw, 3.75rem)`, 1.02): One clear idea per story beat; wide screens can grow this role to 4.5rem.
- **Body** (400, 1rem, 1.55–1.6): Explanations, ledes, and scene narration. Keep readable measures around 52–57 characters and use balanced or pretty wrapping on prominent prose.
- **Label** (520, 0.75rem, 0.08em, uppercase): Chapter captions and structural labels. Dense product telemetry may step down to 0.6875rem with generous leading, but critical evidence must remain readable on mobile.

**The Statement and Evidence Rule.** Use the sans face for what Warden means and the mono face for what Warden measured: times, rule IDs, counts, limits, platforms, and audit references.

**The Readable Telemetry Rule.** Keep essential product evidence at or above 0.6875rem, increase line-height in terminals, and reflow dense rows on narrow screens instead of shrinking them further.

## Layout

The page is mobile-first, with a 20rem minimum viewport and a centered frame capped at 90rem. Side gutters start at 1.125rem and become 2rem at 48rem; the frame can expand to 104rem beyond 100rem. Vertical sections use a generous 5–9rem rhythm on larger screens and a tighter 4.25rem rhythm on phones.

The hero begins as a single column with the download directly below the promise and the interactive policy checkpoint below it. At 64rem it becomes an asymmetric `0.8fr / 1.2fr` composition: concise editorial copy on the left and the larger working control surface on the right. The hero occupies the available viewport beneath the sticky header without forcing content into a fixed canvas.

Story chapters stack caption, controls, narration, and evidence on small screens. At 64rem they become alternating two-column spreads with a narrower narration rail and a larger evidence plane. This alternation creates track rhythm while keeping DOM and reading order straightforward. Product chrome expands at 40rem; dense decision rows reflow at 26rem; the illustrated checkpoint has fixed CSS scale fallbacks down to 22.5rem.

**The Download Before Demonstration Rule.** The primary platform download is visible before the interactive evidence and never waits for a verdict animation to finish.

**The Native Track Rule.** Keep browser-native vertical scrolling. Chapters may play once when sufficiently visible, but they never pin the viewport, trap the wheel, or require playback to reveal the complete story.

## Elevation & Depth

Warden combines tonal layering with a small shadow hierarchy. Night and product surfaces establish most depth; 1px hairlines define internal structure. Shadows belong to authored objects that need physical presence: the hero control surface, product panels, the film dialog, diagram cards, and the official shield. Semantic light appears as a narrow route, ring, or localized glow around a policy event rather than a general ambient effect.

### Shadow Vocabulary

- **Primary Action** (`0 0.75rem 2.5rem rgb(0 0 0 / 0.28)`): Gives the immediate hero download enough weight to lead the page.
- **Product Plane** (`0 1.6rem 4rem rgb(0 0 0 / 0.30)`): Separates complete editor, terminal, and log surfaces from the track.
- **Interactive Checkpoint** (`0 1.5rem 5rem rgb(0 0 0 / 0.34)`): Grounds the hero policy field while it responds to pointer position.
- **Modal Focus** (`0 2rem 6rem rgb(0 0 0 / 0.62)`): Reserves the deepest shadow for the launch-film dialog.
- **Shield Mass** (`drop-shadow(0 1.8rem 2.2rem rgb(0 0 0 / 0.46))`): Gives the sculpted identity physical weight without adding another container.

**The Tonal Before Shadow Rule.** Separate nested information with dark tonal steps and hairlines first; use shadow only when an entire object must sit above the track.

**The Finite Lift Rule.** Hover lift is subtle and temporary. Once a sequence settles, panels stay still and readable.

## Shapes

The form language is precise industrial hardware with gently rounded handling surfaces. Shared radii are small (0.375rem), medium (0.625rem), large (1rem), and extra large (1.5rem). Buttons use the medium radius, primary product panels use the large radius, and state chips stay compact. Signature control surfaces may use intermediate 0.75rem, 0.875rem, and 1.125rem corners when their scale warrants it.

Most structure comes from 1px borders. Circular geometry is reserved for live-state dots, verdict icons, shield rings, and large atmospheric arcs. Request and decision objects may rotate by roughly 2–5 degrees inside diagrams to imply movement through the checkpoint; general cards remain square to the reading grid.

**The Hairline Hardware Rule.** Use one-pixel cool-steel borders and small radii for precision; reserve circles and slanted planes for policy flow and state.

## Components

Components feel controlled and tactile. Every interactive target is at least 44px high, focus is a visible 2px mint outline, and fine-pointer hover states are optional enhancements rather than required feedback.

### Buttons

- **Shape:** Gently rounded rectangle (0.625rem) with a 1px border and a 48px minimum target.
- **Primary:** Solid Warden Mint with Mint Ink, 0.75rem × 1.125rem padding, 0.875rem type at weight 620. The hero version is 56px high with 1.4rem horizontal padding.
- **Hover / Focus:** Brighten to Signal Mint and use the global mint focus outline. Press by translating 1px and scaling to 0.985; download cards may lift 2px on fine pointers.
- **Secondary:** Night surface with warm paper text and a strong steel border. Hover raises the surface tone and border contrast.

### Chips

- **Block:** Coral text on a 12% coral tint, uppercase, compact, and always labeled `BLOCK` or `Blocked`.
- **Review / Held:** Amber text on a 12% amber tint, labeled `REVIEW`, `Held`, or the explicit review action.
- **Active / Allow:** Mint text on a 10% mint tint. Draft and skipped states stay neutral so activation remains unmistakable.

### Cards / Containers

- **Corner Style:** Large product panels use 1rem corners; inner request, verdict, and composer cards use 0.75rem; download cards use 0.875rem.
- **Background:** Use the product background for evidence planes, the raised product tone for working areas, and the sunken tone for bars and chrome.
- **Shadow Strategy:** Apply Product Plane shadow to the complete object, never to every row inside it.
- **Border:** One-pixel product lines separate the outer panel; softer hairlines divide rows.
- **Internal Padding:** Start at 1rem and increase to 1.25–1.5rem as the viewport permits.

### Inputs / Fields

- **Style:** The policy composer is a raised dark plane with a transparent textarea, warm product ink, and 1.05–1.45rem text. Its height stays stable while the scene advances.
- **Focus:** Use the global 2px mint focus treatment on real editable fields. Read-only story fields must not pretend to accept input.
- **Error / Disabled:** Use neutral faint text for inactive or skipped states. Reserve coral for an actual block decision, not generic disabled chrome.

### Navigation

The sticky header uses the official Warden lockup, muted 0.875rem links, and a compact mint download action. Links have 44px targets, brighten to paper on fine-pointer hover, and collapse to the brand plus download on small screens. Story navigation is a three-step native button row with a 2px mint underline and explicit pressed state; replay sits alongside it.

### Interactive Policy Trace

The hero's signature surface joins a connected request, the official shield, and the resulting decision with a decaying policy trace. Fine-pointer movement reveals the local field; click and tap run a complete request-to-verdict event and change the shared semantic state. The canvas sleeps while idle or offscreen. Reduced motion removes the trace and tilt while leaving the complete decision readable.

### Product Evidence Scenes

The policy editor, connected-tool terminal, decision ledger, and usage ceiling use one product material. Each scene advances through three finite beats, provides manual steps and replay, and stops autoplay after manual interaction. Full policy definitions and technical identifiers live in expandable details or compact metadata rather than crowding the main narrative.

### Official Shield

Use the supplied sculpted silver-and-mint 3D shield and its supplied fallback image. Its entrance is finite, its fine-pointer response is subtle, and rendering pauses offscreen. Reduced-motion and low-capability contexts show the complete static fallback.

**The One Action First Rule.** A scene can offer secondary links after its verdict settles, but the primary download is present from first paint and its space never shifts.

**The Readable Rest Rule.** Motion exists to explain cause and effect. After activation, blocking, review, or logging, hold the full state flat long enough to read.

**The Honest Fallback Rule.** No-JavaScript and reduced-motion experiences show complete content and real native controls; they do not expose instructions for interactions that are unavailable.

## Do's and Don'ts

### Do:

- **Do** place a direct platform download above the hero demonstration and repeat concrete macOS and Windows downloads near the closing shield.
- **Do** show the full describe, review, and activate sequence, keeping drafts visibly distinct from rules a manager has activated.
- **Do** reinforce block, review, and allow with words, icons, counts, or layout in addition to coral, amber, and mint.
- **Do** use the official Warden lockup and sculpted shield assets without redrawing their identity.
- **Do** say `Codex` in customer-facing copy and name only tools whose connection the product supports.
- **Do** let reduced-motion and no-JavaScript visitors read every claim, result, and example without waiting for a sequence.
- **Do** preserve native scrolling, 44px interaction targets, and readable product evidence at the narrowest supported viewport.
- **Do** describe local policy checks, configured providers, human review, hash-chained records, and reported usage limits with the precise qualifiers established in the product.

### Don't:

- **Don't** invent testimonials, customers, benchmarks, installer URLs, or product evidence.
- **Don't** imply universal tool interception, zero data leaving the computer, tamper-proof records, or guaranteed hard spend caps.
- **Don't** introduce disconnected white or beige product surfaces into the dark control track.
- **Don't** add generic particles, constant ambient motion, scroll traps, or letter-by-letter headline animation.
- **Don't** delay, move, or hide the primary download while the hero verdict plays.
- **Don't** use semantic color without an accompanying label, icon, or legible state description.
- **Don't** crowd the editorial rail with full policy language or long technical identifiers when an expandable detail or evidence plane can carry them.
