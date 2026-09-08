/** Real admin HTTP routes and runtime prompt builders; only model generation is
 * replaced with a recording adapter. These tests make no model-accuracy claim. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { CompleteRequest, QvacAdapter } from '../src/qvac/types.js';
import type { PolicySpec } from '../src/policy/types.js';

const temporary = mkdtempSync(join(tmpdir(), 'warden-prompt-management-'));
for (const field of ['SETTINGS', 'COMPANY', 'POLICY', 'AUDIT', 'RATE_STATE', 'PROMPT', 'PROMPT_TEMPLATES']) {
  process.env[`WARDEN_${field}_PATH`] = join(temporary, `${field.toLowerCase()}.json`);
}
Object.assign(process.env, { WARDEN_ADAPTER: 'mock', WARDEN_ADMIN_REQUIRE_KEY: '1', WARDEN_THINKING_MARKER: '/no_think',
  WARDEN_ADJUDICATOR_FORM: 'compliance', WARDEN_RATE_REQUESTS: '10000' });
for (const key of ['WARDEN_COMPILER_API', 'WARDEN_COMPILER_API_KEY', 'WARDEN_COMPILER_CLI', 'WARDEN_COMPILER_REDACT_NAMES']) delete process.env[key];
writeFileSync(process.env.WARDEN_COMPANY_PATH!, JSON.stringify({ name: 'Prompt test company', roles: ['admin', 'employee'], employees: [
  { id: 'admin', name: 'Administrator', role: 'admin', apiKey: 'prompt-admin-key' },
  { id: 'employee', name: 'Employee', role: 'employee', apiKey: 'prompt-employee-key' }
] }));

const { promptBaselineHashes, promptRewriteBaselineHashes, promptRule, promptIsolation } = await import('./fixtures/prompt-baseline.js');
const { createApp } = await import('../src/server/app.js');
const { compileRule, compilePolicy } = await import('../src/policy/compile.js');
const { adjudicate, adjudicateAll } = await import('../src/guard/passes/adjudicate.js');
const { suggestRewrite } = await import('../src/guard/rewrite.js');
const { evaluate } = await import('../src/guard/pipeline.js');
const { isolate } = await import('../src/guard/isolate.js');
const { promptMetadata, withPromptSnapshot } = await import('../src/prompts/store.js');
const app = createApp();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address(); assert(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
type Template = { id: string; template: string; defaultTemplate: string; custom: boolean; active: boolean; requiredTokens: string[];
  tokens: { name: string; description: string; required: boolean }[]; outputContract: string };
type Catalog = { revision: string; templates: Template[] };
let catalog: Catalog;
async function request(path = '/api/prompts', method = 'GET', body?: unknown, key: string | null = 'prompt-admin-key') {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}),
    ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as any };
}
function entry(id: string): Template {
  const template = catalog.templates.find((item) => item.id === id);
  assert(template, `missing prompt template ${id}`); return template;
}
async function edit(id: string, template: string): Promise<void> {
  const response = await request(`/api/prompts/${id}`, 'PUT', { revision: catalog.revision, template });
  assert.equal(response.status, 200, JSON.stringify(response.body)); catalog = response.body;
}
async function reset(id: string): Promise<void> {
  const response = await request(`/api/prompts/${id}/reset`, 'POST', { revision: catalog.revision });
  assert.equal(response.status, 200, JSON.stringify(response.body)); catalog = response.body;
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }

const policy: PolicySpec = { version: 'prompt-test', updatedAt: '2026-09-08T00:00:00Z', rules: [promptRule], quotas: [], exemptRoles: ['admin'] };
const calls: CompleteRequest[] = [];
let onCall: ((req: CompleteRequest, index: number) => Promise<void>) | undefined;
let forceViolation = false;
let rewritten = '';
const capture: QvacAdapter = {
  async complete(req) { calls.push(req); await onCall?.(req, calls.length - 1); return { text: `<answer>${forceViolation ? 'FAIL' : 'PASS'}</answer>`, stats: { ms: 1 } }; },
  async completeJSON(req, schema, json) {
    calls.push(req); await onCall?.(req, calls.length - 1);
    const properties = json.properties as Record<string, { enum?: string[] }>;
    const value = properties.statements ? { statements: ['Do not publish private payroll.', 'Do not publish private source code.'] }
      : properties.rewritten ? { rewritten }
      : properties.verdict ? { verdict: forceViolation ? (properties.verdict.enum!.includes('FAIL') ? 'FAIL' : 'VIOLATES')
        : properties.verdict.enum!.find((label) => ['COMPLIES', 'ORDINARY_REQUEST', 'PASS'].includes(label)) }
      : { text: 'Do not publish private payroll.', scope: 'input', appliesTo: ['employee'], severity: 'block', guidance: 'Ask the payroll team.',
        examples: { violating: ['Publish private payroll.'], compliant: ['Ask how payroll approval works.'] } };
    return { value: schema.parse(value), attempts: 1, repaired: false, stats: { ms: 1 } };
  },
  async embed(texts) { return texts.map(() => [1, 0, 0]); }, async ocr() { throw new Error('unexpected legacy OCR'); },
  stats() { return { firstTry: 0, repaired: 0, failed: 0 }; }, async dispose() {}
};
const expected = JSON.parse(readFileSync(new URL('./fixtures/prompt-baseline.json', import.meta.url), 'utf8'));
const expectedRewrite = JSON.parse(readFileSync(new URL('./fixtures/prompt-rewrite-baseline.json', import.meta.url), 'utf8'));

try {
  for (const key of [null, 'prompt-employee-key']) {
    assert.equal((await request('/api/prompts', 'GET', undefined, key)).status, 403);
    assert.equal((await request('/api/prompts/compiler.compile.system', 'PUT', { revision: 'bad', template: 'replace' }, key)).status, 403);
    assert.equal((await request('/api/prompts/compiler.compile.system/reset', 'POST', { revision: 'bad' }, key)).status, 403);
  }
  const initial = await request(); assert.equal(initial.status, 200); catalog = initial.body;
  assert.equal(new Set(catalog.templates.map((item) => item.id)).size, catalog.templates.length);
  assert(catalog.templates.length >= 18);
  assert(catalog.templates.every((item) => !item.custom && item.template === item.defaultTemplate && typeof item.active === 'boolean'));
  assert.deepEqual(promptBaselineHashes(), expected, 'untouched defaults must preserve all 42 pre-editor byte hashes');
  assert.deepEqual(await promptRewriteBaselineHashes(), expectedRewrite, 'untouched rewrite system/user prompts must preserve their byte hashes');
  const initialRevision = catalog.revision;
  const initialPromptHash = promptMetadata().promptHash;
  console.log('✓ Admin-only catalog and writes; all 50 original prompt byte hashes are unchanged');

  const target = entry('analyzer.compliance.user');
  assert(target.requiredTokens.length > 0);
  const required = target.requiredTokens[0]!;
  for (const [template, detail] of [
    [target.defaultTemplate.split(`{{${required}}}`).join(''), 'missingTokens'],
    [`${target.defaultTemplate}\n{{unknown_private_variable}}`, 'unknownTokens']
  ] as const) {
    const rejected = await request(`/api/prompts/${target.id}`, 'PUT', { revision: catalog.revision, template });
    assert.equal(rejected.status, 400, JSON.stringify(rejected.body));
    assert.equal(rejected.body.code, 'invalid_template'); assert(Array.isArray(rejected.body[detail]));
    assert.equal((await request()).body.revision, catalog.revision);
  }
  assert.equal((await request(`/api/prompts/${target.id}`, 'PUT', { template: target.defaultTemplate })).status, 400);
  for (const body of [{ revision: catalog.revision, template: '' }, { revision: catalog.revision, template: 17 },
    { revision: catalog.revision, template: 'x'.repeat(200_000) }, { revision: catalog.revision, template: `${target.defaultTemplate}\0` },
    { revision: catalog.revision, template: `${target.defaultTemplate}\n{{unfinished` }]) {
    assert.equal((await request(`/api/prompts/${target.id}`, 'PUT', body)).status, 400);
  }
  assert.equal((await request('/api/prompts/not-a-template', 'PUT', { revision: catalog.revision, template: 'x' })).status, 404);
  const first = entry('compiler.compile.system');
  await edit(first.id, `${first.defaultTemplate}\nFIRST_CUSTOM_MARKER`);
  assert.notEqual(catalog.revision, initialRevision);
  assert.notEqual(promptMetadata().promptHash, initialPromptHash);
  const savedRevision = catalog.revision;
  const conflict = await request(`/api/prompts/${first.id}`, 'PUT', { revision: initialRevision, template: first.defaultTemplate });
  assert.equal(conflict.status, 409); assert.equal(conflict.body.code, 'revision_conflict');
  assert.equal(conflict.body.revision, savedRevision);
  assert.equal((await request(`/api/prompts/${first.id}/reset`, 'POST', { revision: initialRevision })).status, 409);
  assert.equal((await request()).body.revision, savedRevision);
  await edit(target.id, `${target.defaultTemplate}\nExample: {"result":{"verdict":"PASS"}}`);
  console.log('✓ Required and unknown variables, invalid templates and stale editor revisions are rejected without mutation');

  for (const template of [...catalog.templates]) await edit(template.id, `${template.defaultTemplate}\nCUSTOM[${template.id}]`);
  assert(catalog.templates.every((template) => template.custom));
  calls.length = 0;
  const compiled = await compilePolicy(capture, 'Protect payroll and source code.', policy, { roles: ['admin', 'employee'], people: [{ id: 'employee', name: 'Employee' }] });
  assert.equal(compiled.rules.length, 2); assert.equal(calls.length, 3);
  assert(calls[0]!.system.includes('CUSTOM[compiler.split.system]'));
  assert(calls[0]!.user.includes('CUSTOM[compiler.split.user]'));
  for (const call of calls.slice(1)) {
    assert(call.system.includes('CUSTOM[compiler.compile.system]')); assert(call.user.includes('CUSTOM[compiler.compile.user]')); assert.equal(call.role, 'compiler');
  }
  const iso = promptIsolation();
  const otherRule = { ...promptRule, id: 'second-rule', text: 'Do not publish private source code.' };
  for (const form of ['compliance', 'choice', 'dynaguard', 'dynaguard-native'] as const) {
    calls.length = 0;
    await adjudicate(capture, iso, promptRule, { form, dynaguardPolicy: 'v1', dynaguardFence: true, shotsPerSide: 1 });
    assert.equal(calls.length, 1); assert.equal(calls[0]!.role, 'adjudicator');
    assert(calls[0]!.system.includes(`CUSTOM[analyzer.${form}.system]`), form);
    assert(calls[0]!.user.includes(`CUSTOM[analyzer.${form}.user]`), form);
    assert(`${calls[0]!.system}\n${calls[0]!.user}`.includes(promptRule.text));
    assert(calls[0]!.user.includes(iso.clean));
    if (form.startsWith('dynaguard')) {
      assert(calls[0]!.user.includes('CUSTOM[analyzer.dynaguard.policy.v1]'));
      calls.length = 0;
      await adjudicate(capture, iso, promptRule, { form, dynaguardPolicy: 'v2', dynaguardFence: false });
      assert(calls[0]!.user.includes('CUSTOM[analyzer.dynaguard.policy.v2]'));
      calls.length = 0;
      const screened = await adjudicateAll(capture, iso, [promptRule, otherRule], { form, screen: true });
      assert.equal(screened.screen?.label, 'COMPLIES'); assert.equal(calls.length, 1);
      assert(calls[0]!.user.includes(`CUSTOM[analyzer.${form}.screen.user]`));
      assert(calls[0]!.user.includes(promptRule.text)); assert(calls[0]!.user.includes(otherRule.text));
    }
  }
  calls.length = 0;
  await suggestRewrite(capture, { actor: { id: 'employee', role: 'employee' }, prompt: iso.clean, policy,
    decision: { firedRules: [{ ruleId: promptRule.id, ruleText: promptRule.text, severity: 'block', reason: 'fixture', confidence: 0.9 }], passes: [] } });
  assert.equal(calls.length, 1);
  assert(calls[0]!.system.includes('CUSTOM[analyzer.rewrite.system]'));
  assert(calls[0]!.user.includes('CUSTOM[analyzer.rewrite.user]'));
  console.log('✓ Saved templates reach compile/split, every analyzer form and policy variant, multi-rule screening and rewrite');

  const literal = 'LITERAL {{rule}} {{message}} {{nonce}} $& $$ $`';
  calls.length = 0;
  await compileRule(capture, literal, policy);
  assert(calls[0]!.user.includes(literal), 'compiler message values must never be recursively expanded');
  for (const form of ['compliance', 'dynaguard-native'] as const) {
    calls.length = 0;
    await adjudicate(capture, isolate(literal), { ...promptRule, text: `RULE_VALUE ${literal}` }, { form });
    assert(calls[0]!.user.includes(literal), 'employee braces and replacement metacharacters remain literal');
    assert(`${calls[0]!.system}\n${calls[0]!.user}`.includes(`RULE_VALUE ${literal}`), 'nested policy context must remain literal');
  }
  const bounded = entry('analyzer.compliance.user');
  await edit(bounded.id, bounded.defaultTemplate.padEnd(32_768, ' '));
  assert.equal((await request(`/api/prompts/${bounded.id}`, 'PUT', { revision: catalog.revision, template: bounded.defaultTemplate.padEnd(32_769, ' ') })).status, 400);
  await edit(bounded.id, `${bounded.defaultTemplate}\n${'{{message}}'.repeat(100)}`);
  calls.length = 0;
  const overContext = await adjudicateAll(capture, isolate('Ordinary business request. '.repeat(200)), [promptRule], { form: 'compliance' });
  assert.equal(overContext.verdicts.length, 0); assert(overContext.traces.some((trace) => trace.failedClosed)); assert.equal(calls.length, 0);
  await edit(bounded.id, bounded.template);
  const persisted = readFileSync(process.env.WARDEN_PROMPT_TEMPLATES_PATH!, 'utf8');
  assert(persisted.includes('CUSTOM[compiler.compile.system]')); assert(!persisted.includes(literal));
  const reopened = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval',
    `const { createApp } = await import('./src/server/app.ts'); const server = createApp().listen(0, '127.0.0.1');
     await new Promise(resolve => server.once('listening', resolve));
     const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/prompts', { headers: { authorization: 'Bearer prompt-admin-key' } });
     console.log(JSON.stringify(await response.json())); server.closeAllConnections(); server.close();`], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 15_000 });
  assert.equal(reopened.status, 0, reopened.stderr);
  const reopenedCatalog = JSON.parse(reopened.stdout.trim().split('\n').at(-1)!);
  assert.equal(reopenedCatalog.revision, catalog.revision);
  assert.deepEqual(reopenedCatalog.templates.map((item: Template) => [item.id, item.template, item.custom]), catalog.templates.map((item) => [item.id, item.template, item.custom]));
  console.log('✓ Literal context substitution and fresh-process persistence; employee context is never saved as a template');

  await withPromptSnapshot(async () => {
    const pinned = promptMetadata();
    const current = entry('compiler.compile.user');
    await edit(current.id, `${current.template}\nSNAPSHOT_IDENTITY_MARKER`);
    assert.deepEqual(promptMetadata(), pinned, 'snapshot metadata must stay bound to the same effective prompt text');
  });
  assert.equal(promptMetadata().promptRevision, catalog.revision);

  // A save may wait for the active role lease or commit immediately behind a
  // snapshot. Either way, later calls in one operation must retain its first version.
  for (const operation of ['compiler', 'analyzer', 'rewrite'] as const) {
    const id = operation === 'compiler' ? 'compiler.compile.system' : 'analyzer.compliance.system';
    const before = entry(id).template;
    const entered = deferred(); const release = deferred(); calls.length = 0;
    onCall = async (_req, index) => { if (index === 0) { entered.resolve(); await release.promise; } };
    rewritten = operation === 'rewrite' ? iso.clean : '';
    const pending = operation === 'compiler'
      ? compilePolicy(capture, 'Protect payroll and source code.', policy)
      : operation === 'rewrite' ? suggestRewrite(capture, { actor: { id: 'employee', role: 'employee' }, prompt: iso.clean, policy,
        decision: { firedRules: [{ ruleId: promptRule.id, ruleText: promptRule.text, severity: 'block', reason: 'fixture', confidence: 0.9 }], passes: [] } })
      : adjudicateAll(capture, isolate('Ordinary business context. '.repeat(12)), [promptRule, otherRule], { form: 'compliance', windowChars: 100, windowOverlap: 20 });
    await entered.promise;
    const changing = edit(id, `${before}\nNEW_VERSION_${operation}`);
    await Promise.race([changing, delay(40)]);
    release.resolve(); await pending; await changing; onCall = undefined;
    assert(calls.length > 1);
    assert(calls.every((req) => !req.system.includes(`NEW_VERSION_${operation}`)), 'one operation cannot mix prompt versions between calls');
    calls.length = 0;
    if (operation === 'compiler') await compileRule(capture, 'Protect payroll.', policy);
    else await adjudicate(capture, iso, promptRule, { form: 'compliance' });
    assert(calls[0]!.system.includes(`NEW_VERSION_${operation}`), 'the next operation must see the saved version');
  }
  rewritten = '';
  console.log('✓ Concurrent edits preserve one version across split/compile, multi-rule/windows and rewrite/recheck');

  // An audit disk failure happens after the durable prompt write. The editor
  // must receive the saved revision, not an apparent failure and a stale form.
  const auditPath = process.env.WARDEN_AUDIT_PATH!;
  const auditBackup = `${auditPath}.backup`;
  const logging: unknown[][] = [];
  const originalError = console.error;
  renameSync(auditPath, auditBackup); mkdirSync(auditPath);
  try {
    console.error = (...args: unknown[]) => { logging.push(args); };
    const current = entry('compiler.compile.user');
    await edit(current.id, `${current.template}\nAUDIT_FAILURE_SAVE`);
    assert(entry(current.id).template.includes('AUDIT_FAILURE_SAVE'));
    assert(readFileSync(process.env.WARDEN_PROMPT_TEMPLATES_PATH!, 'utf8').includes('AUDIT_FAILURE_SAVE'));
    assert(logging.length > 0);
  } finally {
    console.error = originalError; rmSync(auditPath, { recursive: true }); renameSync(auditBackup, auditPath);
  }
  console.log('✓ A post-save audit failure reports the actual persisted revision instead of losing the successful edit');

  for (const template of [...catalog.templates]) await reset(template.id);
  assert(catalog.templates.every((template) => !template.custom && template.template === template.defaultTemplate));
  assert.deepEqual(promptBaselineHashes(), expected);
  assert.deepEqual(await promptRewriteBaselineHashes(), expectedRewrite);
  assert.equal(promptMetadata().promptHash, initialPromptHash, 'effective identity returns to the same hash after every override is reset');
  assert.notEqual(catalog.revision, initialRevision, 'edit revision is separate from effective prompt content identity');
  const audit = readFileSync(process.env.WARDEN_AUDIT_PATH!, 'utf8');
  assert(audit.includes('prompt:update') && audit.includes('sha256='));
  assert(!audit.includes('FIRST_CUSTOM_MARKER') && !audit.includes('SNAPSHOT_IDENTITY_MARKER'), 'prompt audit records identities, never the saved text');
  console.log('✓ Reset restores all original prompts byte-for-byte');

  const intact = readFileSync(process.env.WARDEN_PROMPT_TEMPLATES_PATH!, 'utf8');
  writeFileSync(process.env.WARDEN_PROMPT_TEMPLATES_PATH!, '{invalid-json');
  try {
    assert.equal((await request()).status, 503);
    assert.equal((await request('/api/prompts/compiler.compile.system', 'PUT', { revision: catalog.revision, template: entry('compiler.compile.system').defaultTemplate })).status, 503);
    assert.equal(readFileSync(process.env.WARDEN_PROMPT_TEMPLATES_PATH!, 'utf8'), '{invalid-json');
    calls.length = 0;
    const held = await adjudicateAll(capture, iso, [promptRule], { form: 'compliance' });
    assert.equal(held.verdicts.length, 0); assert(held.traces.some((trace) => trace.failedClosed)); assert.equal(calls.length, 0);
    const decision = await evaluate(capture, { actor: { id: 'employee', role: 'employee' }, prompt: iso.clean }, policy);
    assert.equal(decision.verdict, 'ESCALATE'); assert.equal(calls.length, 0);
    await assert.rejects(compileRule(capture, 'Protect payroll.', policy), /saved prompt templates are unreadable/);
  } finally { writeFileSync(process.env.WARDEN_PROMPT_TEMPLATES_PATH!, intact); }
  console.log('✓ A corrupt prompt store holds analysis and refuses compilation instead of silently restoring defaults');
} finally {
  onCall = undefined;
  server.closeAllConnections(); const closed = once(server, 'close'); server.close(); await closed;
  rmSync(temporary, { recursive: true, force: true });
}
