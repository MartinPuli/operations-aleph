/**
 * The real QVAC adapter — every model call in Warden goes through here.
 *
 * Structured output is defended twice. The SDK's `responseFormat: json_schema`
 * constrains decoding with a grammar, so the model *cannot* emit anything but
 * schema-shaped JSON. That handles syntax. It does not handle meaning: a
 * grammar cannot express "confidence is between 0 and 1" or "reason is
 * non-empty", and a syntactically perfect verdict can still be nonsense. Zod
 * catches that second class, one repair attempt tries to fix it, and anything
 * still broken throws rather than returning a guess.
 *
 * The counters are not incidental. "94% validate first try, 5% need a repair,
 * 1% fail closed" is the kind of measured claim the reliability track asks for,
 * and it comes straight out of this file.
 */
import { cancel, completion, embed, ocr } from '@qvac/sdk';
import type { ZodType } from 'zod';
import { modelFor, shutdown } from './client.js';
import { completeWithRepair } from './json.js';
import { withDeadline } from './deadline.js';
import {
  FailClosedError,
  type CompleteRequest,
  type GenStats,
  type QvacAdapter,
  type StructuredResult
} from './types.js';

/** Small models drift and pad without a cap; verdicts are short by nature. */
const DEFAULT_MAX_TOKENS = 256;
/**
 * The ceiling for a call that names no deadline of its own.
 *
 * Overridable because it silently capped the pass-level one: a pass asking for
 * 180 seconds still died at 30, and the error read "generation did not end
 * within 30000ms" out of a run configured for three minutes.
 */
const DEFAULT_TIMEOUT_MS = Number(process.env['WARDEN_GENERATION_TIMEOUT_MS'] ?? 30_000);

/** How long after asking a generation to cancel we wait before giving up on it. */
const CANCEL_GRACE_MS = 5_000;

/**
 * Deadlines for the two SDK calls that are not generations.
 *
 * `completion()` had a hard stop and these did not, which is a distinction the
 * caller cannot see and an attacker can. Retrieval embeds the whole prompt, so
 * a long enough message parks the embedder — measured at 13 minutes on one
 * `volume-distraction` prompt, against a 14ms p50 for a normal one. The guard
 * request behind it waits, the hook hits its own 30s deadline, and it fails
 * open by design. That turns "send a very large prompt" into a bypass, which is
 * exactly what that corpus class is built to try.
 *
 * Both are generous — 700x the measured p50 for embedding — because the point
 * is to bound a hang, not to fail slow work. Loading the model is bounded
 * separately in `client.ts`, since it happens before either call.
 */
const EMBED_TIMEOUT_MS = 10_000;
const OCR_TIMEOUT_MS = 30_000;

/**
 * Fixed seed and zero temperature by default.
 *
 * Guard verdicts should not vary run to run, and the red-team numbers are only
 * defensible if a rerun reproduces them.
 */
const DEFAULT_SEED = 42;

export class RealQvacAdapter implements QvacAdapter {
  #firstTry = 0;
  #repaired = 0;
  #failed = 0;

  async complete(req: CompleteRequest): Promise<{ text: string; stats: GenStats }> {
    const { text, stats } = await this.#run(req, undefined);
    return { text, stats };
  }

  async completeJSON<T>(
    req: CompleteRequest,
    zodSchema: ZodType<T>,
    jsonSchema: Record<string, unknown>
  ): Promise<StructuredResult<T>> {
    try {
      const result = await completeWithRepair((r) => this.#run(r, jsonSchema), req, zodSchema, 'structured output');
      if (result.repaired) this.#repaired++; else this.#firstTry++;
      return result;
    } catch (err) {
      if (err instanceof FailClosedError) this.#failed++;
      throw err;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const modelId = await modelFor('embedder');
    const res = await withDeadline(embed({ modelId, text: texts }), EMBED_TIMEOUT_MS, 'embed');

    // The SDK returns a bare vector for one input and a matrix for many.
    const raw = res.embedding as number[] | number[][];
    const isMatrix = Array.isArray(raw[0]);
    return isMatrix ? (raw as number[][]) : [raw as number[]];
  }

  async ocr(imagePath: string): Promise<string> {
    const modelId = await modelFor('ocr');
    // `ocr()` returns synchronously with promises inside; the blocks arrive later.
    const { blocks } = ocr({ modelId, image: imagePath, options: { paragraph: true } });
    const read = await withDeadline(blocks, OCR_TIMEOUT_MS, 'ocr');
    return read.map((b) => b.text).join('\n');
  }

  stats(): { firstTry: number; repaired: number; failed: number } {
    return { firstTry: this.#firstTry, repaired: this.#repaired, failed: this.#failed };
  }

  async dispose(): Promise<void> {
    await shutdown();
  }

  /** One generation, with a hard timeout and stats collection. */
  async #run(
    req: CompleteRequest,
    jsonSchema: Record<string, unknown> | undefined
  ): Promise<{ text: string; stats: GenStats }> {
    const modelId = await modelFor(req.role);
    const started = Date.now();

    const run = completion({
      modelId,
      stream: true,
      history: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user }
      ],
      generationParams: {
        temp: req.temp ?? 0,
        seed: req.seed ?? DEFAULT_SEED,
        predict: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        // Qwen3 emits <think> blocks by default. In guard passes that is pure
        // latency spent on a closed yes/no question, so it is switched off
        // here and with a /no_think marker in the pass prompts.
        reasoning_budget: 0
      },
      ...(req.kvKey ? { kvCache: req.kvKey } : {}),
      ...(jsonSchema
        ? {
            responseFormat: {
              type: 'json_schema' as const,
              json_schema: { name: 'response', strict: true, schema: jsonSchema }
            }
          }
        : {})
    });

    const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => {
      void cancel({ requestId: run.requestId }).catch(() => {});
    }, timeoutMs);

    const consume = async () => {
      for await (const _event of run.events) {
        // Drained for its side effect; the aggregate arrives via `final`.
      }
      const final = await run.final;
      return {
        text: final.contentText,
        stats: {
          ms: Date.now() - started,
          ...(final.stats?.timeToFirstToken !== undefined && { ttftMs: final.stats.timeToFirstToken }),
          ...(final.stats?.tokensPerSecond !== undefined && { tps: final.stats.tokensPerSecond }),
          ...(final.stats?.promptTokens !== undefined && { promptTokens: final.stats.promptTokens }),
          ...(final.stats?.generatedTokens !== undefined && { genTokens: final.stats.generatedTokens }),
          ...(final.stats?.backendDevice !== undefined && { backend: final.stats.backendDevice })
        }
      };
    };

    // `cancel()` is a request, not a guarantee: if the worker never ends the
    // stream, `run.final` would park this call — and the guard request behind
    // it — forever. The hard deadline turns that hang into a thrown error,
    // which every caller already resolves to ESCALATE. Stricter, never stuck.
    let deadline: NodeJS.Timeout | undefined;
    const hardStop = new Promise<never>((_, reject) => {
      deadline = setTimeout(
        () => reject(new Error(`generation did not end within ${timeoutMs + CANCEL_GRACE_MS}ms of starting`)),
        timeoutMs + CANCEL_GRACE_MS
      );
    });

    try {
      const pending = consume();
      // If the deadline wins, the abandoned generation may still settle later;
      // swallow that so it cannot surface as an unhandled rejection.
      pending.catch(() => {});
      return await Promise.race([pending, hardStop]);
    } finally {
      clearTimeout(timeout);
      if (deadline) clearTimeout(deadline);
    }
  }

}
