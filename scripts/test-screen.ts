/**
 * The policy screen and the native DynaGuard form, against a stub adapter.
 *
 * Both are off by default and both change what a model is asked, so the
 * things a corpus run cannot see are checked here: that a PASS from the
 * screen skips the per-rule calls and a FAIL does not; that a FAIL nothing
 * attributes escalates rather than disappears, and a PASS never loosens
 * anything; and that the free-text answer is read strictly, so a model that
 * wanders outside `<answer>` fails closed instead of being guessed at.
 *
 * Run: pnpm run test:screen
 */
import assert from 'node:assert/strict';
import { aggregate } from '../src/guard/aggregate.js';
import { isolate } from '../src/guard/isolate.js';
import { adjudicateAll } from '../src/guard/passes/adjudicate.js';
import { parseNative } from '../src/guard/passes/forms.js';
import type { Rule } from '../src/policy/types.js';
import type { CompleteRequest, QvacAdapter } from '../src/qvac/types.js';

const rule = (id: string): Rule => ({
  id, text: `Rule ${id}.`, scope: 'input', appliesTo: ['*'], severity: 'block',
  examples: { violating: ['bad'], compliant: ['fine'] }
});
const STATS = { ms: 1, ttftMs: 1, tps: 1, promptTokens: 1, genTokens: 1, backend: 'cpu' as const };
const FLAGS = {
  hadInvisibleChars: false, hadRoleMarkers: false, hadEnvelopeForgery: false, hadGuardProtocol: false,
  hadMetaInstructions: false, nonAsciiRatio: 0, length: 10
} as never;

/** Answers the screen (a numbered policy) with `screen`, every per-rule call with `perRule`, and counts both. */
function stub(screen: string, perRule: string): { adapter: QvacAdapter; calls: { screen: number; rule: number } } {
  const calls = { screen: 0, rule: 0 };
  const answer = (req: CompleteRequest): string => {
    const isScreen = /^## Policy\n1\. /m.test(req.user) && !/A message like/.test(req.user);
    if (isScreen) calls.screen++; else calls.rule++;
    return isScreen ? screen : perRule;
  };
  const adapter = {
    async complete(req: CompleteRequest) { return { text: `<answer>${answer(req)}</answer>`, stats: STATS }; },
    async completeJSON(req: CompleteRequest) { return { value: { verdict: answer(req) }, attempts: 1, repaired: false, stats: STATS }; }
  } as unknown as QvacAdapter;
  return { adapter, calls };
}

async function main(): Promise<void> {
  const iso = isolate('hello');
  const retrieved = [rule('a'), rule('b')];
  const whole = [...retrieved, rule('c'), rule('d')];

  for (const form of ['dynaguard', 'dynaguard-native'] as const) {
    const pass = stub('PASS', 'FAIL');
    const passed = await adjudicateAll(pass.adapter, iso, retrieved, { form, screen: true, screenOver: whole });
    assert.equal(pass.calls.screen, 1);
    assert.equal(pass.calls.rule, 0, 'a PASS skips every per-rule call');
    assert.deepEqual(passed.verdicts.map((v) => v.violates), [false, false]);
    assert.equal(passed.screen?.rules, 4, 'the screen read the whole policy, not the retrieved few');

    const fail = stub('FAIL', 'PASS');
    const failed = await adjudicateAll(fail.adapter, iso, retrieved, { form, screen: true, screenOver: whole });
    assert.equal(fail.calls.rule, 2, 'a FAIL runs the per-rule calls');
    assert.equal(failed.screen?.label, 'VIOLATES');
    console.log(`✓ ${form}: PASS skips the per-rule calls, FAIL runs them over the retrieved rules`);
  }

  const off = stub('FAIL', 'PASS');
  await adjudicateAll(off.adapter, iso, retrieved, { form: 'dynaguard', screen: false, screenOver: whole });
  assert.equal(off.calls.screen, 0, 'off means no screen call at all');
  const base = stub('FAIL', 'COMPLIES');
  await adjudicateAll(base.adapter, iso, retrieved, { form: 'compliance', screen: true, screenOver: whole });
  assert.equal(base.calls.screen, 0, 'the base forms never screen');
  console.log('✓ the screen only runs when asked for, and only under a DynaGuard form');

  const none = { verdicts: retrieved.map((r) => ({ ruleId: r.id, violates: false, unclear: false, confidence: 0.9, reason: '' })), rules: retrieved, flags: FLAGS, expectedRuleIds: ['a', 'b'] };
  assert.equal(aggregate({ ...none, screen: { label: 'COMPLIES', rules: 4 } }).verdict, 'ALLOW');
  const held = aggregate({ ...none, screen: { label: 'VIOLATES', rules: 4 } });
  assert.equal(held.verdict, 'ESCALATE', 'an unattributed FAIL is held');
  assert.equal(held.firedRules[0]?.ruleId, 'policy-screen');
  const attributed = aggregate({ ...none, verdicts: [{ ...none.verdicts[0]!, violates: true }, none.verdicts[1]!], screen: { label: 'VIOLATES', rules: 4 } });
  assert.equal(attributed.verdict, 'BLOCK');
  assert.deepEqual(attributed.firedRules.map((f) => f.ruleId), ['a'], 'an attributed FAIL names the rule and nothing else');
  console.log('✓ the aggregator holds an unattributed FAIL, ignores a PASS, and defers to an attributed rule');

  assert.equal(parseNative('<answer>PASS</answer>'), 'COMPLIES');
  assert.equal(parseNative('  <answer> fail </answer>\n'), 'VIOLATES');
  assert.equal(parseNative('PASS'), 'COMPLIES');
  assert.throws(() => parseNative('The dialogue seems fine to me.'), /outside its form/);
  assert.throws(() => parseNative('<answer>MAYBE</answer>'), /outside its form/);
  console.log('✓ the native answer is read strictly and anything else fails closed');
}

main().catch((err) => { console.error(err); process.exit(1); });
