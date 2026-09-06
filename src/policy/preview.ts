/**
 * Show the admin how a candidate rule behaves before it can affect anyone.
 *
 * Runs the rule's own examples through the real adjudicator — the same code
 * path that will judge live traffic, so the preview cannot flatter itself. A
 * rule that reads sensibly and still blocks its own compliant examples is the
 * common failure, and this is where it surfaces: before twenty people lose an
 * afternoon to it, rather than after.
 */
import type { QvacAdapter } from '../qvac/types.js';
import { isolate } from '../guard/isolate.js';
import { adjudicate } from '../guard/passes/adjudicate.js';
import { ruleSchema, type Rule } from './types.js';

export type PreviewRow = {
  prompt: string;
  expected: 'BLOCK' | 'ALLOW';
  verdict: 'BLOCK' | 'ALLOW' | 'ESCALATE';
  confidence: number;
  reason: string;
  /** Legitimate request the candidate rule would wrongly stop. */
  isFalsePositive: boolean;
  /** Violation the candidate rule would wrongly let through. */
  isMiss: boolean;
  /** Where the case came from: the compiler's own examples, or the audit log. */
  source: 'example' | 'log';
};

export async function previewRule(
  qvac: QvacAdapter,
  rule: Rule,
  /**
   * Extra cases judged alongside the compiler's own examples.
   *
   * The console passes prompts the gateway has already allowed, so the admin
   * can ask the question that actually matters before shipping a rule: would
   * this have stopped work that went through fine last week? A rule that reads
   * well against invented examples and blocks real traffic is exactly the
   * failure the examples cannot catch, because the compiler wrote them.
   */
  against: { prompt: string; expected: 'BLOCK' | 'ALLOW' }[] = []
): Promise<{ rows: PreviewRow[]; falsePositives: number; misses: number }> {
  const parsed = ruleSchema.parse(rule);

  const cases: { prompt: string; expected: 'BLOCK' | 'ALLOW'; source: 'example' | 'log' }[] = [
    ...parsed.examples.violating.map((p) => ({ prompt: p, expected: 'BLOCK' as const, source: 'example' as const })),
    ...parsed.examples.compliant.map((p) => ({ prompt: p, expected: 'ALLOW' as const, source: 'example' as const })),
    ...against.map((c) => ({ prompt: c.prompt, expected: c.expected, source: 'log' as const }))
  ];

  const rows = await Promise.all(
    cases.map(async ({ prompt, expected, source }): Promise<PreviewRow> => {
      const iso = isolate(prompt);
      try {
        const { verdict } = await adjudicate(qvac, iso, parsed);
        const decided = verdict.violates
          ? parsed.severity === 'block'
            ? 'BLOCK'
            // A `warn` rule fires without stopping anything, so a preview of it
            // firing has to read ALLOW. Showing ESCALATE here would preview a
            // refusal the ratified rule will never produce, which is the one
            // thing this preview exists to get right.
            : parsed.severity === 'warn' ? 'ALLOW' : 'ESCALATE'
          : 'ALLOW';
        return {
          prompt, expected, source, verdict: decided,
          confidence: verdict.confidence,
          reason: verdict.reason,
          isFalsePositive: expected === 'ALLOW' && decided !== 'ALLOW',
          isMiss: expected === 'BLOCK' && decided === 'ALLOW'
        };
      } catch (err) {
        // A pass that cannot decide escalates, exactly as it would in production.
        return {
          prompt, expected, source, verdict: 'ESCALATE', confidence: 0,
          reason: `could not evaluate: ${err instanceof Error ? err.message : String(err)}`,
          isFalsePositive: expected === 'ALLOW',
          isMiss: false
        };
      }
    })
  );

  return {
    rows,
    falsePositives: rows.filter((r) => r.isFalsePositive).length,
    misses: rows.filter((r) => r.isMiss).length
  };
}

