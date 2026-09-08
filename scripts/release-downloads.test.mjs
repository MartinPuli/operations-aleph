import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyAsset, collectDownloads, compareSnapshots, formatReport, parseArgs,
  runCLI, validateSnapshot, ReportError } from './release-downloads.mjs';

const ROOT = 'https://api.github.com/repos/Wardenlabs/warden';
const TIME = '2026-09-08T00:00:00.000Z';
const response = (data, headers = {}, status = 200) => ({ ok: status === 200, status,
  headers: { get: name => headers[name] ?? null }, json: async () => data });
const asset = (id, name, count, created = '2026-01-01T00:00:00Z') => ({ id, name,
  download_count: count, created_at: created, browser_download_url: `https://github.com/Wardenlabs/warden/releases/download/v1/${name}` });
const release = (id, extra = {}) => ({ id, tag_name: `v${id}`, draft: false,
  prerelease: false, published_at: '2026-01-01T00:00:00Z', ...extra });
const fixedClock = () => new Date(TIME);
function snapshot(assets, end = TIME, start = end) {
  return { schema_version: 1, classification_version: 1, repository: 'Wardenlabs/warden',
    capture_started_at: start, captured_at: end,
    assets: assets.map(a => ({ ...a, category: classifyAsset(a.name) })) };
}
const nextDay = '2026-09-09T00:00:00.000Z';

// A primary installer and its archive/updater may both be fetched by one user.
// The two counters must never be presented as two installations.
test('separates primary installers from archives, updates, source and auxiliary assets', () => {
  const cases = {
    'Warden-arm64.dmg': 'macos', 'Warden-x64.dmg': 'macos', 'Warden.pkg': 'macos',
    'Warden-Setup.exe': 'windows', 'Warden-1.2-Installer.exe': 'windows', 'Warden.msi': 'windows',
    'Warden.exe': 'other', 'Warden.AppImage': 'linux', 'warden_1_amd64.deb': 'linux', 'warden.rpm': 'linux',
    'warden-darwin-arm64.zip': 'update', 'warden-win32-x64.zip': 'update', 'warden-linux-x64.tar.gz': 'update',
    'warden-full.nupkg': 'update', 'latest-mac.yml': 'update', 'RELEASES': 'update', 'Warden.dmg.blockmap': 'update',
    'warden-source.zip': 'source', 'source-code.tar.gz': 'source', 'warden-src.tar.xz': 'source',
    'SHA256SUMS': 'other', 'warden.dmg.sha256': 'other', 'README.txt': 'other'
  };
  for (const [name, category] of Object.entries(cases)) assert.equal(classifyAsset(name), category, name);
});

test('paginates all releases AND each asset list; excludes drafts, includes prereleases, deduplicates IDs', async () => {
  const calls = [];
  const routes = new Map([
    [`${ROOT}/releases?per_page=100`, response([release(20), release(19, { draft: true })], { link: `<${ROOT}/releases?per_page=100&page=2>; rel="next"` })],
    [`${ROOT}/releases?per_page=100&page=2`, response([release(20), release(1, { prerelease: true })])],
    [`${ROOT}/releases/20/assets?per_page=100`, response([asset(10, 'Warden-arm64.dmg', 9)], { link: `<${ROOT}/releases/20/assets?per_page=100&page=2>; rel="next"` })],
    [`${ROOT}/releases/20/assets?per_page=100&page=2`, response([asset(10, 'Warden-arm64.dmg', 9), asset(11, 'warden-darwin.zip', 50)])],
    [`${ROOT}/releases/1/assets?per_page=100`, response([asset(1, 'Warden-Setup.exe', 120)])]
  ]);
  const result = await collectDownloads({ clock: fixedClock, token: undefined, fetchImpl: async url => {
    calls.push(url); assert.ok(routes.has(url), `Unexpected route ${url}`); return routes.get(url);
  } });
  assert.equal(calls.length, 5); assert.equal(result.release_count, 2); assert.equal(result.asset_count, 3);
  assert.equal(result.totals.installer_downloads, 129); assert.equal(result.totals.update, 50);
  assert.equal(result.totals.all_asset_downloads, 179); assert.equal(result.releases[1].prerelease, true);
});

test('does not forward optional authentication to pagination on another host', async () => {
  let calls = 0;
  await assert.rejects(collectDownloads({ token: 'fixture-secret', fetchImpl: async (_url, options) => {
    calls++; assert.equal(options.headers.Authorization, 'Bearer fixture-secret');
    assert.equal(options.redirect, 'error');
    return response([], { link: '<https://elsewhere.example/releases?page=2>; rel="next"' });
  } }), /unexpected GitHub pagination URL/);
  assert.equal(calls, 1);
});

test('detects pagination loops instead of returning partial or doubled totals', async () => {
  await assert.rejects(collectDownloads({ fetchImpl: async () => response([], {
    link: `<${ROOT}/releases?per_page=100>; rel="next"`
  }) }), /repeated a page/);
});

test('rate limits and request errors are actionable without echoing credentials', async () => {
  await assert.rejects(collectDownloads({ token: 'fixture-secret', fetchImpl: async () => response({}, {
    'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1788825600'
  }, 403) }), error => error instanceof ReportError && /rate limit/.test(error.message) && /Reset:/.test(error.message) && !error.message.includes('fixture-secret'));
  await assert.rejects(collectDownloads({ token: 'fixture-secret', fetchImpl: async () => {
    throw new Error('request includes fixture-secret');
  } }), error => /request failed/.test(error.message) && !error.message.includes('fixture-secret'));
});

test('rejects a missing or invalid count rather than treating it as zero', async () => {
  let call = 0;
  await assert.rejects(collectDownloads({ fetchImpl: async () => ++call === 1
    ? response([release(1)]) : response([{ ...asset(1, 'Warden.dmg', 1), download_count: null }]) }), /invalid asset/);
});

test('delta includes existing ID increments and genuinely new assets, never lifetime totals twice', () => {
  const before = snapshot([asset(1, 'Warden.dmg', 800), asset(2, 'warden.zip', 200)]);
  const after = snapshot([asset(1, 'Warden.dmg', 850), asset(2, 'warden.zip', 210),
    asset(3, 'Warden-Setup.exe', 950, '2026-09-08T05:00:00Z')], nextDay);
  const comparison = compareSnapshots(before, after);
  assert.equal(comparison.complete, true); assert.equal(comparison.known_delta.installer_downloads, 1000);
  assert.equal(comparison.known_delta.update, 10); assert.equal(comparison.interval_hours, 24);
  assert.equal(comparison.goal.reached_within_observed_24h_window, true);
});

test('counter resets, deleted assets and newly visible old assets stay unknown, not inflated or negative', () => {
  const before = snapshot([asset(1, 'Warden.dmg', 80), asset(2, 'Warden-Setup.exe', 30), asset(4, 'Warden.pkg', 10)]);
  const after = snapshot([asset(1, 'Warden.dmg', 4), asset(3, 'warden.deb', 10000), asset(4, 'Warden.pkg', 22)], nextDay);
  const comparison = compareSnapshots(before, after);
  assert.equal(comparison.complete, false); assert.equal(comparison.known_delta.installer_downloads, 12);
  assert.equal(comparison.issues.length, 3); assert.equal(comparison.goal.reached_within_observed_24h_window, false);
});

test('re-uploading the same filename is matched by asset ID, not subtracted from an old counter', () => {
  const before = snapshot([asset(1, 'Warden.dmg', 500)]);
  const after = snapshot([asset(2, 'Warden.dmg', 20, '2026-09-08T12:00:00Z')], nextDay);
  const comparison = compareSnapshots(before, after);
  assert.equal(comparison.known_delta.installer_downloads, 20);
  assert.equal(comparison.complete, false); assert.match(comparison.issues[0].reason, /disappeared/);
});

test('does not infer a 24h achievement from a longer interval or non-atomic capture bounds', () => {
  const before = snapshot([asset(1, 'Warden.dmg', 0)]);
  const late = snapshot([asset(1, 'Warden.dmg', 1500)], '2026-09-10T00:00:00Z');
  assert.equal(compareSnapshots(before, late).goal.reached_within_observed_24h_window, false);
  const longCapture = { ...before, capture_started_at: '2026-09-07T23:59:00Z' };
  assert.equal(compareSnapshots(longCapture, snapshot([asset(1, 'Warden.dmg', 1500)], nextDay)).goal.reached_within_observed_24h_window, false);
});

test('validates snapshot identity, chronology, duplicate IDs and category changes', () => {
  const before = snapshot([asset(1, 'Warden.dmg', 4)]);
  assert.throws(() => compareSnapshots(before, { ...before, repository: 'another/repo' }), /different repositories/);
  assert.throws(() => compareSnapshots(before, before), /must finish before/);
  assert.throws(() => validateSnapshot(snapshot([asset(1, 'Warden.dmg', 4), asset(1, 'Warden.dmg', 5)])), /duplicate/);
  const moved = snapshot([asset(1, 'source.zip', 9)], nextDay);
  assert.equal(compareSnapshots(before, moved).known_delta.installer_downloads, 0);
  assert.match(compareSnapshots(before, moved).issues[0].reason, /category changed/);
});

test('CLI saves portable snapshots, emits JSON, compares baseline, and protects existing files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'warden-download-fixture-'));
  try {
    const baseline = join(directory, 'baseline.json');
    const output = [];
    const fetchImpl = async url => url.includes('/1/assets') ? response([asset(1, 'Warden.dmg', 10)]) : response([release(1)]);
    await runCLI(['--save', baseline, '--json'], { fetchImpl, clock: fixedClock, stdout: text => output.push(text), token: undefined });
    assert.equal(JSON.parse(output[0]).snapshot.totals.installer_downloads, 10);
    assert.equal(JSON.parse(await readFile(baseline, 'utf8')).schema_version, 1);
    await assert.rejects(runCLI(['--save', baseline], { fetchImpl, clock: fixedClock, stdout() {} }), /already exists/);
    const second = await runCLI(['--since', baseline, '--json'], { fetchImpl, clock: () => new Date(nextDay), stdout() {} });
    assert.equal(second.comparison.known_delta.installer_downloads, 0);
    await writeFile(join(directory, 'broken.json'), '{');
    await assert.rejects(runCLI(['--since', join(directory, 'broken.json')], { fetchImpl, stdout() {} }), /Could not read/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a mid-scan API error never saves a partial snapshot', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'warden-download-fixture-'));
  try {
    const saved = join(directory, 'partial.json');
    await assert.rejects(runCLI(['--save', saved], { stdout() {}, fetchImpl: async url =>
      url.includes('/1/assets') ? response({}, {}, 503) : response([release(1)]) }), /HTTP 503/);
    await assert.rejects(readFile(saved), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('help and human output distinguish cumulative downloads from installs and daily measurements', async () => {
  let help = '';
  await runCLI(['--help'], { stdout: text => { help = text; }, fetchImpl: () => { throw new Error('No network expected'); } });
  assert.match(help, /not installs/); assert.match(help, /--since/);
  assert.throws(() => parseArgs(['--save']), /Missing value/); assert.throws(() => parseArgs(['--repo', 'bad']), /OWNER\/REPO/);
  const result = await collectDownloads({ clock: fixedClock, fetchImpl: async () => response([]) });
  const text = formatReport({ snapshot: result });
  assert.match(text, /cumulative count/i); assert.match(text, /not installations or unique people/);
  assert.equal(result.totals.installer_downloads, 0);
});
