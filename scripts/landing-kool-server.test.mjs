import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createDownloadHandler } from '../integrations/kool/server.mjs';

const EVENT_ID = 'cb953a57-1a27-4a4e-884a-5d3b42587788';
const ORIGIN = 'https://warden-theta.vercel.app';
const BASE_ENV = { KOOL_API_URL: 'https://app.joinkool.co', KOOL_INGEST_TOKEN: 'fixture_ingest_secret' };
const valid = () => ({ eventId: EVENT_ID, platform: 'macos' });
const delivered = { id: 'fixture_delivery', status: 'TEST', duplicate: false, rewardId: 'excluded_reward' };

function fixture({ env = {}, fetcher } = {}) {
  const sent = [];
  const handler = createDownloadHandler({ env: { ...BASE_ENV, ...env }, fetch: async (url, options) => {
    sent.push({ url, ...options });
    return fetcher ? fetcher(url, options, sent.length) : Response.json({ delivery: delivered });
  } });
  return { sent, async request({ method = 'POST', origin = ORIGIN, host, headers = {}, body = valid(), chunks } = {}) {
    const request = chunks ? Readable.from(chunks) : {};
    let requestHost = new URL(ORIGIN).host;
    try { requestHost = new URL(origin).host; } catch { /* Keep the valid endpoint host for malformed origins. */ }
    Object.assign(request, { method, headers: {
      origin, host: host ?? requestHost,
      'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...headers,
    }, ...(chunks ? {} : { body }) });
    const response = { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; },
      end(value) { this.body = JSON.parse(value); } };
    await handler(request, response);
    return response;
  } };
}

test('eligible installer click sends only the fixed event and opaque IDs; response omits reward information', async () => {
  for (const platform of ['macos', 'windows']) {
    const f = fixture();
    const result = await f.request({ body: { ...valid(), platform, clickId: 'fixture_kool_reference' } });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { ok: true, delivery: { id: delivered.id, status: 'TEST', duplicate: false } });
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].url, 'https://app.joinkool.co/api/integrations/events/ingest');
    assert.deepEqual(JSON.parse(f.sent[0].body), { event: 'landing_download_clicked', eventId: EVENT_ID,
      clickId: 'fixture_kool_reference', test: true });
    assert.equal(f.sent[0].headers.Authorization, `Bearer ${BASE_ENV.KOOL_INGEST_TOKEN}`);
    assert.equal(f.sent[0].redirect, 'error');
  }
});

test('missing attribution stays absent and both runtime modes are controlled only by the server environment', async () => {
  for (const [env, expected] of [
    [{}, true], [{ VERCEL_ENV: 'production' }, true],
    [{ KOOL_TEST_MODE: 'false' }, true], [{ VERCEL_ENV: 'preview', KOOL_TEST_MODE: 'false' }, true],
    [{ VERCEL_ENV: 'production', KOOL_TEST_MODE: 'FALSE' }, true],
    [{ VERCEL_ENV: 'production', KOOL_TEST_MODE: 'false' }, false],
  ]) {
    const f = fixture({ env });
    const response = await f.request();
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(f.sent[0].body), { event: 'landing_download_clicked', eventId: EVENT_ID, test: expected });
  }
});

test('rejects extra fields, personal data, unsupported platforms, null IDs and malformed UUIDs before contacting Kool', async () => {
  for (const body of [
    null, [], 'null', '[]', 'broken json', 5,
    { ...valid(), email: 'private@example.com' }, { ...valid(), test: false },
    { ...valid(), event: 'another_event' }, { ...valid(), occurredAt: '2026-09-10T00:00:00Z' },
    { ...valid(), platform: 'linux' }, { ...valid(), platform: null }, { eventId: EVENT_ID },
    { ...valid(), eventId: 'private_person' }, { ...valid(), eventId: null },
    { ...valid(), eventId: 'cb953a57-1a27-1a4e-884a-5d3b42587788' },
    { ...valid(), clickId: null }, { ...valid(), clickId: '' },
    { ...valid(), clickId: 'private@example.com' }, { ...valid(), clickId: 'a'.repeat(129) },
    { ...valid(), clickId: 'opaque\n' }, { ...valid(), eventId: `${EVENT_ID}\n` },
    '{"eventId":"cb953a57-1a27-4a4e-884a-5d3b42587788","platform":"macos","__proto__":{}}',
  ]) {
    const f = fixture();
    const response = await f.request({ body });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { ok: false, error: 'Invalid request' });
    assert.equal(f.sent.length, 0);
  }
});

test('only POST JSON is accepted; body size is bounded for parsed bodies and streaming requests', async () => {
  const cases = [
    [{ method: 'GET' }, 405], [{ method: 'OPTIONS' }, 405],
    [{ headers: { 'content-type': 'text/plain' } }, 415],
    [{ headers: { 'content-type': 'application/x-www-form-urlencoded' } }, 415],
    [{ headers: { 'content-encoding': 'gzip' } }, 415],
    [{ headers: { 'content-length': '1025' } }, 413],
    [{ headers: { 'content-length': '-1' } }, 400],
    [{ body: ' '.repeat(1025) }, 413], [{ body: { ...valid(), extra: 'a'.repeat(1100) } }, 413],
    [{ chunks: [' '.repeat(800), ' '.repeat(225)] }, 413],
  ];
  for (const [input, status] of cases) {
    const f = fixture();
    assert.equal((await f.request(input)).statusCode, status);
    assert.equal(f.sent.length, 0);
  }
  const f = fixture();
  assert.equal((await f.request({ chunks: [Buffer.from(JSON.stringify(valid()))],
    headers: { 'content-type': 'application/json; charset=utf-8' } })).statusCode, 200);
  assert.equal(f.sent.length, 1);
});

test('origin must match request host and explicit production, preview or development allowlist', async () => {
  const cases = [
    [{}, { origin: '' }, 403], [{}, { origin: 'null' }, 403],
    [{}, { origin: 'https://evil.example' }, 403],
    [{}, { origin: ORIGIN, host: 'evil.example' }, 403],
    [{}, { headers: { 'sec-fetch-site': 'cross-site' } }, 403],
    [{}, { origin: 'https://warden-preview.vercel.app' }, 403],
    [{ VERCEL_ENV: 'preview', VERCEL_URL: 'warden-preview.vercel.app' }, { origin: 'https://warden-preview.vercel.app' }, 200],
    [{ VERCEL_ENV: 'preview', VERCEL_URL: 'warden-preview.vercel.app' }, { origin: 'https://different.vercel.app' }, 403],
    [{ VERCEL_ENV: 'production', VERCEL_URL: 'warden-preview.vercel.app' }, { origin: 'https://warden-preview.vercel.app' }, 403],
    [{ VERCEL_ENV: 'preview', VERCEL_URL: 'evil.example' }, { origin: 'https://evil.example' }, 403],
    [{}, { origin: 'http://localhost:8773' }, 200], [{}, { origin: 'http://127.0.0.1:8773' }, 200],
    [{}, { origin: 'http://[::1]:8773' }, 200],
    [{ VERCEL_ENV: 'production' }, { origin: 'http://localhost:8773' }, 403],
    [{ NODE_ENV: 'production' }, { origin: 'http://localhost:8773' }, 403],
  ];
  for (const [env, input, status] of cases) {
    const f = fixture({ env });
    assert.equal((await f.request(input)).statusCode, status);
    assert.equal(f.sent.length, status === 200 ? 1 : 0);
  }
});

test('missing or invalid server configuration stays unavailable without exposing secrets', async () => {
  for (const env of [
    { KOOL_INGEST_TOKEN: undefined }, { KOOL_INGEST_TOKEN: '' }, { KOOL_INGEST_TOKEN: 'secret\nvalue' },
    { KOOL_INGEST_TOKEN: undefined, NEXT_PUBLIC_KOOL_INGEST_TOKEN: 'public_placeholder' },
    { KOOL_API_URL: undefined }, { KOOL_API_URL: 'https://evil.example' },
    { KOOL_API_URL: 'https://app.joinkool.co?private=value' }, { KOOL_API_URL: 'http://app.joinkool.co' },
  ]) {
    const f = fixture({ env });
    const response = await f.request();
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, { ok: false, error: 'Event service unavailable' });
    assert.equal(f.sent.length, 0);
  }
});

test('SDK retries temporary failures with an identical event ID, attribution and body', async () => {
  const f = fixture({ fetcher: (_url, _options, count) => count === 1
    ? Response.json({ error: 'temporary' }, { status: 503 })
    : Response.json({ delivery: { ...delivered, duplicate: true } }) });
  const response = await f.request({ body: { ...valid(), clickId: 'fixture_reference' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.delivery.duplicate, true);
  assert.equal(f.sent.length, 2);
  assert.equal(f.sent[0].body, f.sent[1].body);
});

test('invalid attribution and malformed upstream responses return generic failures and no private details', async () => {
  for (const fetcher of [
    () => Response.json({ error: 'private upstream context', token: 'never expose' }, { status: 422 }),
    () => Response.json({ delivery: { ...delivered, id: 'private@example.com' } }),
    () => Response.json({ delivery: { ...delivered, status: 'unexpected' } }),
  ]) {
    const f = fixture({ fetcher });
    const response = await f.request();
    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.body, { ok: false, error: 'Event delivery failed' });
    assert.equal(f.sent.length, 1);
  }
});
