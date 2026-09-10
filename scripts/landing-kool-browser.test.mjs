import test from 'node:test';
import assert from 'node:assert/strict';
import { initKoolDownloads } from '../landing/kool-download.js';

const base = 'https://warden-theta.vercel.app/';
const downloads = {
  macos: 'https://github.com/Wardenlabs/warden/releases/latest/download/Warden-arm64.dmg',
  windows: 'https://github.com/Wardenlabs/warden/releases/latest/download/Warden-Setup.exe',
};
const storageKey = 'kool.attribution.v1';
const maxAge = 90 * 24 * 60 * 60 * 1000;
const epoch = 1_800_000_000_000;

// Browser-facing fixtures exercise the initializer and the official attribution
// helper together, with no network, actual downloads, credentials or real IDs.
class Element {
  constructor(href, parent = null) {
    if (href) this.href = href;
    this.parentElement = parent;
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener); this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener));
  }
  closest(selector) {
    return selector === 'a[href]' && this.href ? this : this.parentElement?.closest(selector) || null;
  }
  emit(type, event) {
    event.type = type;
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial)), calls = [];
  return {
    data, calls,
    getItem(key) { calls.push(['get', key]); return data.get(key) ?? null; },
    setItem(key, value) { calls.push(['set', key, value]); data.set(key, value); },
    removeItem(key) { calls.push(['remove', key]); data.delete(key); },
  };
}

function fixture({ url = base, storage = memoryStorage(), navigator = {} } = {}) {
  let sequence = 0;
  const doc = new Element(), requests = [];
  doc.referrer = 'https://example.test/private?email=fixture@example.test';
  const win = {
    location: new URL(url), navigator, localStorage: storage,
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
    fetch(endpoint, options) { requests.push({ endpoint, options, body: JSON.parse(options.body) }); return Promise.resolve({ ok: true }); },
  };
  function dispatch(href = downloads.macos, overrides = {}, type = 'click') {
    const link = new Element(href), icon = new Element(undefined, link);
    const event = {
      isTrusted: true, button: 0, detail: 1, defaultPrevented: false, target: icon,
      preventDefault() { assert.fail('Kool must preserve the native download action'); },
      ...overrides,
    };
    doc.emit(type, event);
    assert.equal(link.href, href, 'the native download href is unchanged');
    return event;
  }
  return { doc, win, requests, storage, dispatch, start: () => initKoolDownloads(win, doc) };
}

test('loading the page, synthetic clicks and non-download actions never emit a conversion', () => {
  const f = fixture(); f.start();
  assert.equal(f.requests.length, 0);
  f.dispatch(downloads.macos, { isTrusted: false });
  f.dispatch(downloads.macos, { button: 2 });
  f.dispatch(downloads.macos, { button: 2 }, 'auxclick');
  f.dispatch(downloads.macos, { button: 1 });
  f.dispatch(downloads.macos, {}, 'pointerdown');
  f.dispatch(downloads.macos, { key: 'Enter' }, 'keydown');
  for (const href of [
    `${base}#download`, 'https://github.com/Wardenlabs/warden/releases/latest',
    'https://github.com/Wardenlabs/warden',
    'https://github.com/Wardenlabs/warden/releases/latest/download/unknown.dmg',
    'https://github.com.evil.test/Wardenlabs/warden/releases/latest/download/Warden-arm64.dmg',
    'javascript:alert(1)',
  ]) f.dispatch(href);
  f.dispatch(downloads.macos, { target: new Element() });
  assert.equal(f.requests.length, 0);
});

test('trusted normal, middle-button and keyboard activations send the selected installer platform', () => {
  const f = fixture({ navigator: { userAgent: 'Windows fixture' } }); f.start();
  const initialLocation = f.win.location.href;
  f.dispatch(downloads.windows);
  f.dispatch(downloads.macos, { button: 1 }, 'auxclick');
  f.dispatch(downloads.macos, { detail: 0 }); // Enter on a native anchor emits click, not keydown.
  f.dispatch(downloads.windows, { ctrlKey: true, metaKey: true });
  assert.deepEqual(f.requests.map(request => request.body.platform), ['windows', 'macos', 'macos', 'windows']);
  assert.equal(new Set(f.requests.map(request => request.body.eventId)).size, 4);
  assert.equal(f.win.location.href, initialLocation);
});

test('request uses only an opaque result ID, platform and attribution, with no browser identities or URL', () => {
  const f = fixture({ url: `${base}?kool_cid=fixture_click-123&email=fixture%40example.test&name=Private#private-fragment` });
  f.start();
  f.dispatch(`${downloads.windows}?email=fixture@example.test`);
  assert.equal(f.requests.length, 1);
  const { endpoint, options, body } = f.requests[0];
  assert.equal(endpoint, '/api/kool-download');
  assert.deepEqual(body, { eventId: '00000000-0000-4000-8000-000000000001', platform: 'windows', clickId: 'fixture_click-123' });
  assert.equal(options.method, 'POST');
  assert.deepEqual(options.headers, { 'Content-Type': 'application/json' });
  assert.equal(options.keepalive, true);
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.doesNotMatch(JSON.stringify(f.requests), /email|example\.test|Private|private-fragment|userAgent|pageview|utm_/);
});

test('cancelled navigation never emits, and reinitialization or redispatch does not duplicate a result', () => {
  const f = fixture(), controller = f.start();
  assert.equal(f.start(), controller);
  f.dispatch(downloads.macos, { defaultPrevented: true });
  assert.equal(f.requests.length, 0);
  const event = f.dispatch(downloads.macos);
  f.doc.emit('click', event);
  assert.equal(f.requests.length, 1);
  controller.destroy();
  f.dispatch(downloads.macos);
  assert.equal(f.requests.length, 1);
  f.start(); f.start(); f.dispatch(downloads.macos);
  assert.equal(f.requests.length, 2);
});

test('Kool attribution persists across pages without retaining other URL fields', t => {
  t.mock.method(Date, 'now', () => epoch);
  const storage = memoryStorage();
  const first = fixture({ storage, url: `${base}?kool_cid=fixture_campaign_42&email=fixture%40example.test&utm_source=private#private` });
  first.start();
  assert.equal(first.requests.length, 0);
  assert.deepEqual([...storage.data.keys()], [storageKey]);
  assert.deepEqual(JSON.parse(storage.data.get(storageKey)), { clickId: 'fixture_campaign_42', savedAt: epoch });
  const later = fixture({ storage }); later.start(); later.dispatch();
  assert.equal(later.requests[0].body.clickId, 'fixture_campaign_42');
  assert.doesNotMatch(JSON.stringify([...storage.data.values()]), /email|example\.test|utm_source|https:|private/);
});

test('invalid URL attribution is never forwarded or persisted', () => {
  for (const clickId of ['fixture@example.test', 'private/name', 'a'.repeat(129), '']) {
    const f = fixture({ url: `${base}?kool_cid=${encodeURIComponent(clickId)}` });
    f.start(); f.dispatch();
    assert.deepEqual(Object.keys(f.requests[0].body).sort(), ['eventId', 'platform']);
    assert.equal(f.storage.data.size, 0);
  }
});

test('blocked storage still preserves a valid current URL attribution for the actual click', () => {
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  for (const inaccessibleProperty of [false, true]) {
    const f = fixture({ storage: unavailable, url: `${base}?kool_cid=fixture_storage_blocked` });
    if (inaccessibleProperty) Object.defineProperty(f.win, 'localStorage', { get() { throw new Error('blocked'); } });
    f.start(); f.dispatch();
    assert.equal(f.requests[0].body.clickId, 'fixture_storage_blocked');
  }
});

test('a fresh Kool URL wins over an older stored attribution even if the new write fails', t => {
  t.mock.method(Date, 'now', () => epoch);
  const storage = memoryStorage({ [storageKey]: JSON.stringify({ clickId: 'fixture_old_click', savedAt: epoch - 1000 }) });
  storage.setItem = () => { throw new Error('quota exceeded'); };
  const f = fixture({ storage, url: `${base}?kool_cid=fixture_new_click` });
  f.start(); f.dispatch();
  assert.equal(f.requests[0].body.clickId, 'fixture_new_click');
});

test('loading without kool_cid does not extend the stored attribution lifetime', t => {
  let now = epoch + maxAge - 1;
  t.mock.method(Date, 'now', () => now);
  const storage = memoryStorage({ [storageKey]: JSON.stringify({ clickId: 'fixture_expiring', savedAt: epoch }) });
  const f = fixture({ storage }); f.start(); f.dispatch();
  assert.equal(f.requests[0].body.clickId, 'fixture_expiring');
  assert.equal(JSON.parse(storage.data.get(storageKey)).savedAt, epoch);
  now += 1; f.dispatch();
  assert.equal(f.requests[1].body.clickId, undefined);
  assert.equal(storage.data.has(storageKey), false);
});

test('an in-memory attribution also expires after ninety days when storage is blocked', t => {
  let now = epoch;
  t.mock.method(Date, 'now', () => now);
  const f = fixture({ storage: null, url: `${base}?kool_cid=fixture_memory_only` });
  f.start(); now += maxAge - 1; f.dispatch();
  assert.equal(f.requests[0].body.clickId, 'fixture_memory_only');
  now += 1; f.dispatch();
  assert.equal(f.requests[1].body.clickId, undefined);
});

test('Do Not Track prevents both capture and conversion; non-web pages are inactive', () => {
  for (const value of ['1', 'yes', 'YES']) {
    for (const useWindow of [false, true]) {
      const f = fixture({ url: `${base}?kool_cid=fixture_dnt`, navigator: useWindow ? {} : { doNotTrack: value } });
      if (useWindow) f.win.doNotTrack = value;
      assert.equal(f.start(), undefined);
      f.dispatch();
      assert.equal(f.requests.length, 0);
      assert.deepEqual(f.storage.calls, []);
      assert.equal(f.doc.listeners.size, 0);
    }
  }
  const file = fixture({ url: 'file:///tmp/landing.html?kool_cid=fixture_file' });
  assert.equal(file.start(), undefined); file.dispatch();
  assert.equal(file.requests.length, 0); assert.deepEqual(file.storage.calls, []);
});

test('unavailable transport and result-ID generation cannot interrupt a native download', async () => {
  for (const failure of ['rejection', 'throw', 'crypto']) {
    const f = fixture(); f.start();
    if (failure === 'rejection') f.win.fetch = () => Promise.reject(new Error('offline'));
    if (failure === 'throw') f.win.fetch = () => { throw new Error('blocked'); };
    if (failure === 'crypto') f.win.crypto.randomUUID = () => { throw new Error('unavailable'); };
    assert.doesNotThrow(() => f.dispatch());
    await Promise.resolve(); // A rejected fetch must have a rejection handler.
  }
});
