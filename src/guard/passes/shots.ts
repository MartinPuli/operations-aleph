/**
 * Which of a rule's examples go into the prompt.
 *
 * Two per side, not all of them. Prompt length is the dominant cost of a call
 * (there is deliberately no KV cache key, see `adjudicate.ts`) and a
 * six-example block roughly doubles it. Two per side was enough in probing,
 * and keeping the sides balanced matters more than the count: an imbalance
 * teaches the model which answer is expected. On the fine-tune it was
 * measured both ways: none loses six attacks, four loses seven legitimate
 * cells (`docs/MEASUREMENTS.md`, "The fence and the examples").
 *
 * `first` is the shipped selection: the first two per side, in the order the
 * compiler wrote them, which is why the compiler is told to put the two
 * nearest legitimate requests first. `nearest` embeds the message and picks,
 * per side, the examples closest to it: retrieval inside the rule. Measured
 * on the base model: no difference on either column. It stays available as a
 * bench variant. Nothing here can clear a request; the shots change what the
 * model reads, and the answer still only tightens.
 */
import type { QvacAdapter } from '../../qvac/types.js';
import type { Rule } from '../../policy/types.js';
import { cosine } from '../../policy/similarity.js';
import type { Isolated } from '../isolate.js';
import type { Shots } from './forms.js';

export type ShotSelection = 'first' | 'nearest';

type Sides = { violating: number[][]; compliant: number[][] };

/**
 * Example embeddings, once per rule text. Keyed on the rule's id and its
 * examples rather than the policy version, so a ratified change to an
 * unrelated rule does not throw away every rule's vectors. In memory and
 * unbounded, like the retrieval cache: tens of rules, a handful each.
 */
const vectors = new Map<string, Promise<Sides>>();

function embeddingsFor(qvac: QvacAdapter, rule: Rule): Promise<Sides> {
  const key = [rule.id, ...rule.examples.violating, ...rule.examples.compliant].join('|');
  let cached = vectors.get(key);
  if (!cached) {
    cached = qvac.embed([...rule.examples.violating, ...rule.examples.compliant]).then((all) => ({
      violating: all.slice(0, rule.examples.violating.length),
      compliant: all.slice(rule.examples.violating.length)
    }));
    vectors.set(key, cached);
    // A failed embedding is not a reason to fail the adjudication: the first
    // examples are what ships, so that is what a broken embedder falls back to.
    cached.catch(() => vectors.delete(key));
  }
  return cached;
}

export async function pickShots(
  qvac: QvacAdapter,
  rule: Rule,
  iso: Isolated,
  selection: ShotSelection,
  perSide: number
): Promise<Shots> {
  const first: Shots = {
    violating: rule.examples.violating.slice(0, perSide),
    compliant: rule.examples.compliant.slice(0, perSide)
  };
  if (selection !== 'nearest') return first;

  try {
    const [sides, [messageVec]] = await Promise.all([embeddingsFor(qvac, rule), qvac.embed([iso.clean])]);
    if (!messageVec) return first;
    const nearest = (texts: string[], vecs: number[][]): string[] =>
      texts
        .map((text, i) => ({ text, score: vecs[i] ? cosine(messageVec, vecs[i]!) : -1 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, perSide)
        .map((x) => x.text);
    return {
      violating: nearest(rule.examples.violating, sides.violating),
      compliant: nearest(rule.examples.compliant, sides.compliant)
    };
  } catch {
    return first;
  }
}
