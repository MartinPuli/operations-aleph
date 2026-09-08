/** Model management against actual HTTP routes and a local HTTP provider.
 * Only the expensive QVAC weight loader is replaced; no quality claim is made
 * from that replacement. The compiler router and offload boundary are real. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import express from 'express';

const temporary = mkdtempSync(join(tmpdir(), 'warden-model-management-'));
process.env['WARDEN_SETTINGS_PATH'] = join(temporary, 'settings.json');
process.env['WARDEN_MODELS_DIR'] = join(temporary, 'weights');
process.env['WARDEN_COMPANY_PATH'] = join(temporary, 'company.json');
process.env['WARDEN_POLICY_PATH'] = join(temporary, 'policy.json');
process.env['WARDEN_RATE_STATE_PATH'] = join(temporary, 'rate.json');
process.env['WARDEN_ADAPTER'] = 'mock';
for (const key of ['WARDEN_MODEL_COMPILER', 'WARDEN_MODEL_ADJUDICATOR', 'WARDEN_COMPILER_API', 'WARDEN_COMPILER_API_KEY', 'WARDEN_COMPILER_CLI', 'WARDEN_ADMIN_REQUIRE_KEY']) delete process.env[key];
writeFileSync(process.env['WARDEN_COMPANY_PATH'], JSON.stringify({ roles: ['admin', 'employee'], employees: [
  { id: 'admin', name: 'Admin', role: 'admin', apiKey: 'admin-test-key' },
  { id: 'employee', name: 'Employee', role: 'employee', apiKey: 'employee-test-key' }
] }));

const { ModelManager, selections, applyCompilerSettings } = await import('../src/models/manager.js');
const { modelPath, findModel, catalogPath, managedModelsDir, fingerprint, readCatalog } = await import('../src/models/store.js');
const { importUpload, publicAddress, MAX_MODEL_BYTES, startDownload, cancelDownload, downloadJobs } = await import('../src/models/transfers.js');
const { loadCompilerSettings, saveCompilerSettings, loadAdjudicatorSettings, saveAdjudicatorSettings } = await import('../src/settings.js');
const { createModelRoutes } = await import('../src/server/routes/models.js');
const { settingsRoutes } = await import('../src/server/routes/settings.js');
const { needsAdmin, requireAdmin } = await import('../src/server/admin-auth.js');
const { adapter, remoteCompiler } = await import('../src/qvac/index.js');
const { withModelRole, withRoleChange } = await import('../src/qvac/coordination.js');
const { sourceFor, customAdjudicatorForm } = await import('../src/qvac/client.js');

let loadFailure = false;
const localCalls: string[] = [];
const manager = new ModelManager({
  testLocal: async (entry, role) => { localCalls.push(`test:${entry.id}:${role}`); },
  load: async (role) => { localCalls.push(`load:${role}`); if (loadFailure) throw new Error('candidate failed to load'); },
  forget: async (role) => { localCalls.push(`forget:${role}`); }
});
const seen: { model: string; authorization?: string }[] = [];
let endpointFailure: 'none' | 'http' | 'malformed' = 'none';
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  seen.push({ model: body.model, authorization: req.headers.authorization });
  if (endpointFailure === 'http') { res.writeHead(401); res.end(`diagnostic ${req.headers.authorization}`); return; }
  const testing = body.messages.some((m: { content: string }) => m.content.includes('"status":"ready"'));
  const content = endpointFailure === 'malformed' ? `credential echo ${req.headers.authorization}` : testing ? '{"status":"ready"}' : `answered:${body.model}`;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ message: { content } }] }));
});
const app = express();
app.use(express.json());
app.use((req, res, next) => needsAdmin(req.path) ? requireAdmin(req, res, next) : next());
app.use(createModelRoutes(manager));
app.use(settingsRoutes);
const server = createServer(app);

async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
const providerUrl = `${await listen(provider)}/v1`;
const base = await listen(server);
const path = '/api/settings/models';
async function request(url: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}${url}`, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() as Record<string, any> };
}
const fixture = Buffer.alloc(64); fixture.write('GGUF'); fixture.writeUInt32LE(3, 4); fixture.writeBigUInt64LE(1n, 8); fixture.writeBigUInt64LE(1n, 16);
const fixturePath = join(temporary, 'renamed-policy-model.gguf'); writeFileSync(fixturePath, fixture);
function turn(): Promise<void> { return new Promise((resolve) => setImmediate(resolve)); }

try {
  // Initializing the router before selecting a compiler reproduced the old
  // singleton bug. Keep this call before every save in the test.
  const gateway = adapter();
  assert.equal(remoteCompiler(), null);
  assert.equal((await request(path)).status, 200);
  assert.equal((await request(path, 'GET', undefined, { 'x-forwarded-for': '203.0.113.8' })).status, 403);
  assert.equal((await request(path, 'GET', undefined, { 'x-forwarded-for': '203.0.113.8', authorization: 'Bearer employee-test-key' })).status, 403);
  const admin = { 'x-forwarded-for': '203.0.113.8', authorization: 'Bearer admin-test-key' };
  assert.equal((await request(path, 'GET', undefined, admin)).status, 200);
  assert.equal((await request(path, 'POST', { kind: 'local', name: 'remote path', path: fixturePath, roles: ['compiler'], format: 'compliance' }, admin)).status, 403);

  let response = await request(path, 'POST', { kind: 'endpoint', name: 'My server', baseUrl: providerUrl, model: 'model-a' });
  assert.equal(response.status, 201); const endpointId = String(response.body.id);
  assert.equal(response.body.hasKey, false);
  assert.equal((await request(`${path}/${endpointId}/activate`, 'POST', { role: 'compiler' })).status, 400);
  assert.equal((await request(`${path}/${endpointId}/test`, 'POST', { role: 'adjudicator' })).status, 400);
  assert.equal((await request(`${path}/${endpointId}/test`, 'POST', { role: 'compiler' })).status, 200);
  assert.equal(seen.at(-1)?.authorization, undefined, 'no invented key or empty Authorization header on localhost');
  assert.equal((await request(`${path}/${endpointId}/activate`, 'POST', { role: 'compiler' })).status, 200);
  assert.equal((await gateway.complete({ role: 'compiler', system: 's', user: 'hello' })).text, 'answered:model-a');
  const beforeGuard = seen.length;
  await gateway.complete({ role: 'adjudicator', system: 's', user: 'hello' });
  await gateway.embed(['hello']); await gateway.ocr('/tmp/fixture');
  assert.equal(seen.length, beforeGuard, 'judging, embedding, and OCR never reach the compiler endpoint');
  assert.equal((await request(`${path}/${endpointId}`, 'DELETE')).status, 400);
  assert.equal((await request(`${path}/${endpointId}`, 'PUT', { kind: 'endpoint', name: 'edited', baseUrl: providerUrl, model: 'model-b' })).status, 400);

  // Reuse the legacy form to verify it hot-applies too, and retains the other
  // role's selection in the same settings file.
  response = await request('/api/settings/compiler', 'PUT', { provider: 'custom', baseUrl: providerUrl, model: 'model-b', apiKey: '', redactNames: true });
  assert.equal(response.status, 200);
  assert.equal((await gateway.complete({ role: 'compiler', system: 's', user: 'hello' })).text, 'answered:model-b');
  assert.equal(selections().compiler, null);
  response = await request(`${path}/${endpointId}`, 'PUT', { kind: 'endpoint', name: 'My server', baseUrl: providerUrl, model: 'model-c', apiKey: 'super-secret-credential' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.testedRoles, []);
  assert.equal(JSON.stringify(response.body).includes('super-secret-credential'), false);
  endpointFailure = 'http';
  response = await request(`${path}/${endpointId}/test`, 'POST', { role: 'compiler' });
  assert.equal(response.status, 400); assert(!JSON.stringify(response.body).includes('super-secret'));
  endpointFailure = 'malformed';
  response = await request(`${path}/${endpointId}/test`, 'POST', { role: 'compiler' });
  assert.equal(response.status, 400); assert(!JSON.stringify(response.body).includes('super-secret'));
  endpointFailure = 'none';
  assert.equal((await request(`${path}/${endpointId}/test`, 'POST', { role: 'compiler' })).status, 200);
  endpointFailure = 'http';
  assert.equal((await request(`${path}/${endpointId}/activate`, 'POST', { role: 'compiler' })).status, 400);
  assert.equal(loadCompilerSettings().model, 'model-b', 'failed activation leaves previous compiler active');
  endpointFailure = 'none';
  assert.equal((await request(path, 'POST', { kind: 'endpoint', name: 'bad', baseUrl: 'https://user:password@example.com/v1', model: 'm', apiKey: 'k' })).status, 400);
  assert.equal((await request(path, 'POST', { kind: 'endpoint', name: 'bad', baseUrl: 'file:///etc/passwd', model: 'm' })).status, 400);

  // Remote administrators import their bytes, never an arbitrary gateway path.
  const upload = await fetch(`${base}${path}/upload?name=My%20judge&roles=compiler,adjudicator&format=dynaguard&filename=renamed.gguf`, {
    method: 'POST', headers: { ...admin, 'content-type': 'application/octet-stream' }, body: new Uint8Array(fixture)
  });
  assert.equal(upload.status, 201); const local = await upload.json() as { id: string };
  assert.equal(statSync(modelPath(findModel(local.id) as any)).size, fixture.length);
  assert.equal((await request(`${path}/${local.id}/test`, 'POST', { role: 'adjudicator' })).status, 200);
  assert.equal((await request(`${path}/${local.id}/activate`, 'POST', { role: 'adjudicator' })).status, 200);
  assert.equal(customAdjudicatorForm(), 'dynaguard', 'custom format does not depend on the filename');
  assert.equal(sourceFor('adjudicator'), modelPath({ id: local.id }));
  assert.equal(loadCompilerSettings().model, 'model-b', 'selecting a judge does not overwrite compiler settings');
  assert.equal((await request('/api/settings/adjudicator', 'POST', { model: 'default', modelId: local.id })).status, 200);
  assert.equal(selections().adjudicator, null, 'legacy preset route cannot smuggle an untested custom ID');

  // An active whole-decision lease blocks the writer, including its nested
  // generations, while new decisions queue after that writer.
  let release!: () => void;
  const events: string[] = [];
  const held = withModelRole('adjudicator', async () => {
    events.push('old started'); await new Promise<void>((r) => { release = r; });
    await withModelRole('adjudicator', async () => { events.push('nested finished'); });
  });
  await turn();
  const change = withRoleChange('adjudicator', async () => { events.push('swapped'); });
  const fresh = withModelRole('adjudicator', async () => { events.push('new started'); });
  await turn(); assert.deepEqual(events, ['old started']); release();
  await Promise.all([held, change, fresh]); assert.deepEqual(events, ['old started', 'nested finished', 'swapped', 'new started']);

  loadFailure = true;
  assert.equal((await request(`${path}/${local.id}/activate`, 'POST', { role: 'adjudicator' })).status, 400);
  assert.equal(loadAdjudicatorSettings().modelId, undefined, 'failed local load restores previous settings');
  loadFailure = false;
  assert.equal((await request(`${path}/${local.id}/activate`, 'POST', { role: 'adjudicator' })).status, 200);
  process.env['WARDEN_MODEL_COMPILER'] = fixturePath;
  assert.equal((await request(`${path}/${endpointId}/activate`, 'POST', { role: 'compiler' })).status, 400);
  delete process.env['WARDEN_MODEL_COMPILER'];
  assert.equal((await request(`${path}/${local.id}`, 'DELETE')).status, 400);
  saveAdjudicatorSettings({ model: 'default' });
  assert.equal((await request(`${path}/${local.id}`, 'PUT', { name: 'General model', roles: ['compiler'], format: 'compliance' })).status, 200);
  assert.deepEqual(findModel(local.id).tests, {});
  assert.equal((await request(`${path}/${local.id}`, 'DELETE')).status, 200);

  await assert.rejects(importUpload(Readable.from(Buffer.from('not gguf')), { name: 'bad', roles: ['compiler'], format: 'compliance' }, new AbortController().signal, 8));
  await assert.rejects(importUpload(Readable.from(fixture), { name: 'oversized', roles: ['compiler'], format: 'compliance' }, new AbortController().signal, MAX_MODEL_BYTES + 1));
  assert.deepEqual(readdirSync(managedModelsDir()).filter((f) => f.endsWith('.part')), []);
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1', '2002:7f00:1::']) assert.equal(publicAddress(address), false);
  assert.equal(publicAddress('1.1.1.1'), true);
  const job = startDownload({ name: 'private', url: 'https://127.0.0.1/model.gguf', roles: ['compiler'], format: 'compliance' });
  await turn(); assert.equal(downloadJobs().find((j) => j.id === job.id)?.state, 'failed');
  const cancelling = startDownload({ name: 'cancelled', url: 'https://example.com/model.gguf', roles: ['compiler'], format: 'compliance' });
  cancelDownload(cancelling.id); await turn(); await turn();
  assert.equal(downloadJobs().find((j) => j.id === cancelling.id)?.state, 'cancelled');

  assert.equal(statSync(catalogPath()).mode & 0o777, 0o600);
  const visible = JSON.stringify((await request(path)).body);
  assert(!visible.includes('super-secret-credential')); assert(!visible.includes('fingerprint')); assert(!visible.includes(temporary));
  const preserved = readFileSync(catalogPath(), 'utf8');
  writeFileSync(catalogPath(), '{broken');
  assert.throws(readCatalog, /unreadable/);
  assert.equal((await request(path, 'POST', { kind: 'endpoint', name: 'No data loss', baseUrl: providerUrl, model: 'm' })).status, 400);
  assert.equal(readFileSync(catalogPath(), 'utf8'), '{broken');
  writeFileSync(catalogPath(), preserved);
  const saved = readFileSync(process.env['WARDEN_SETTINGS_PATH'], 'utf8');
  writeFileSync(process.env['WARDEN_SETTINGS_PATH'], '{broken');
  assert.throws(() => saveCompilerSettings({ provider: 'local', baseUrl: '', model: '', apiKey: '', redactNames: false }), /unreadable/);
  assert.equal(readFileSync(process.env['WARDEN_SETTINGS_PATH'], 'utf8'), '{broken');
  writeFileSync(process.env['WARDEN_SETTINGS_PATH'], saved);
  await applyCompilerSettings({ provider: 'local', baseUrl: '', model: '', apiKey: '', redactNames: false });
  assert.equal(remoteCompiler(), null);
  assert(localCalls.some((c) => c.startsWith('test:')));
  console.log('Model management: HTTP authorization, streaming imports, persistence, no-auth endpoints, credential redaction, live switching, role isolation, validation, rollback and concurrency passed.');
} finally {
  server.closeAllConnections(); provider.closeAllConnections();
  await Promise.all([new Promise<void>((r) => server.close(() => r())), new Promise<void>((r) => provider.close(() => r()))]);
  rmSync(temporary, { recursive: true, force: true });
}
