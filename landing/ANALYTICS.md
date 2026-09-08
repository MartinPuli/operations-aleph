# Launch measurement

The landing uses explicit PostHog events for visitor behavior and GitHub release-asset counters for installer downloads. These measure different steps of the launch; neither establishes installations or unique people.

- PostHog project: [Warden Website · project 544788](https://us.posthog.com/project/544788/home).
- Dashboard: [Warden · Launch](https://us.posthog.com/project/544788/dashboard/2075187).
- Production landing: [warden-theta.vercel.app](https://warden-theta.vercel.app/).
- Implementation: [`analytics-entry.js`](analytics-entry.js), [`analytics-config.js`](analytics-config.js) and [`analytics.js`](analytics.js).
- GitHub reporter: [`scripts/release-downloads.mjs`](../scripts/release-downloads.mjs).

**Publication status:** this setup has not been deployed to production. The analytics code must be published with the landing before real visitors can generate these events. Configuring PostHog or sending a localhost test does not publish the site. The dashboard is built with eight saved reports, each series excluding tests with `is_test != true`.

**Verified September 8, 2026:** PostHog stored 12 events from an explicit localhost test: one pageview, three section views, one download-options opening, one film opening, one playback start, four playback milestones and one film completion. The pageview retained the four campaign labels and `is_test: true`; PostHog assigned a cookieless identifier and session. Turning the internal/test filter on changed the event list from 12 entries to no matching events. The exclusion is saved as the default for new insights and applied to existing insights. Normal localhost loaded neither analytics SDK nor a test badge. The 25 focused analytics/download-reporter tests pass. Installer-link classification and navigation are covered by fixtures; no installer was downloaded for this verification.

## Free billing setup

Browser billing settings confirmed the account is on **Free**, with a **1,000,000-event monthly product-analytics allowance and a 1,000,000-event billing limit**. No paid plan was purchased. Paid usage requires an explicit upgrade/card setup. PostHog’s [current pricing](https://posthog.com/pricing) states that Free usage stops at its allowance rather than generating an unexpected charge.

## What each number means

| Metric | Source | Interpretation |
| --- | --- | --- |
| Page views | PostHog `$pageview` | Instrumented page loads. Reloads can count again; this is not a count of unique people. |
| Installer click | PostHog `download_clicked` | A visitor activated a direct macOS or Windows installer link. It does not prove the file finished downloading. |
| Releases opened | PostHog `release_page_opened` | A visitor opened GitHub Releases, including the Linux/other-builds route. It is not an installer download. |
| Installer downloads | GitHub asset-counter increase | Downloads recorded for primary installer assets during the measured interval, including traffic that never visited this landing. Repeated and automated downloads can count. |
| Installs, unique people, active users | Not measured here | Neither a browser click nor a GitHub asset download establishes these. No app installation or activation telemetry is added by this setup. |

PostHog can show the campaign’s visit-to-click behavior. GitHub supplies a separate aggregate download total. There is no person-level join between them, so do not present GitHub downloads as downloads attributed exclusively to X, or divide them by landing visitors and label the result an installation conversion rate.

## Events

Every captured event carries `site_version`, `page_path`, `is_test`, allowed UTM values and a referrer domain. Properties are rebuilt from an allowlist before sending.

| Event | Trigger and useful properties |
| --- | --- |
| `$pageview` | Once when analytics initializes for that document. |
| `download_clicked` | Trusted activation of an exact installer link; `platform` is `macos` or `windows`, with `placement`. |
| `download_options_opened` | Activation of the page’s `#download` link; `placement`. |
| `release_page_opened` | Activation of the repository’s Releases/latest page; `placement`. |
| `outbound_clicked` | GitHub, report or benchmark link; allowlisted `destination` and `placement`. |
| `section_viewed` | At least 15% of a tracked section is visible for 800 ms in a foreground document; once per section per page, with `section`. |
| `story_step_selected` | A visitor selects a chapter step; `chapter` and zero-based `step` (0, 1 or 2). Autoplay does not emit this event. |
| `story_replayed` | A visitor presses Replay; `chapter`. |
| `tool_selected` | A trusted radio change; `tool` is `claude_code`, `codex` or `opencode`. Programmatic cycling is excluded. |
| `video_opened` | Activation of Watch the film; `video: launch` and `placement`. Opening interest is distinct from playback. |
| `video_started` | First actual `playing` event after opening the film. |
| `video_progress` | Once at 25%, 50%, 75% and 90% of accumulated, non-overlapping played coverage; `percent`. Seeking forward alone does not count as watching. |
| `video_completed` | The film ends after at least 90% played coverage; once per page. |

Chapter values are `write`, `hit`, `log` and `spend`. Event failures do not block the story, intercept navigation or prevent a download. DNT and content blockers can leave measurement incomplete.

## Production, tests and privacy

The configured production host is exactly `warden-theta.vercel.app`. Normal localhost sessions and other preview hosts do not send events. For an explicit local network test, open the local server with:

```text
http://localhost:4173/?analytics_test=1
```

This opt-in sends events to the project with **`is_test: true`** and displays a local debug panel. The flag is for localhost testing, not a production campaign parameter. Do Not Track still disables capture.

**Every production dashboard, insight and campaign comparison must exclude tests with `is_test != true`.** The eight saved dashboard reports apply this filter to every series. Inspect test events separately with `is_test = true`; do not include them in launch totals.

The PostHog project is configured for cookieless capture. The browser configuration uses memory-only state, disables persistence, requests no person profiles and disables session recordings, autocapture, heatmaps, surveys, performance capture and exception capture. There are no identify calls or captured raw prompts, textarea content or arbitrary DOM text. The browser user-agent is sent only as required input for PostHog’s cookieless processing; PostHog strips raw user-agent and IP after hashing. Fixed categories for browser, OS and device type remain available; client-generated session/device IDs are not forwarded.

Full raw URLs are not retained as event properties: the page path is normalized to `/`, only page/referrer origins and referrer domains remain, and query strings are discarded except four sanitized UTM fields. Accepted UTM values are lowercased letters, digits, underscores and hyphens, at most 60 characters. Cookieless event counts should not be represented as verified unique people. The browser project token is a public ingestion token; personal/admin API keys do not belong in the landing.

## X launch link

Use the same link in the launch post so the landing events can be filtered consistently:

[Warden X launch](https://warden-theta.vercel.app/?utm_source=x&utm_medium=organic_social&utm_campaign=warden_launch&utm_content=film_v10)

```text
utm_source=x
utm_medium=organic_social
utm_campaign=warden_launch
utm_content=film_v10
```

In PostHog, combine those properties with `is_test != true` and the actual launch time window. Compare page views, direct download clicks by platform, Releases opens and film progress. Use the GitHub interval report for the separate installer-download goal.

## Existing GitHub reference snapshot

[`warden-baseline-2026-09-08.json`](../output/metrics/warden-baseline-2026-09-08.json) completed at **2026-09-08T08:19:20.560Z**. It scans all published releases, including prereleases and excluding drafts.

| Cumulative counter at that time | Downloads |
| --- | ---: |
| macOS primary installers | 83 |
| Windows primary installers | 19 |
| Linux primary installers | 0 |
| **Primary installers total** | **102** |
| All uploaded release assets | 123 |

These are historical cumulative counters, not downloads on September 8 and not a launch-day result. The 21 additional downloads are archives/update assets excluded from the conservative installer metric. Take a fresh baseline at the actual launch.

## Measure the actual launch interval

Run from the repository root using the repository’s Node environment. The public GitHub API works without a token; an existing `GH_TOKEN` can raise its allowance. The reporter reads public counters and does not modify releases.

Immediately before the actual launch, save a new baseline:

```bash
node scripts/release-downloads.mjs --save output/metrics/warden-launch-baseline.json
```

Near 24 hours later, capture another snapshot and its comparison:

```bash
node scripts/release-downloads.mjs --since output/metrics/warden-launch-baseline.json --save output/metrics/warden-launch-plus-24h.json --json > output/metrics/warden-launch-24h-report.json
```

Use new filenames for a new launch; `--save` refuses to overwrite a snapshot. Its saved file is the snapshot accepted by `--since`; `--json` prints a report containing the snapshot and optional comparison.

Read `comparison.known_delta.installer_downloads` together with `complete`, `issues`, the capture timestamps and `interval_hours`. Counters are matched by asset ID. Missing assets, resets or newly visible older assets are reported as unknown rather than silently subtracted or treated as zero. Primary installers are DMG/PKG, setup/installer EXE/MSI and DEB/RPM/AppImage; archives and updater files remain separate.

For a strict **1,000 installer downloads within one day** claim, inspect `goal.reached_within_observed_24h_window`. The reporter uses the outer bounds of both scans, so the follow-up must finish within 24 hours of the first scan’s start; allow for API capture time. A longer interval must be reported at its actual length. An incomplete comparison is a known lower bound, and no snapshot can reconstruct deleted historical counters or deduplicate people.

No recurring job or scheduled automation is created by these commands. They are manual launch-time and follow-up measurements.
