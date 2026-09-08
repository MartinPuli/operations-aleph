/** Console boundary tests, with no browser/runtime dependency. The browser
 * walkthrough separately covers layout, file pickers, focus and networking. */
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { captureFieldValues, restoreFieldValues } from '../web/js/form-state.js';

const original = { document: globalThis.document, window: globalThis.window, sessionStorage: globalThis.sessionStorage, fetch: globalThis.fetch };
const elements = new Map();
globalThis.document = { addEventListener() {}, getElementById: (id) => elements.get(id) ?? null, querySelectorAll: () => [] };
globalThis.window = { prompt: () => { throw new Error('An employee request must never request an admin key.'); } };
globalThis.sessionStorage = { getItem: () => 'administrator-secret' };
const { api, post, state } = await import('../web/js/core.js');
const { documentMetadataMarkup, documentReason } = await import('../web/js/documents.js');
const { library, libraryMarkup } = await import('../web/js/model-library.js');
await import('../web/js/models.js');
const { VIEWS } = await import('../web/js/views.js');

beforeEach(() => { elements.clear(); library.catalog = null; library.error = ''; library.loading = false; });
after(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });

function field(id, type, value, extra = {}) {
  return { id, type, tagName: 'INPUT', value, checked: false, selectionStart: null, selectionEnd: null, hasAttribute: () => false, ...extra };
}
const root = (...fields) => ({ querySelectorAll: () => fields });

// These are role-boundary tests, not checks of a particular header casing.
test('the Simulator sends the employee identity even when an admin key is stored', async () => {
  let request;
  globalThis.fetch = async (path, init) => { request = { path, init }; return new Response('{"verdict":"ALLOW"}', { status: 200 }); };
  await post('/api/guard/check', { prompt: 'hello' }, { headers: { authorization: 'Bearer employee-secret' } });
  assert.equal(new Headers(request.init.headers).get('authorization'), 'Bearer employee-secret');
  assert.equal(JSON.parse(request.init.body).prompt, 'hello');
});

test('a refused employee identity is never retried using an administrator identity', async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response('{"error":"forbidden"}', { status: 403 }); };
  const response = await api('/api/guard/check', { headers: { Authorization: 'Bearer employee-secret' } });
  assert.equal(response.status, 403);
  assert.equal(requests, 1);
});

test('administrative calls still receive the stored admin key', async () => {
  globalThis.fetch = async (_path, init) => { assert.equal(new Headers(init.headers).get('authorization'), 'Bearer administrator-secret'); return new Response('{}'); };
  await api('/api/settings/models');
});

test('password and file values are never read into a refresh snapshot', () => {
  const secret = field('key', 'password', '');
  const file = field('file', 'file', '');
  for (const item of [secret, file]) Object.defineProperty(item, 'value', { get() { throw new Error('Sensitive value was read'); }, set() { throw new Error('Sensitive value was restored'); } });
  const publicField = field('name', 'text', 'My compiler', { selectionStart: 2, selectionEnd: 5 });
  const snapshot = captureFieldValues(root(secret, file, publicField));
  assert.deepEqual(Object.keys(snapshot), ['name']);
  restoreFieldValues(root(secret, file), { key: { value: 'secret' }, file: { value: 'C:\\fakepath\\file' } });
});

test('live refresh restores public text, caret and checkbox selections', () => {
  const snapshot = captureFieldValues(root(field('name', 'text', 'Renamed model', { selectionStart: 1, selectionEnd: 4 }), field('role', 'checkbox', 'on', { checked: true })));
  let caret;
  const name = field('name', 'text', '', { setSelectionRange: (start, end) => { caret = [start, end]; } });
  const role = field('role', 'checkbox', 'on');
  restoreFieldValues(root(name, role), snapshot);
  assert.equal(name.value, 'Renamed model');
  assert.deepEqual(caret, [1, 4]);
  assert.equal(role.checked, true);
});

test('changed provider options and explicit server-owned values are not overwritten', () => {
  const provider = field('provider', 'select-one', 'new', { tagName: 'SELECT', options: [{ value: 'new' }] });
  const managed = field('managed', 'text', 'server selection', { hasAttribute: (name) => name === 'data-no-restore' });
  restoreFieldValues(root(provider, managed), { provider: { value: 'removed-provider' }, managed: { value: 'old' } });
  assert.equal(provider.value, 'new');
  assert.equal(managed.value, 'server selection');
});

test('attachment names and server explanations are rendered as text, with unreadable status', () => {
  const html = documentMetadataMarkup([{ name: '"><img src=x onerror=alert(1)>.pdf', bytes: 123, status: 'unreadable', reason: 'bad <script>alert(1)</script>' }]);
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('Could not read'));
  assert.ok(!html.includes('>Read<'));
});

test('prepared attachments do not claim the document was read or policy checked', () => {
  const html = documentMetadataMarkup([{ name: 'example.txt', bytes: 42 }], { submitted: true });
  assert.ok(html.includes('Attached'));
  assert.ok(!html.includes('>Read<'));
  assert.ok(!html.includes('Allowed'));
  assert.match(documentReason('encrypted-document'), /unlocked copy/);
  assert.match(documentReason('document-reader-busy'), /try again/);
});

test('custom models cannot be applied until a successful role-specific test', () => {
  const model = { id: 'model-1', name: 'Custom', kind: 'endpoint', model: 'some-model', baseUrl: 'https://example.test/v1', roles: ['compiler'], testedRoles: [], activeRoles: [] };
  library.catalog = { models: [model], selections: { compiler: null, adjudicator: null } };
  let html = libraryMarkup();
  let activate = html.match(/<button[^>]*data-model-use="model-1"[^>]*>/)?.[0];
  assert.ok(activate?.includes(' disabled'));
  model.testedRoles = ['adjudicator'];
  assert.ok(libraryMarkup().match(/<button[^>]*data-model-use="model-1"[^>]*>/)?.[0].includes(' disabled'));
  model.testedRoles = ['compiler'];
  activate = libraryMarkup().match(/<button[^>]*data-model-use="model-1"[^>]*>/)?.[0];
  assert.ok(activate && !activate.includes(' disabled'));
});

test('an assigned model cannot be edited or removed, including an environment override', () => {
  library.catalog = { models: [{ id: 'model-1', name: '<script>x</script>', kind: 'local', roles: ['adjudicator'], testedRoles: ['adjudicator'], activeRoles: [], bytes: 100 }], selections: { compiler: null, adjudicator: 'model-1' } };
  const html = libraryMarkup();
  assert.ok(html.match(/<button[^>]*data-model-edit="model-1"[^>]*>/)?.[0].includes(' disabled'));
  assert.ok(html.match(/<button[^>]*data-model-remove="model-1"[^>]*>/)?.[0].includes(' disabled'));
  assert.ok(!html.includes('<script>'));
  assert.equal(state.sending, false);
});

test('a retained custom runtime keeps its name and edit protection while a built-in download is pending', () => {
  const model = { id: 'model-1', name: 'Our analyzer', filename: 'original.gguf', kind: 'local', roles: ['adjudicator'], testedRoles: ['adjudicator'], activeRoles: ['adjudicator'], bytes: 100 };
  library.catalog = { models: [model], selections: { compiler: null, adjudicator: null }, inForce: { adjudicator: '/gateway/models/model-1.gguf' } };
  const previous = state.models;
  state.models = { state: 'ready', judging: { model: 'model-1.gguf', where: 'On this gateway' } };
  try {
    for (const actual of ['/gateway/models/model-1.gguf', 'unmapped-runtime']) {
      library.catalog.inForce.adjudicator = actual;
      const html = VIEWS.models.body();
      assert.match(html, /data-active-model="adjudicator">Our analyzer<\/b>/);
      assert.ok(html.match(/<button[^>]*data-model-edit="model-1"[^>]*>/)?.[0].includes(' disabled'));
      assert.ok(html.match(/<button[^>]*data-model-remove="model-1"[^>]*>/)?.[0].includes(' disabled'));
    }
  } finally { state.models = previous; }
});
