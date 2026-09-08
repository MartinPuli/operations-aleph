/** Native lifecycle fixtures: no model files, GPU, account or installation state. */
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { z } from 'zod';
import { RealQvacAdapter, runCancellableGeneration } from '../src/qvac/real.js';
import { LlamaCppAdapter } from '../src/qvac/llamacpp.js';
import { completeWithRepair } from '../src/qvac/json.js';
import { withModelRole, withRoleChange } from '../src/qvac/coordination.js';
import { withDocumentBudget } from '../src/guard/document-budget.js';
import { FailClosedError, type CompleteRequest, type QvacAdapter } from '../src/qvac/types.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const request = (signal?: AbortSignal): CompleteRequest => ({ role: 'adjudicator', system: 'Synthetic system.', user: 'Synthetic request.', signal });
const wasCancelled = (error: unknown) => error instanceof FailClosedError && /cancelled/.test(error.message) && !error.message.includes('private reason');
const noListeners = (signal: AbortSignal) => assert.equal(getEventListeners(signal, 'abort').length, 0);

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Fixture did not settle after its deadline')), 1_000);
    })]);
  } finally { clearTimeout(timer); }
}

{
  const held = deferred<void>(); const writerStarted = deferred<void>();
  const writer = withRoleChange('adjudicator', async () => { writerStarted.resolve(); await held.promise; });
  await writerStarted.promise;
  let calls = 0;
  const runtime: QvacAdapter = {
    complete: async () => { calls++; return { text: 'PASS', stats: { ms: 1 } }; },
    completeJSON: async () => assert.fail('Unexpected structured call'), embed: async () => [], ocr: async () => '',
    stats: () => ({ firstTry: 0, repaired: 0, failed: 0 }), dispose: async () => {}
  };
  try {
    await assert.rejects(bounded(withDocumentBudget(runtime, undefined, (qvac) => qvac.complete(request()),
      { timeoutMs: 10, callTimeoutMs: 10, cancelGraceMs: 10 })), /Document analysis timed out/);
    assert.equal(calls, 0, 'A document waiting for model activation must expire before any generation');
  } finally { held.resolve(); await writer; }
  // An aborted reader left in the coordinator would acquire an orphaned lease
  // on release and permanently block this next writer.
  await bounded(withRoleChange('adjudicator', async () => {}));
  assert.equal(calls, 0);
  const result = await bounded(withDocumentBudget(runtime, undefined, (qvac) => qvac.complete(request())));
  assert.equal(result.text, 'PASS'); assert.equal(calls, 1);
  console.log('✓ Document deadlines remove queued role readers before generation and do not poison later model changes');
}

{
  const controller = new AbortController(); controller.abort('private reason');
  let prepares = 0;
  await assert.rejects(runCancellableGeneration(request(controller.signal), async () => {
    prepares++; return () => ({ requestId: 'never', result: Promise.resolve('unused') });
  }, async () => assert.fail('No request exists to cancel'), 1_000), wasCancelled);
  assert.equal(prepares, 0); noListeners(controller.signal);
  await assert.rejects(new RealQvacAdapter().complete(request(controller.signal)), wasCancelled);
  await assert.rejects(new LlamaCppAdapter().complete(request(controller.signal)), wasCancelled);
  console.log('✓ Already cancelled requests neither load nor launch native generation');
}

{
  const controller = new AbortController();
  const load = deferred<() => { requestId: string; result: Promise<string> }>();
  let launches = 0;
  const pending = runCancellableGeneration(request(controller.signal), () => load.promise, async () => assert.fail('Shared loads must not be cancelled'), 1_000);
  const rejected = assert.rejects(pending, wasCancelled);
  controller.abort('private reason'); await rejected; noListeners(controller.signal);
  load.resolve(() => { launches++; return { requestId: 'late-load', result: Promise.resolve('late') }; });
  await nextTurn(); assert.equal(launches, 0);

  const atBoundary = new AbortController();
  await assert.rejects(runCancellableGeneration(request(atBoundary.signal), async () => {
    atBoundary.abort(); return () => { launches++; return { requestId: 'boundary', result: Promise.resolve('late') }; };
  }, async () => assert.fail('Generation must not start'), 1_000), wasCancelled);
  assert.equal(launches, 0); noListeners(atBoundary.signal);
  console.log('✓ Cancellation releases cold-load waiters without cancelling shared loads or launching late work');
}

{
  const controller = new AbortController(); const final = deferred<string>(); const started = deferred<void>();
  const cancellations: string[] = []; let settled = false; let swapped = false;
  const pending = withModelRole('adjudicator', () => runCancellableGeneration(request(controller.signal), async () => () => {
    started.resolve(); return { requestId: 'exact-request', result: final.promise };
  }, async (id) => { cancellations.push(id); }, 1_000, 500), controller.signal);
  const rejected = assert.rejects(pending, wasCancelled).then(() => { settled = true; });
  await started.promise;
  const swap = withRoleChange('adjudicator', async () => { swapped = true; });
  controller.abort('private reason'); await nextTurn();
  assert.deepEqual(cancellations, ['exact-request']); assert.equal(settled, false); assert.equal(swapped, false);
  final.resolve('schema-valid but late output'); await rejected; await swap;
  assert.equal(swapped, true); noListeners(controller.signal);
  console.log('✓ Active cancellation targets its request, holds the role lease until settlement and discards late success');
}

{
  const controller = new AbortController(); const started = deferred<void>(); const final = deferred<string>();
  let cancellations = 0;
  const pending = runCancellableGeneration(request(controller.signal), async () => () => {
    started.resolve(); return { requestId: 'hung-worker', result: final.promise };
  }, async () => { cancellations++; throw new Error('Worker unavailable'); }, 1_000, 10);
  const rejected = assert.rejects(pending, wasCancelled);
  await started.promise; controller.abort(); await rejected;
  assert.equal(cancellations, 1); noListeners(controller.signal);
  final.reject(new Error('Abandoned worker eventually failed')); await nextTurn();
  console.log('✓ A hung worker and failed cancel remain bounded; abandoned failures are handled');
}

{
  const controller = new AbortController(); const final = deferred<string>(); let cancellations = 0;
  await assert.rejects(runCancellableGeneration(request(controller.signal), async () => () => ({ requestId: 'timed-out', result: final.promise }), async (id) => {
    assert.equal(id, 'timed-out'); cancellations++; final.resolve('valid but after the deadline');
  }, 10, 500), (error: unknown) => error instanceof FailClosedError && /timed out/.test(error.message));
  controller.abort(); assert.equal(cancellations, 1); noListeners(controller.signal);

  const afterFinish = new AbortController();
  assert.equal(await runCancellableGeneration(request(afterFinish.signal), async () => () => ({ requestId: 'good', result: Promise.resolve('unchanged') }), async () => assert.fail('Finished work must not be cancelled'), 1_000), 'unchanged');
  noListeners(afterFinish.signal); afterFinish.abort();
  const failure = new Error('Native fixture failure'); const failed = new AbortController();
  await assert.rejects(runCancellableGeneration(request(failed.signal), async () => () => ({ requestId: 'failed', result: Promise.reject(failure) }), async () => assert.fail('Settled work must not be cancelled'), 1_000), (error: unknown) => error === failure);
  noListeners(failed.signal);
  console.log('✓ Deadlines reject late success; normal success and native failures retain their original results and clean up listeners');
}

{
  const schema = z.object({ verdict: z.enum(['PASS', 'FAIL']) });
  for (const text of ['not JSON', '{"verdict":"PASS"}']) {
    const controller = new AbortController(); let calls = 0;
    await assert.rejects(completeWithRepair(async () => {
      calls++; controller.abort('private reason'); return { text, stats: { ms: 1 } };
    }, request(controller.signal), schema, 'fixture'), wasCancelled);
    assert.equal(calls, 1);
  }
  const before = new AbortController(); before.abort();
  await assert.rejects(completeWithRepair(async () => assert.fail('No attempt after cancellation'), request(before.signal), schema, 'fixture'), wasCancelled);
  const duringRepair = new AbortController(); let attempts = 0;
  await assert.rejects(completeWithRepair(async (req) => {
    assert.equal(req.signal, duringRepair.signal); attempts++;
    if (attempts === 2) duringRepair.abort();
    return { text: attempts === 1 ? 'not JSON' : '{"verdict":"PASS"}', stats: { ms: 1 } };
  }, request(duringRepair.signal), schema, 'fixture'), wasCancelled);
  assert.equal(attempts, 2);
  let repairs = 0;
  const normal = await completeWithRepair(async () => ({ text: ++repairs === 1 ? 'not JSON' : '{"verdict":"PASS"}', stats: { ms: 1 } }), request(), schema, 'fixture');
  assert.equal(normal.attempts, 2); assert.equal(normal.value.verdict, 'PASS'); assert.equal(normal.stats.ms, 2);
  console.log('✓ Cancelled structured calls neither repair nor accept late JSON; normal repair behavior is unchanged');
}

console.log('QVAC cancellation: 7 groups passed');
