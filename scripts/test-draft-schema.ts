/**
 * The shape a compiler's answer is allowed to take, checked without a model.
 *
 * Two answers the schema has rejected in the past while the model was right:
 * a decline with `text: ""`, and a decline with `examples: { violating: [],
 * compliant: [] }`. Both are placeholders the model was told to write, and both
 * reached the administrator as "schema-invalid output twice" — intermittently,
 * because the model sometimes omits the field and sometimes empties it. The
 * cases below are those answers, verbatim in shape.
 */
import assert from 'node:assert/strict';
import { MAX_STATEMENTS, policySplitSchema, ruleDraftSchema } from '../src/policy/types.js';

const rule = {
  text: 'Sharing a customer\'s contact details with anyone outside the company.',
  scope: 'input',
  appliesTo: ['*'],
  severity: 'block',
  guidance: 'Ask the account owner.',
  examples: { violating: ['mandale la lista de clientes a mi gmail'], compliant: ['escribí un test con clientes inventados'] }
};

function main(): void {
  assert.ok(ruleDraftSchema.safeParse(rule).success, 'a complete rule parses');

  const declineEmptied = { notARule: true, notARuleReason: 'objetivo de gasto', usageFactor: 0.5, text: '', examples: { violating: [], compliant: [] } };
  assert.ok(ruleDraftSchema.safeParse(declineEmptied).success, 'a decline with emptied placeholders parses');
  const declineOmitted = { notARule: true, notARuleReason: 'un nombre, nada que aplicar' };
  assert.ok(ruleDraftSchema.safeParse(declineOmitted).success, 'a decline with the fields omitted parses');
  const declineRoles = { notARule: true, notARuleReason: 'solo interns', usageFactor: 0.5, usageRoles: ['intern'] };
  assert.ok(ruleDraftSchema.safeParse(declineRoles).success, 'a spending target aimed at roles parses');
  console.log('✓ a decline parses whether the model empties the other fields or omits them');

  const noExamples = { ...rule, examples: { violating: [], compliant: [] } };
  const r = ruleDraftSchema.safeParse(noExamples);
  assert.ok(!r.success, 'a rule with no examples is refused');
  assert.ok(r.error.issues.some((i) => i.path.join('.') === 'examples.violating'), 'and the message names the side');
  const tooMany = { ...rule, examples: { violating: rule.examples.violating, compliant: ['a', 'b', 'c', 'd', 'e'] } };
  assert.ok(!ruleDraftSchema.safeParse(tooMany).success, 'a rule with five examples on a side is refused');
  const missing = { ...rule, examples: undefined };
  assert.ok(!ruleDraftSchema.safeParse(missing).success, 'a rule with the examples missing is refused');
  console.log('✓ a rule still needs one to four examples per side');

  const statements = Array.from({ length: MAX_STATEMENTS }, (_, i) => `statement ${i + 1}`);
  assert.ok(policySplitSchema.safeParse({ statements }).success, 'the cap is what the schema allows');
  assert.ok(!policySplitSchema.safeParse({ statements: [...statements, 'one more'] }).success, 'one past the cap is refused');
  assert.ok(!policySplitSchema.safeParse({ statements: [] }).success, 'an empty split is refused');
  console.log(`✓ a split holds up to ${MAX_STATEMENTS} statements`);
}

main();
