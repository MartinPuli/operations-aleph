import { setMaxListeners } from 'node:events';
import { withModelRole } from '../qvac/coordination.js';
import type { CompleteRequest, QvacAdapter } from '../qvac/types.js';

export const DOCUMENT_ANALYSIS_LIMITS = { timeoutMs: 180_000, callTimeoutMs: 60_000, cancelGraceMs: 5_000 };
const timeoutError = () => new Error('Document analysis timed out before all content and rules were checked. The document was not cleared.');
const cancelledError = () => new Error('Document analysis was cancelled before all content and rules were checked. The document was not cleared.');

/** QVAC serializes completions for a model, even with parallel: 4. Admit one
 * document call at a time so its generation budget does not expire in that
 * hidden queue. Share admission across documents using the same adapter. */
class DocumentQueue {
  private busy = false;
  private waiting: (() => void)[] = [];

  async run<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    let abort: () => void = () => {};
    await new Promise<void>((resolve, reject) => {
      const enter = () => { this.busy = true; signal.removeEventListener('abort', abort); resolve(); };
      abort = () => { this.waiting = this.waiting.filter((item) => item !== enter); reject(signal.reason); };
      if (signal.aborted) { reject(signal.reason); return; }
      if (!this.busy) enter();
      else { this.waiting.push(enter); signal.addEventListener('abort', abort, { once: true }); }
    });
    try { signal.throwIfAborted(); return await work(); }
    finally {
      this.busy = false;
      this.waiting.shift()?.();
    }
  }
}

const queues = new WeakMap<QvacAdapter, DocumentQueue>();

/** Reading has its own deadline. Analysis gets a bounded document budget plus
 * a fresh per-call budget on admission; every rule and window is still judged.
 * Retain the active slot/role lease while native cancellation settles. */
export async function withDocumentBudget<T>(
  qvac: QvacAdapter,
  signal: AbortSignal | undefined,
  work: (bounded: QvacAdapter) => Promise<T>,
  limits = DOCUMENT_ANALYSIS_LIMITS
): Promise<T> {
  const controller = new AbortController();
  setMaxListeners(0, controller.signal);
  const deadline = Date.now() + limits.timeoutMs;
  const expire = () => controller.abort(timeoutError());
  const cancel = () => controller.abort(cancelledError());
  const timer = setTimeout(expire, limits.timeoutMs);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let queue = queues.get(qvac);
  if (!queue) { queue = new DocumentQueue(); queues.set(qvac, queue); }

  const bounded = <R>(req: CompleteRequest, run: (request: CompleteRequest) => Promise<R>): Promise<R> =>
    queue.run(controller.signal, async () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) { expire(); throw controller.signal.reason; }
      const call = new AbortController();
      const stop = () => call.abort(controller.signal.reason);
      controller.signal.addEventListener('abort', stop, { once: true });
      const timeoutMs = Math.min(limits.callTimeoutMs, remaining);
      const callTimer = setTimeout(() => call.abort(timeoutError()), timeoutMs);
      let grace: NodeJS.Timeout | undefined;
      const hardStop = new Promise<never>((_resolve, reject) => {
        call.signal.addEventListener('abort', () => {
          grace = setTimeout(() => reject(call.signal.reason), limits.cancelGraceMs);
        }, { once: true });
      });
      try {
        const result = await Promise.race([run({ ...req, timeoutMs, signal: call.signal }), hardStop]);
        call.signal.throwIfAborted();
        return result;
      } catch (error) {
        if (call.signal.aborted) throw call.signal.reason;
        throw error;
      } finally {
        clearTimeout(callTimer); clearTimeout(grace);
        controller.signal.removeEventListener('abort', stop);
      }
    });

  try {
    return await withModelRole('adjudicator', () => work({
      complete: (req) => bounded(req, (request) => qvac.complete(request)),
      completeJSON: (req, schema, jsonSchema) => bounded(req, (request) => qvac.completeJSON(request, schema, jsonSchema)),
      embed: (texts) => qvac.embed(texts), ocr: (path) => qvac.ocr(path),
      stats: () => qvac.stats(), dispose: () => qvac.dispose()
    }), controller.signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    cancel();
  }
}
