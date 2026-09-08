/**
 * One JSON object out of whatever a model printed, checked against a schema.
 *
 * Three adapters each had their own copy of this — the grammar-constrained
 * local runtime, the OpenAI-shaped endpoint, and the coding-agent CLI — and
 * they disagreed in small ways nobody had decided on: one stripped a code
 * fence, one did not, one tried the fenced block and then the outermost
 * braces and then the raw text. The differences were never measured, and
 * they meant the same model output could validate under one adapter and
 * fail closed under another. One parser, the most tolerant of the three,
 * because tolerance here costs nothing: whatever comes out is still checked
 * by zod, and the grammar-constrained path is already bare JSON, so for it
 * this is a trim.
 */
import type { ZodType } from 'zod';
import { FailClosedError, throwIfCompletionCancelled, type CompleteRequest, type GenStats, type StructuredResult } from './types.js';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** The candidates, most specific first: a fenced block, the outermost braces, the text itself. */
function candidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return [trimmed];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed)?.[1];
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const braced = start !== -1 && end > start ? trimmed.slice(start, end + 1) : null;
  return [fenced, braced, trimmed].filter((c): c is string => Boolean(c && c.trim()));
}

export function parseStructured<T>(raw: string, schema: ZodType<T>): Parsed<T> {
  let lastError = 'no JSON object found in the output';
  for (const candidate of candidates(raw)) {
    let value: unknown;
    try {
      value = JSON.parse(candidate.trim());
    } catch (err) {
      lastError = `not valid JSON: ${err instanceof Error ? err.message : String(err)}`;
      continue;
    }
    const parsed = schema.safeParse(value);
    if (parsed.success) return { ok: true, value: parsed.data };
    lastError = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  }
  return { ok: false, error: lastError };
}

/**
 * Generate against a schema with exactly one repair attempt.
 *
 * The validation error is fed back as context and the model is asked once
 * more. More than once rarely helps: a model that missed twice is confused
 * about the task, not the format, and further retries burn latency inside a
 * request a person is waiting on. A second miss throws, so nothing downstream
 * ever builds on a guess.
 */
export async function completeWithRepair<T>(
  run: (req: CompleteRequest) => Promise<{ text: string; stats: GenStats }>,
  req: CompleteRequest,
  schema: ZodType<T>,
  who: string
): Promise<StructuredResult<T>> {
  throwIfCompletionCancelled(req);
  const first = await run(req);
  throwIfCompletionCancelled(req);
  const parsed = parseStructured(first.text, schema);
  if (parsed.ok) return { value: parsed.value, attempts: 1, repaired: false, stats: first.stats };

  const second = await run({
    ...req,
    user: [req.user, '', 'Your previous answer was rejected:', parsed.error, 'Answer again, correcting exactly that. Output the JSON object and nothing else.'].join('\n')
  });
  throwIfCompletionCancelled(req);
  const retry = parseStructured(second.text, schema);
  const stats: GenStats = { ...second.stats, ms: first.stats.ms + second.stats.ms };
  if (retry.ok) return { value: retry.value, attempts: 2, repaired: true, stats };

  throw new FailClosedError(
    `${who} returned schema-invalid output twice for role "${req.role}": ${retry.error}`,
    { role: req.role, attempts: 2, lastRaw: second.text.slice(0, 400) }
  );
}
