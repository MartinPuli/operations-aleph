import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { withDocumentBudget } from '../src/guard/document-budget.js';
import type { CompleteRequest, QvacAdapter } from '../src/qvac/types.js';

const request: CompleteRequest = { role: 'adjudicator', system: '', user: 'Synthetic document' };
const response = { text: 'PASS', stats: { ms: 1 } };
function adapter(complete: QvacAdapter['complete']): QvacAdapter {
  return { complete, completeJSON: async () => { throw new Error('unused'); }, embed: async () => [],
    ocr: async () => '', stats: () => ({ firstTry: 0, repaired: 0, failed: 0 }), dispose: async () => {} };
}
const limits = { timeoutMs: 2_000, callTimeoutMs: 100, cancelGraceMs: 15 };

// A real serialized engine can finish each call well inside its deadline, yet
// twelve submissions spend longer than that deadline waiting for one another.
let active = 0;
let peak = 0;
const seen: string[] = [];
const runtime = adapter(async (req) => {
  peak = Math.max(peak, ++active); seen.push(req.user);
  try { await delay(15, undefined, { signal: req.signal }); return response; }
  finally { active--; }
});
const started = Date.now();
const result = await withDocumentBudget(runtime, undefined, (bounded) => Promise.all(
  Array.from({ length: 12 }, (_, i) => bounded.complete({ ...request, user: String(i) }))
), limits);
assert.equal(result.length, 12);
assert.equal(peak, 1);
assert.deepEqual(seen, Array.from({ length: 12 }, (_, i) => String(i)));
assert.ok(Date.now() - started > limits.callTimeoutMs, 'queue wait must not consume the active call budget');
console.log('✓ Twelve queued document checks finish with a fresh generation deadline on admission');

peak = 0;
await Promise.all(Array.from({ length: 3 }, () => withDocumentBudget(runtime, undefined,
  (bounded) => Promise.all([bounded.complete(request), bounded.complete(request)]), limits)));
assert.equal(peak, 1, 'simultaneous documents must share runtime admission');
console.log('✓ Concurrent documents share one inference slot');

const controller = new AbortController();
let launches = 0;
let nativeSettled = false;
const cancellable = adapter(async (req) => {
  launches++;
  await new Promise<void>((resolve) => req.signal!.addEventListener('abort', () => {
    setTimeout(() => { nativeSettled = true; resolve(); }, 5);
  }, { once: true }));
  return response; // A cancelled native stream can still return a partial label.
});
const cancelled = withDocumentBudget(cancellable, controller.signal, async (bounded) => {
  const pending = [bounded.complete(request), bounded.complete(request), bounded.complete(request)];
  setTimeout(() => controller.abort(), 10);
  return Promise.allSettled(pending);
}, limits);
assert.ok((await cancelled).every((item) => item.status === 'rejected' && /cancelled/.test(String(item.reason))));
assert.equal(launches, 1, 'cancellation must remove queued calls before they reach the model');
assert.equal(nativeSettled, true, 'keep the active slot/lease until native cancellation settles');
console.log('✓ Disconnect cancels active work, removes queued work and rejects late PASS output');

let completed = 0;
const slow = adapter(async (req) => {
  await delay(30, undefined, { signal: req.signal }); completed++; return response;
});
const expired = await withDocumentBudget(slow, undefined, (bounded) => Promise.allSettled(
  Array.from({ length: 12 }, () => bounded.complete(request))
), { ...limits, timeoutMs: 85 });
assert.ok(completed > 0 && completed < 12);
assert.ok(expired.some((item) => item.status === 'rejected' && /timed out/.test(String(item.reason))));
assert.equal(expired.filter((item) => item.status === 'fulfilled').length, completed);
const after = await withDocumentBudget(slow, undefined, (bounded) => bounded.complete(request), limits);
assert.equal(after.text, 'PASS', 'expired queued work must not poison the next document');
console.log('✓ The overall document deadline still bounds work and preserves completed evidence');

const stalled = adapter(async () => new Promise(() => {}));
await assert.rejects(withDocumentBudget(stalled, undefined, (bounded) => bounded.complete(request),
  { ...limits, callTimeoutMs: 10 }), /timed out/);
console.log('✓ An unresponsive adapter is bounded even if it ignores cancellation');
