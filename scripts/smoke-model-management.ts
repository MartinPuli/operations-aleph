/** Optional real-runtime check. Supply an existing, general-purpose GGUF:
 * tsx scripts/smoke-model-management.ts /absolute/path/to/model.gguf
 * Everything imported or selected here lives in a temporary installation. */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const file = process.argv[2];
if (!file) throw new Error('Supply the path to an existing general-purpose GGUF');
const temporary = mkdtempSync(join(tmpdir(), 'warden-model-smoke-'));
process.env['WARDEN_SETTINGS_PATH'] = join(temporary, 'settings.json');
process.env['WARDEN_MODEL_CATALOG_PATH'] = join(temporary, 'models.json');
process.env['WARDEN_MODELS_DIR'] = join(temporary, 'weights');
delete process.env['WARDEN_ADAPTER'];
for (const name of ['WARDEN_MODEL_COMPILER', 'WARDEN_MODEL_ADJUDICATOR', 'WARDEN_COMPILER_API', 'WARDEN_COMPILER_API_KEY', 'WARDEN_COMPILER_CLI']) delete process.env[name];
const { ModelManager, withModelManagement, deleteModel } = await import('../src/models/manager.js');
const { importLocalFile } = await import('../src/models/transfers.js');
const { adapter } = await import('../src/qvac/index.js');
const { activeLocalModel, configuredModel, customAdjudicatorForm, resolvedModel } = await import('../src/qvac/client.js');
const { saveAdjudicatorSettings } = await import('../src/settings.js');
const manager = new ModelManager();
try {
  const entry = await importLocalFile(resolve(file), { name: 'Isolated runtime smoke', roles: ['compiler', 'adjudicator'], format: 'compliance' });
  for (const role of ['compiler', 'adjudicator'] as const) {
    const started = Date.now();
    await withModelManagement(() => manager.test(entry.id, role));
    await withModelManagement(() => manager.activate(entry.id, role));
    assert(activeLocalModel(role)?.includes(entry.id));
    console.log(`${role}: imported, tested and loaded in ${Date.now() - started} ms`);
  }
  assert.equal(customAdjudicatorForm(), 'compliance');
  const result = await adapter().completeJSON({ role: 'compiler', system: 'Reply in JSON.', user: 'Return {"status":"ready"}.', maxTokens: 32 },
    z.object({ status: z.literal('ready') }), { type: 'object', properties: { status: { type: 'string', enum: ['ready'] } }, required: ['status'], additionalProperties: false });
  assert.equal(result.value.status, 'ready');
  // Choosing an unavailable built-in starts a download while the loaded
  // custom judge continues. Its format and deletion protection must follow
  // the weights that are actually serving, not the newly desired filename.
  saveAdjudicatorSettings({ model: 'dynaguard-8b' });
  assert.equal(customAdjudicatorForm(), 'compliance');
  assert(resolvedModel('adjudicator').includes(entry.id));
  assert.equal(configuredModel('adjudicator'), 'DynaGuard-8B.Q4_K_M.gguf');
  assert.throws(() => deleteModel(entry.id), /active model/);
  const stillJudging = await adapter().completeJSON({ role: 'adjudicator', system: 'Reply in JSON.', user: 'Return {"verdict":"COMPLIES"}.', maxTokens: 32 },
    z.object({ verdict: z.literal('COMPLIES') }), { type: 'object', properties: { verdict: { type: 'string', enum: ['COMPLIES'] } }, required: ['verdict'], additionalProperties: false });
  assert.equal(stillJudging.value.verdict, 'COMPLIES');
  console.log('Real QVAC model-management smoke passed. This checks compatibility and activation, not guard accuracy.');
} finally {
  await adapter().dispose();
  rmSync(temporary, { recursive: true, force: true });
}
