---
name: Warden
description: White brand identity, sculptural silver objects, and clear light product surfaces.
colors:
  white: "#ffffff"
  white-hover: "#e4e4df"
  white-ink: "#17181b"
  studio: "#f1f1ee"
  night-950: "#101113"
  night-900: "#151619"
  night-850: "#1b1d20"
  night-800: "#222428"
  night-750: "#2a2c30"
  steel-500: "#777b83"
  steel-400: "#969ba3"
  steel-300: "#b5b8be"
  steel-200: "#d5d7db"
  paper: "#f2f2ef"
  line-soft: "#2b2d31"
  line: "#393c41"
  line-strong: "#62666d"
  coral: "#f17e8b"
  amber: "#ebc478"
  studio-block: "#ba354b"
  product-bg: "#ffffff"
  product-raised: "#f5f5f3"
  product-sunken: "#ededeb"
  product-line: "#d7d7d2"
  product-soft-line: "#e5e5df"
  product-ink: "#17181a"
  product-secondary: "#50535a"
  product-faint: "#646870"
  product-block: "#ac3036"
  product-block-soft: "#fff0ef"
  product-review: "#80550a"
  product-review-soft: "#fff5df"
typography:
  display:
    fontFamily: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(3.35rem, 15vw, 6rem)"
    fontWeight: 600
    lineHeight: 1.01
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(2.7rem, 10vw, 5.75rem)"
    fontWeight: 550
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  title:
    fontFamily: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(2rem, 8vw, 3.75rem)"
    fontWeight: 550
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  body:
    fontFamily: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
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
  md: "0.375rem"
  lg: "1rem"
  xl: "1.5rem"
  product: "0.25rem"
  product-control: "0.2rem"
  badge: "0.15rem"
  request: "10px"
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
    backgroundColor: "{colors.white}"
    textColor: "{colors.white-ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.125rem"
    height: "48px"
  button-primary-hero:
    backgroundColor: "{colors.white}"
    textColor: "{colors.white-ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
    height: "58px"
  button-primary-hover:
    backgroundColor: "{colors.white-hover}"
    textColor: "{colors.white-ink}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.night-900}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.125rem"
    height: "48px"
  button-product:
    backgroundColor: "{colors.product-ink}"
    textColor: "{colors.product-bg}"
    rounded: "{rounded.product-control}"
    padding: "0.7rem 0.85rem"
    height: "44px"
  policy-field:
    backgroundColor: "{colors.product-raised}"
    textColor: "{colors.product-ink}"
    padding: "1.5rem 1rem 1rem"
  product-panel:
    backgroundColor: "{colors.product-bg}"
    textColor: "{colors.product-ink}"
    rounded: "{rounded.product}"
  badge-block:
    backgroundColor: "{colors.product-block-soft}"
    textColor: "{colors.product-block}"
    rounded: "{rounded.badge}"
    padding: "0.22rem 0.45rem"
  badge-review:
    backgroundColor: "{colors.product-review-soft}"
    textColor: "{colors.product-review}"
    rounded: "{rounded.badge}"
    padding: "0.22rem 0.45rem"
---

# Design System: Warden

## Overview

**Creative North Star: "Warden White Studio"**

White is Warden's brand. A large silver-and-white shield carries the identity with real geometry, neutral metal lighting, and room around its silhouette. Charcoal provides the stage for this object and the white download action; the product story opens into a light studio with white working surfaces, dark text, and deliberate whitespace.

The interface is modern, clean, and readable. Manrope gives the large statements and product copy one consistent voice. Fine rules, aligned rows, compact labels, and restrained red and amber verdicts help the reader follow a request from policy to decision. Depth belongs primarily to the sculpted shield and the request illustration; the product itself remains flat and steady.

This is a code-led system documenting the user's white brand direction and the current implementation, not a claim of an approved visual comp. The active sources are `landing/foundation-v2.css`, `landing/experience-v2.css`, and `landing/product-scenes-v2.css`, loaded by `landing/index.html`. Older unused styles are not visual authority. `PRODUCT.md` remains the source of product truth.

**Key Characteristics:**

- White brand actions and a sculptural silver-and-white official shield.
- A charcoal hero and closing frame surrounding a spacious light product story.
- Self-hosted Manrope paired with compact system-mono evidence.
- Flat white product canvases, quiet chrome, and aligned information rows.
- Red for block, amber for review, and neutral active or allow states, always labeled.
- Finite explanatory motion, native controls, and complete static fallbacks.

## Colors

The palette is neutral and white-led. Semantic color has a specific decision to communicate; it does not tint the whole brand or product.

### Primary

- **Warden White:** The brand signal, primary download fill, and bright identity detail on charcoal. White Hover supplies a quiet hover response; White Ink provides dark text on these actions.
- **Neutral activation:** Product actions invert the relationship with Product Ink on white. Active rules and allowed requests use neutral ink, gray, or white appropriate to the surface.

### Secondary

- **Block Red:** Coral is the bright refusal signal on charcoal; Studio Block supplies the larger refusal accent in the light explanatory section. Product Block and its pale surface are the dedicated pair for light badges, terminal refusals, and selected blocked rows.

### Tertiary

- **Review Amber:** Amber communicates review or hold on charcoal. Product Review and its pale surface carry that same meaning on light interfaces, including usage attention. Use the light-product pair for light evidence even inside the charcoal spend section.

### Neutral

- **Charcoal:** The Night scale provides the hero, sticky header, spend section, closing frame, and secondary action surfaces without a blue or teal cast.
- **Studio:** A softly off-white field gives the explanatory story a distinct light environment.
- **Product White:** Product Background is the working canvas; Product Raised and Product Sunken distinguish writing areas, bars, and interactive chrome.
- **Product Ink:** The three product text tones distinguish primary content, supporting copy, and metadata. Product Line and Product Soft Line separate panels and rows.
- **Paper and Steel:** Paper carries text on charcoal; the Steel scale gives supporting text, metadata, and structural marks an appropriate hierarchy.

**The White Identity Rule.** White and neutral metal carry Warden's brand. Do not introduce green, mint, or teal as brand, action, activation, or lighting accents.

**The Labeled Verdict Rule.** Red means block and amber means review or hold. Active and allow stay neutral. Pair every verdict with explicit words, an icon, or both; choose the dedicated semantic tokens for its light or dark surface.

## Typography

**Display Font:** Manrope with system sans fallbacks.

**Body Font:** Manrope with system sans fallbacks.

**Label/Mono Font:** System mono (`ui-monospace`, SFMono-Regular, SF Mono, Menlo, Consolas, monospace).

Manrope is self-hosted in `landing/assets/brand/Manrope-Variable.ttf`, with its local `Manrope-OFL.txt` license. The font face supports weights 200–800 and uses `font-display: swap`. Retain that local loading and immediate fallback behavior.

### Hierarchy

- **Display:** The hero's weight-600 statement contrasts muted setup text with white enforcement text. Its base clamp is defined above; at 48rem it uses 6rem, at 64rem it uses `clamp(5rem, 7.35vw, 6.5rem)`, and beyond 100rem it uses 7rem.
- **Headline:** Section statements use weight 550 and tight leading. The light introductory statement uses weight 600 and `clamp(2.7rem, 5.2vw, 5rem)`.
- **Title:** Story arguments use weight 550; at 64rem the title clamp becomes `clamp(2.7rem, 3.5vw, 3.7rem)`.
- **Body:** Explanations use 1rem with 1.55–1.6 leading and roughly 52–57-character measures. The policy description is larger; compact product rows become 0.8125–0.875rem when the layout has room to align them.
- **Label:** Chapter and structural labels use the mono role. Product controls and badges use Manrope. Terminal evidence uses 0.75rem with 1.75 leading on phones, growing to 0.8125rem on larger screens.

**The Statement and Evidence Rule.** Use Manrope for statements and interface content; reserve mono for times, rule IDs, counts, limits, platforms, and audit references.

**The Readable Evidence Rule.** Reflow dense rows and wrap technical strings on narrow screens. Keep compact badges and secondary references at or above 0.6875rem, and keep request and decision copy larger.

## Layout

The page supports a minimum viewport of 20rem. Its content frame is capped at 90rem, with side gutters of 1.125rem that become 2rem at 48rem. Beyond 100rem the frame cap becomes 100rem. Sections use a 5–8rem vertical rhythm on larger screens and 4.25rem on phones.

The hero is an open composition with the official shield directly on the charcoal stage. Copy, white action, and the illustration stack on small screens. At 64rem the grid becomes `0.88fr / 1.12fr`, giving the large shield the greater share of space. The request is a small angled light sheet; the verdict, evidence line, and action hint sit directly on the stage. Do not wrap the hero object in another dashboard panel.

The product story uses a light section with generous separation between chapters. Caption, native steps, narration, and evidence stack on phones. At 64rem the chapters alternate a narrower text rail and a larger evidence plane, with native reading order retained. The spend section returns to charcoal while its terminal and usage evidence remain white. The closing frame pairs the silver shield with concrete platform downloads.

Product chrome expands at 27rem and 40rem; decision rows become horizontal at 40rem and gain optional rule references at 90rem. Technical content wraps instead of forcing the page wider. The explanatory shield illustration has fixed no-JavaScript scale fallbacks at 32.5rem, 26.875rem, and 22.5rem.

**The Immediate Download Rule.** The primary platform download is visible from first paint, before the demonstration, and never moves or waits for a verdict sequence.

**The Native Scroll Rule.** Keep browser-native vertical scrolling. Chapters can play once when visible; they never pin the viewport, trap the wheel, or require playback to reveal the complete story.

## Elevation & Depth

The silver shield supplies the strongest sense of volume through actual geometry and neutral illumination. The hero's surrounding field is unboxed. Product surfaces are nearly flat: white and pale gray planes, one-pixel dividers, and one faint shadow around a complete editor, terminal, or log. Rows have no individual elevation or resting tilt.

### Shadow Vocabulary

- **Product Plane** (`0 1rem 3rem rgb(23 24 26 / .045)`): A faint boundary around a complete product surface.
- **Hero Request** (`0 1.5rem 3rem rgb(0 0 0 / .22)`): Lifts the small light request sheet beside the shield.
- **Illustrated Object** (`0 20px 40px rgb(22 24 28 / .12)`): Grounds request and decision objects in the light explanatory illustration.
- **Hero Shield** (`drop-shadow(0 2.5rem 2rem rgb(0 0 0 / .38))`): Gives the unboxed sculpted identity physical weight.
- **Modal Focus** (`0 2rem 6rem rgb(0 0 0 / .62)`): Reserves deep elevation for the native film dialog.

**The Flat Product Rule.** Separate product content through spacing, alignment, tonal surfaces, and hairlines. Keep rows and panels steady at rest and on hover; reserve physical staging for the shield illustration.

## Shapes

The working interface uses small, precise corners. Shared buttons use the medium radius, which is now the same as the small radius. Product panels use 0.25rem, product actions 0.2rem, and verdict badges 0.15rem. The hero request uses 10px corners, explanatory illustration sheets use 12px, and closing download cards use 0.875rem. The larger shared radii remain available for objects such as the film dialog; they do not define every product surface.

One-pixel borders and horizontal rules provide structure. Circles are reserved for state dots, verdict symbols, and chapter indices. A slight rotation belongs to the illustrated request and decision sheets. The official shield silhouette and internal mark must preserve the supplied geometry.

## Components

Controls are direct and restrained. Interactive targets are at least 44px high. Focus uses a visible 2px outline: white on charcoal and dark ink in the light story and product panels. Selection in the light story uses dark ink behind white text. A fine-pointer hover is an enhancement; keyboard and touch access remain complete.

### Buttons

- **Primary download:** White fill, dark ink, weight 620, and a 48px minimum target. The hero variant is 58px high with 1.5rem horizontal padding and 1rem type.
- **Secondary:** Charcoal surface with paper text and a stronger neutral border. Hover raises the surface and border contrast.
- **Product action:** Dark Product Ink on white, a 44px target, and compact corners. Draft and activate are explicit actions; hover changes the fill to a lighter charcoal.
- **State:** Primary hover uses White Hover. Shared buttons press by moving 1px and scaling to 0.985. Focus must stay visible against the enclosing surface.

### Chips and Status

Block and review badges use their dedicated light-product text and pale background pairs, compact uppercase labels, and no glow. Active status is a neutral check and label; drafts and skipped states use quieter neutral text. Do not invent a colored active badge to replace the actual inline status.

### Cards / Containers

The editor, connected-tool terminal, and decision log are continuous white canvases with quiet pale chrome and aligned rows. Use the single Product Plane shadow and outer border, then softer horizontal separators inside. Padding begins at 1rem, grows to 1.5rem, and reaches 1.75rem in larger product layouts. Keep the canvas stable as examples advance.

### Inputs / Fields

The policy composer places large dark text on a quiet pale writing area. The landing's example is a read-only textarea, excluded from the tab sequence; its action advances the illustration. Preserve this distinction instead of implying that visitors are editing or activating a real policy. Rule definitions use native `details` and `summary`, remaining available without JavaScript.

### Navigation

The sticky header uses the official white lockup, muted links, and a white download action. It reduces to the brand plus download on small screens. Story navigation is a three-step native button row with `aria-pressed`, a high-contrast neutral underline, and a replay action. Connected-tool selection uses native radio inputs and associated labels, with a dark active underline and keyboard focus treatment. Keep the native controls and their IDs intact.

### Official Shield and Policy Trace

Use the official silver-and-white 3D shield and the matching rendered `landing/assets/3d/shield-fallback.png`. Preserve the supplied mark geometry; lighting and materials remain neutral. The shield has a finite 1.9-second entrance and subtle fine-pointer response. Rendering sleeps when settled or offscreen and pauses while the document is hidden. Reduced-motion and low-capability paths retain the full static composition.

The hero's pointer field and click or tap event explain one connected request and its verdict. Any semantic trace is brief and local to that event. Keep native vertical touch scrolling, keyboard activation, and assistive-technology click activation; a pointer action must not run twice. The large shield remains the focal object rather than an ornamental collection of particles or rings.

### Product Evidence and Film

Each example uses three finite beats, manual steps, and replay. Manual interaction cancels the old playback sequence, and a visitor's selected connected tool is respected. After a decision, hold the evidence still and readable. Reduced motion and no JavaScript retain the complete rule, result, and record. If the script loads slowly, restore the scripted state only when its controller is ready. The film uses a native dialog and a video with native controls, a lazy source, and a direct-file fallback.

### Analytics Continuity

Visual edits must preserve the purposeful landing funnel: direct downloads, release and outbound links, section views, manual story steps, replay, native tool changes, and film events. Keep existing IDs, section names, and data hooks used by `landing/analytics.js`; autoplay is not a manual step selection. Retain production hostname gating, quiet local previews, explicit local analytics test mode, Do Not Track handling in the PostHog collector, and the existing payload allowlist. Do not add automatic DOM capture, policy text, or new identifying data to the visual interaction layer.

**The Readable Rest Rule.** Motion explains cause and effect, then stops. A visitor must be able to inspect the full decision without chasing moving content.

**The Honest Fallback Rule.** No-JavaScript and reduced-motion experiences show complete content and real native controls; they do not expose instructions for interactions that are unavailable.

## Do's and Don'ts

### Do:

- **Do** lead with white brand actions and the official silver-and-white sculpted shield.
- **Do** give product examples light, flat working surfaces, aligned rows, and readable dark text.
- **Do** use red for block, amber for review, and neutral active or allow states with explicit labels or icons.
- **Do** keep the immediate platform download visible and repeat concrete macOS and Windows downloads near the close.
- **Do** distinguish example drafts from activated rules and keep full rule text available through native disclosures.
- **Do** preserve local Manrope assets and their license, native scrolling, visible focus, and 44px interaction targets.
- **Do** provide complete static evidence for reduced-motion and no-JavaScript visitors.
- **Do** preserve the existing analytics hooks and defer factual product claims to `PRODUCT.md`.

### Don't:

- **Don't** reintroduce green, mint, or teal as Warden's brand, action, status, or shield-lighting direction.
- **Don't** restore the obsolete continuous dark product treatment or let unused legacy styles override the active v2 system.
- **Don't** box the hero shield into another dashboard or give every product row its own card and shadow.
- **Don't** replace the supplied mark geometry or present the current code-led direction as an approved visual comp.
- **Don't** add generic particles, constant ambient motion, scroll traps, or letter-by-letter headline animation.
- **Don't** delay, move, or hide the primary download while the demonstration plays.
- **Don't** convey a verdict by color alone or turn read-only examples into misleading editable controls.
- **Don't** invent product evidence, installer destinations, customers, or analytics payloads for a visual effect.
