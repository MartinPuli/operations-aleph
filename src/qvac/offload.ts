/**
 * The one shape a compiler that leaves the local weights is allowed to take.
 *
 * Two adapters do this — an OpenAI-shaped endpoint (`remote.ts`) and a coding
 * agent's CLI already signed in on the machine (`cli-compiler.ts`) — and they
 * used to be two copies of the same forty lines: route by role, count the
 * calls, parse and repair once, hand embedding and OCR back to the local
 * adapter. Two copies of a security gate is one more than can be audited
 * with one `if`. This class is that `if`.
 *
 * What it guarantees, for every subclass and any that comes later: only the
 * `compiler` role ever reaches `run()`. Judging, embedding, OCR and the
 * detector go to the local adapter with no configuration that could send
 * them anywhere else. The check is made twice on purpose — at the public
 * method and again before `run()` — because the second one is the line that
 * would have to be wrong for an employee prompt to leave the machine, and it
 * costs nothing to keep.
 *
 * What leaves is what the compiler's prompt contains: the administrator's own
 * sentence, the role names and the employee roster (`compileRule` injects
 * it). No employee prompt, no audit entry, no policy hash, no API key.
 */
import type { ZodType } from 'zod';
import { completeWithRepair } from './json.js';
import {
  FailClosedError,
  type CompleteRequest,
  type GenStats,
  type ModelRole,
  type QvacAdapter,
  type StructuredResult
} from './types.js';

/** The one role that may leave the guard. */
const OFFLOADED_ROLE: ModelRole = 'compiler';

export abstract class CompilerOffload implements QvacAdapter {
  #calls = 0;

  constructor(protected readonly local: QvacAdapter) {}

  /** Where compilation goes, for the console and the measurement records. */
  abstract describe(): string;

  /** The name used in error messages: "Claude Code", "remote compiler". */
  protected abstract readonly label: string;

  /** One generation wherever this adapter sends it. Only ever called with the compiler role. */
  protected abstract run(
    req: CompleteRequest,
    jsonSchema: Record<string, unknown> | undefined
  ): Promise<{ text: string; stats: GenStats }>;

  /** How many generations actually left the local weights. Reported by the console. */
  calls(): number {
    return this.#calls;
  }

  async complete(req: CompleteRequest): Promise<{ text: string; stats: GenStats }> {
    if (req.role !== OFFLOADED_ROLE) return this.local.complete(req);
    return this.#guarded(req, undefined);
  }

  async completeJSON<T>(
    req: CompleteRequest,
    zodSchema: ZodType<T>,
    jsonSchema: Record<string, unknown>
  ): Promise<StructuredResult<T>> {
    if (req.role !== OFFLOADED_ROLE) return this.local.completeJSON(req, zodSchema, jsonSchema);
    return completeWithRepair((r) => this.#guarded(r, jsonSchema), req, zodSchema, this.label);
  }

  embed(texts: string[]): Promise<number[][]> {
    return this.local.embed(texts);
  }

  ocr(imagePath: string): Promise<string> {
    return this.local.ocr(imagePath);
  }

  stats(): { firstTry: number; repaired: number; failed: number } {
    return this.local.stats();
  }

  dispose(): Promise<void> {
    return this.local.dispose();
  }

  #guarded(req: CompleteRequest, jsonSchema: Record<string, unknown> | undefined): Promise<{ text: string; stats: GenStats }> {
    if (req.role !== OFFLOADED_ROLE) {
      throw new FailClosedError(
        `refusing to send role "${req.role}" off the local weights — only "${OFFLOADED_ROLE}" may leave the guard`,
        { role: req.role, attempts: 0 }
      );
    }
    this.#calls++;
    return this.run(req, jsonSchema);
  }
}
