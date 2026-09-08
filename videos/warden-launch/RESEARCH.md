# Warden launch video research

Researched September 7, 2026. This is a small primary-source creative sample, not a measurement of what is trending or likely to go viral. Three films were visually inspected. The direction below is editorial judgment from those examples and X's documented video behavior.

## Observed launch examples

| Official reference | Observed approach | Application to Warden |
|---|---|---|
| [Cursor 3](https://cursor.com/blog/cursor-3), April 2, 2026 | About 90 seconds; founder introduction at a desk followed by actual UI close-ups and product outcomes. | Spend meaningful time showing the product, not only branding. |
| [Claude Code on the web](https://www.youtube.com/watch?v=s-avRazvmLg), October 20, 2025 | 60 seconds; two QA bugs and a standup deadline establish a concrete problem, then task assignment and a GitHub PR give a visible payoff. Isolated UI sits on a warm brand background. | Best narrative reference: one recognizable request, Warden's action, and a visible decision record. |
| [Raycast — A New Start](https://www.youtube.com/watch?v=QTcUR5BjN2M), November 2025 | 52 seconds; first-person nostalgic Windows story with interface imagery and a new-start reveal. A longer guide exists separately. | One memorable framing idea belongs in the short film; onboarding detail belongs elsewhere. |
| [Replit Agent 3](https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet), September 10, 2025 | Announcement organized around concrete capabilities and illustrated workflows. Announcement reviewed, video edit not inspected. | Demonstrate an outcome; avoid a list of abstract technical features. |

## X requirements and creative implications

[X organic video help](https://help.x.com/en/using-x/x-videos) documents autoplay, looping for videos of 60 seconds or less, and standard-account uploads up to 140 seconds / 512 MB. The page's listed web limits include 1920×1200 or 1200×1900, 40 fps and 25 Mbps.

[X creative ad specifications](https://business.x.com/en/help/campaign-setup/creative-ad-specifications) recommends captions/text overlays, H.264, AAC, and 30 fps. Its short-duration recommendation (15 seconds or less) concerns advertising; it is not a rule for an organic launch post.

[X Video Tab announcement](https://business.x.com/en/blog/video-tab-launch) establishes a full-screen video discovery surface and emphasis on vertical video. It does not prove portrait software demos outperform landscape or square.

## Production choices for this first cut

- 36 seconds, 1080×1080, 30 fps, H.264/AAC. Square is an editorial choice for readable feed presence with close-up product surfaces, not an X ranking claim.
- Immediate question, visible brand early, one complete workflow, one CTA.
- Product demo and bold captions with music were explicitly selected by the user.
- No narration: the narrative must be fully understandable with sound off. Music and short accents shape pacing.
- Real current light console, framed by Warden's dark title cards. Preserve its actual appearance.
- Retain readable end frame so a sub-minute loop feels intentional.

## Concepts considered

1. **The gate:** a rule becomes the boundary a prompt meets. Product vocabulary, physical line, close-up UI.
2. **Who decides?** A direct question about team AI control, answered by the administrator's words and resulting decision. Selected; strongest clear premise for an unfamiliar product.
3. **One request's story:** start with a stopped request, then rewind to the rule and finish at its record. Strong demonstration but initially gives less context.
4. **A policy is a promise:** editorial letter from an administrator, becoming enforceable actions. Unusual format; slower and more text dependent.
5. **The decision receipt:** an audit record unfolds backward to reveal its cause. Distinctive document-led silhouette; accountability is less immediate than the rule itself for a broad launch audience.

## Claim boundaries

Evidence source: main commit f1d62de, version 0.1.51. The video is a staged demo with fictional policy requests and the deterministic mock adapter; edited timing is not model latency evidence. Production notes preserve the exact capture provenance.

Use: “Your AI tools. Your rules.” / “Local prompt checks.” / “Write a rule. Review. Activate.” / “A record you can inspect.” / “Open source.”

Avoid: flawless protection, instant judgments, verified universal integration support, “nothing ever leaves the machine,” “no prompts stored,” or favorable benchmark numbers. The repository records false positives, unverified hook release gates, optional remote rule compilation, and separate retained masked prompt text. See ../../SECURITY.md, ../../docs/HOOK-VERIFICATION.md, ../../docs/MEASUREMENTS.md and ../../src/qvac/offload.ts.

## Publication

No post has been published or scheduled. The local video and suggested post copy are reviewable launch materials.
