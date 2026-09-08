#!/usr/bin/env node
/** Public GitHub release asset download counts; no write access or dependencies.
 * REST docs: https://docs.github.com/en/rest/releases/releases#list-releases
 * https://docs.github.com/en/rest/releases/assets#list-release-assets
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const API = 'https://api.github.com';
const CATEGORIES = ['macos', 'windows', 'linux', 'update', 'source', 'other'];
const INSTALLERS = new Set(['macos', 'windows', 'linux']);
const DEFAULT_REPO = 'Wardenlabs/warden';
const VALID_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export class ReportError extends Error {}

export function classifyAsset(name) {
  const lower = name.toLowerCase();
  if (/(?:^|[-_. ])(?:source|sources|src)(?:[-_. ]|$)/.test(lower)) return 'source';
  if (/\.(?:nupkg|blockmap)$/.test(lower) || /^(?:releases|latest(?:[-.].*)?\.ya?ml|appcast\.xml)$/i.test(name)) return 'update';
  if (/\.(?:dmg|pkg)$/.test(lower)) return 'macos';
  if (/\.msi$/.test(lower) || /(?:setup|installer|install)[-_.\w ]*\.exe$/.test(lower)) return 'windows';
  if (/\.(?:deb|rpm|appimage)$/.test(lower)) return 'linux';
  // ZIP/tar distributions may be portable apps or updater payloads. Keep them
  // visible, but outside the conservative primary-installer metric.
  if (/\.(?:zip|tar\.gz|tar\.xz|tgz|7z)$/.test(lower)) return 'update';
  return 'other';
}
function totals(assets, countKey = 'download_count') {
  const result = Object.fromEntries(CATEGORIES.map(key => [key, 0]));
  for (const asset of assets) result[asset.category] += asset[countKey];
  return { ...result, installer_downloads: result.macos + result.windows + result.linux,
    all_asset_downloads: CATEGORIES.reduce((sum, key) => sum + result[key], 0) };
}
function timestamp(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new ReportError(`Invalid ${label} timestamp.`);
  return parsed;
}
function validCount(value) { return Number.isSafeInteger(value) && value >= 0; }
function validId(value) { return Number.isSafeInteger(value) && value > 0; }
function safeEndpoint(url, pathname) {
  const parsed = new URL(url, API);
  if (parsed.origin !== API || parsed.pathname !== pathname || parsed.username || parsed.password) {
    throw new ReportError('Rejected an unexpected GitHub pagination URL.');
  }
  return parsed.href;
}
function nextPage(header, pathname) {
  if (!header) return null;
  for (const part of header.split(/,\s*(?=<)/)) {
    if (!/;\s*rel="next"/.test(part)) continue;
    const target = /^\s*<([^>]+)>/.exec(part)?.[1];
    if (!target) throw new ReportError('GitHub returned an invalid pagination link.');
    return safeEndpoint(target, pathname);
  }
  return null;
}
function apiFailure(response) {
  const status = response.status;
  if (status === 401) return new ReportError('GitHub rejected GH_TOKEN. Check its validity or omit it for public data.');
  if (status === 404) return new ReportError('GitHub repository or release was not found. Check --repo and token access.');
  if (status === 403 || status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const retry = Number(response.headers.get('retry-after'));
    const when = Number.isFinite(reset) && reset > 0 && reset < 1e12 ? ` Reset: ${new Date(reset * 1000).toISOString()}.` : '';
    const delay = Number.isFinite(retry) && retry > 0 ? ` Retry after ${retry} seconds.` : '';
    return new ReportError(`GitHub ${status}: ${remaining === '0' || status === 429 ? 'API rate limit reached' : 'access denied or secondary rate limit'}.${when}${delay} GH_TOKEN can increase the public API allowance. No partial report was saved.`);
  }
  return new ReportError(`GitHub API returned HTTP ${status}. Retry later; no partial report was saved.`);
}
async function listAll(pathname, { fetchImpl, token, timeoutMs }) {
  let url = `${API}${pathname}?per_page=100`;
  const seen = new Set();
  const records = [];
  while (url) {
    url = safeEndpoint(url, pathname);
    if (seen.has(url)) throw new ReportError('GitHub pagination repeated a page; refusing an incomplete count.');
    seen.add(url);
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetchImpl(url, { headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      // Never print fetch errors, headers, or the token: third-party errors can
      // include request details. A failed page invalidates the whole scan.
      throw new ReportError('GitHub request failed or timed out. Check connectivity and retry; no partial report was saved.');
    }
    if (!response.ok) throw apiFailure(response);
    let page;
    try { page = await response.json(); } catch { throw new ReportError('GitHub returned invalid JSON. No partial report was saved.'); }
    if (!Array.isArray(page)) throw new ReportError('GitHub returned an unexpected list response.');
    records.push(...page);
    url = nextPage(response.headers.get('link'), pathname);
  }
  return records;
}

export async function collectDownloads({ repository = DEFAULT_REPO, token = process.env.GH_TOKEN,
  fetchImpl = globalThis.fetch, clock = () => new Date(), timeoutMs = 20000 } = {}) {
  if (!VALID_REPO.test(repository)) throw new ReportError('Use --repo OWNER/REPO.');
  const started = clock().toISOString();
  const options = { fetchImpl, token, timeoutMs };
  const releases = await listAll(`/repos/${repository}/releases`, options);
  const uniqueReleases = new Map();
  for (const release of releases) {
    if (!validId(release.id)) throw new ReportError('GitHub returned a release with an invalid ID.');
    if (!release.draft) uniqueReleases.set(release.id, release);
  }
  const byAsset = new Map();
  const releaseRecords = [];
  for (const release of uniqueReleases.values()) {
    const assets = await listAll(`/repos/${repository}/releases/${release.id}/assets`, options);
    const observed = clock().toISOString();
    releaseRecords.push({ id: release.id, tag: release.tag_name, prerelease: Boolean(release.prerelease),
      published_at: release.published_at, observed_at: observed });
    for (const asset of assets) {
      if (!validId(asset.id) || !validCount(asset.download_count) || typeof asset.name !== 'string') {
        throw new ReportError('GitHub returned an invalid asset ID, name or download count.');
      }
      timestamp(asset.created_at, 'asset creation');
      byAsset.set(asset.id, { id: asset.id, release_id: release.id, tag: release.tag_name,
        name: asset.name, category: classifyAsset(asset.name), download_count: asset.download_count,
        created_at: asset.created_at, observed_at: observed, browser_download_url: asset.browser_download_url });
    }
  }
  const assets = [...byAsset.values()].sort((a, b) => a.id - b.id);
  return { schema_version: 1, classification_version: 1, repository,
    capture_started_at: started, captured_at: clock().toISOString(),
    scope: 'All published releases, including prereleases; drafts excluded. Every release and asset list paginated.',
    release_count: uniqueReleases.size, asset_count: assets.length, totals: totals(assets),
    releases: releaseRecords, assets,
    limitations: [
      'Cumulative GitHub release-asset download counters, not installs, unique people, active users or a daily count.',
      'Primary installer metric counts DMG/PKG, setup/installer EXE/MSI, DEB/RPM/AppImage. ZIP/tar archives and updater files are reported separately to avoid combining installer and alternate/update payload counts.',
      'Repeated or automated downloads can increment counters; installer downloads themselves are not deduplicated by person.',
      'GitHub-generated source ZIP/tarball links have no release-asset download_count in this report. Only uploaded source archives can be counted.',
      'Only assets currently visible to this scan are counted. Deleted assets are unavailable, and paginated captures are not atomic.'
    ] };
}
export function validateSnapshot(snapshot) {
  if (snapshot?.schema_version !== 1 || snapshot.classification_version !== 1 || !VALID_REPO.test(snapshot.repository ?? '') || !Array.isArray(snapshot.assets)) {
    throw new ReportError('Unsupported or invalid snapshot. Use a snapshot saved by this script.');
  }
  const start = timestamp(snapshot.capture_started_at, 'snapshot start');
  const end = timestamp(snapshot.captured_at, 'snapshot end');
  if (start > end) throw new ReportError('Snapshot start is later than its completion.');
  const ids = new Set();
  for (const asset of snapshot.assets) {
    if (!validId(asset.id) || ids.has(asset.id) || !validCount(asset.download_count) || !CATEGORIES.includes(asset.category)) {
      throw new ReportError('Snapshot contains invalid or duplicate asset counters.');
    }
    ids.add(asset.id); timestamp(asset.created_at, 'asset creation');
  }
  return snapshot;
}
export function compareSnapshots(previous, current) {
  validateSnapshot(previous); validateSnapshot(current);
  if (previous.repository.toLowerCase() !== current.repository.toLowerCase()) throw new ReportError('Snapshots are from different repositories.');
  const previousEnd = timestamp(previous.captured_at, 'previous snapshot');
  const currentStart = timestamp(current.capture_started_at, 'current snapshot');
  if (currentStart <= previousEnd) throw new ReportError('The previous snapshot must finish before the current scan starts.');
  const before = new Map(previous.assets.map(asset => [asset.id, asset]));
  const after = new Map(current.assets.map(asset => [asset.id, asset]));
  const deltas = [], issues = [];
  for (const asset of current.assets) {
    const old = before.get(asset.id);
    if (!old && timestamp(asset.created_at, 'asset creation') < previousEnd) {
      issues.push({ asset_id: asset.id, name: asset.name, reason: 'Newly visible older asset: its prior counter is unknown.' });
      continue;
    }
    if (old && old.category !== asset.category) {
      issues.push({ asset_id: asset.id, name: asset.name, reason: 'Asset category changed between snapshots.' });
      continue;
    }
    const difference = asset.download_count - (old?.download_count ?? 0);
    if (difference < 0) {
      issues.push({ asset_id: asset.id, name: asset.name, reason: 'Counter decreased or reset; interval increment is unknown.' });
      continue;
    }
    deltas.push({ id: asset.id, name: asset.name, category: asset.category, downloads: difference,
      basis: old ? 'Same asset ID in both snapshots' : 'Asset created after the baseline capture' });
  }
  for (const asset of previous.assets) if (!after.has(asset.id)) {
    issues.push({ asset_id: asset.id, name: asset.name, reason: 'Asset disappeared: subsequent downloads cannot be measured.' });
  }
  const known = totals(deltas, 'downloads');
  const intervalHours = (timestamp(current.captured_at, 'current snapshot') - previousEnd) / 3600000;
  const outerHours = (timestamp(current.captured_at, 'current snapshot') - timestamp(previous.capture_started_at, 'previous snapshot start')) / 3600000;
  return { baseline_captured_at: previous.captured_at, current_captured_at: current.captured_at,
    interval_hours: intervalHours, capture_outer_window_hours: outerHours,
    complete: issues.length === 0, known_delta: known, asset_deltas: deltas, issues,
    goal: { target_installer_downloads: 1000, known_progress: known.installer_downloads,
      reached_within_observed_24h_window: known.installer_downloads >= 1000 && outerHours <= 24,
      note: 'The 24-hour claim uses the outer bounds of both capture windows. Longer intervals cannot establish a one-day result. Incomplete history is reported as a known lower bound.' },
    limitations: 'Changes between cumulative counters, not unique people or installs. Missing/reset counters are unknown, never subtracted or silently counted as zero.' };
}

export const HELP = `Usage: node scripts/release-downloads.mjs [--repo OWNER/REPO] [--json] [--save FILE] [--since FILE]

  --json        Print machine-readable report (snapshot and optional comparison).
  --save FILE   Save a new complete snapshot; refuses to overwrite an existing file.
  --since FILE  Compare with a previously saved snapshot, matching asset IDs.
  --repo        Default: Wardenlabs/warden. All published releases are scanned.
  --help        Show this help. Optional GH_TOKEN raises GitHub's API allowance.

Launch measurement: save a baseline at launch, then use --since about 24 hours later.
Counts are GitHub asset downloads, not installs, unique people, or daily counts by default.
Archives/updater files are separate from the conservative primary-installer metric.
`;
export function parseArgs(args) {
  const options = { repository: DEFAULT_REPO, json: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (['--repo', '--save', '--since'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new ReportError(`Missing value for ${arg}.`);
      options[{ '--repo': 'repository', '--save': 'save', '--since': 'since' }[arg]] = value;
    } else throw new ReportError('Unknown argument. Use --help for supported options.');
  }
  if (!VALID_REPO.test(options.repository)) throw new ReportError('Use --repo OWNER/REPO.');
  return options;
}
export function formatReport({ snapshot, comparison }) {
  const t = snapshot.totals;
  const lines = [`${snapshot.repository} — GitHub release downloads`,
    `Captured ${snapshot.captured_at}; ${snapshot.release_count} published releases / ${snapshot.asset_count} assets.`,
    `Cumulative primary-installer downloads: ${t.installer_downloads.toLocaleString('en-US')}`,
    `  macOS ${t.macos} | Windows ${t.windows} | Linux ${t.linux}`,
    `Separate: archives/update files ${t.update} | uploaded source ${t.source} | other ${t.other}`];
  if (comparison) {
    lines.push(`Snapshot interval: ${comparison.interval_hours.toFixed(3)} hours.`,
      `${comparison.complete ? 'Measured' : 'Known lower-bound'} installer-download increase: ${comparison.known_delta.installer_downloads}`,
      `Launch target: ${comparison.goal.known_progress} / 1000 downloads in this observed interval.`,
      comparison.goal.reached_within_observed_24h_window ? 'At least 1000 installer downloads measured within an outer capture window of 24 hours or less.' : 'This report does not establish that the 1000-download one-day target was reached.');
    for (const issue of comparison.issues) lines.push(`  Uncertain asset ${issue.asset_id}: ${issue.reason}`);
  } else lines.push('This is a cumulative count. Use --since with a launch baseline to measure an interval.');
  lines.push('Downloads are not installations or unique people. Archives/updates are excluded from the installer metric.',
    'Counts cover currently visible assets; deleted history is unavailable. Capture pages are read sequentially.');
  return `${lines.join('\n')}\n`;
}
export async function runCLI(args = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(args);
  const out = dependencies.stdout ?? (value => process.stdout.write(value));
  if (options.help) { out(HELP); return; }
  let previous;
  if (options.since) {
    try { previous = JSON.parse(await readFile(options.since, 'utf8')); }
    catch { throw new ReportError('Could not read the --since JSON snapshot.'); }
    validateSnapshot(previous);
  }
  const snapshot = await collectDownloads({ repository: options.repository, ...dependencies });
  const comparison = previous ? compareSnapshots(previous, snapshot) : undefined;
  if (options.save) {
    try {
      await mkdir(dirname(resolve(options.save)), { recursive: true });
      await writeFile(options.save, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
    } catch (error) {
      throw new ReportError(error.code === 'EEXIST' ? 'Snapshot already exists. Choose a new --save path to preserve the baseline.' : 'Could not save the snapshot. Check its directory and permissions.');
    }
  }
  const report = { snapshot, ...(comparison ? { comparison } : {}) };
  out(options.json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report));
  return report;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCLI().catch(error => {
    process.stderr.write(`Release download report: ${error instanceof ReportError ? error.message : 'Unexpected failure; no report completed.'}\n`);
    process.exitCode = 1;
  });
}
