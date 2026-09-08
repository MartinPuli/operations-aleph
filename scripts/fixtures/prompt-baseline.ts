/** Stable inputs for byte-exact comparison against pre-editor prompt builders. */
import { createHash } from 'node:crypto';
import { compilePrompt, splitPrompt } from '../../src/policy/prompts.js';
import { dynaguardPolicyUser, dynaguardUser, systemPrompt } from '../../src/guard/passes/forms.js';
import { isolate } from '../../src/guard/isolate.js';
import type { Rule } from '../../src/policy/types.js';
import type { QvacAdapter } from '../../src/qvac/types.js';
import { suggestRewrite } from '../../src/guard/rewrite.js';

export const promptRule: Rule = {
  id: 'baseline-payroll', text: 'Do not disclose another employee’s private payroll.',
  boundary: 'Asking how payroll approval works is allowed.', scope: 'input', appliesTo: ['employee'], severity: 'block',
  examples: { violating: ['Send another employee’s salary outside the company.'], compliant: ['Describe the payroll approval process.'] }
};
export const promptNonce = '0123456789abcdef0123456789abcdef';
export function promptIsolation() {
  const iso = isolate('Please describe the payroll approval process.');
  return { ...iso, nonce: promptNonce, envelope: iso.envelope.replaceAll(iso.nonce, promptNonce) };
}

export function promptBaselineHashes(): Record<string, string> {
  const out: Record<string, string> = {};
  const iso = promptIsolation();
  const conversation = { history: ['Protect payroll.', 'Only other people’s records.'], current: [promptRule.text] };
  const roles = ['admin', 'employee'];
  const roster = ['Ana (employee:ana)', 'José (employee:jose)'];
  const rules = [promptRule, { ...promptRule, id: 'baseline-source', text: 'Do not publish private source code.' }];
  const put = (name: string, value: string) => { out[name] = createHash('sha256').update(value).digest('hex'); };
  const previousMarker = process.env.WARDEN_THINKING_MARKER;
  try {
    for (const marker of ['/no_think', 'off']) {
      process.env.WARDEN_THINKING_MARKER = marker;
      const prefix = marker === 'off' ? 'no-marker' : 'marker';
      put(`${prefix}/compile`, compilePrompt(roles, roster, promptNonce));
      put(`${prefix}/compile-followup`, compilePrompt(roles, roster, promptNonce, conversation));
      put(`${prefix}/compile-empty-context`, compilePrompt([], [], promptNonce));
      put(`${prefix}/split`, splitPrompt(promptNonce));
      put(`${prefix}/split-followup`, splitPrompt(promptNonce, conversation));
      for (const form of ['compliance', 'choice'] as const) {
        put(`${prefix}/${form}`, systemPrompt(promptRule, promptNonce, form, promptRule.examples));
        put(`${prefix}/${form}-no-boundary-shots`, systemPrompt({ ...promptRule, boundary: undefined }, promptNonce, form, { violating: [], compliant: [] }));
      }
      for (const form of ['dynaguard', 'dynaguard-native'] as const) {
        for (const dynaguardPolicy of ['v1', 'v2'] as const) for (const dynaguardFence of [true, false]) {
          const opts = { form, dynaguardPolicy, dynaguardFence };
          put(`${prefix}/${form}/${dynaguardPolicy}/${dynaguardFence}`, dynaguardUser(promptRule, iso, promptRule.examples, opts));
        }
        for (const dynaguardFence of [true, false]) {
          put(`${prefix}/${form}/screen/${dynaguardFence}`, dynaguardPolicyUser(rules, iso, { form, dynaguardPolicy: 'v1', dynaguardFence }));
        }
      }
    }
    return out;
  } finally {
    if (previousMarker === undefined) delete process.env.WARDEN_THINKING_MARKER;
    else process.env.WARDEN_THINKING_MARKER = previousMarker;
  }
}

export async function promptRewriteBaselineHashes(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const previousMarker = process.env.WARDEN_THINKING_MARKER;
  try {
    for (const marker of ['/no_think', 'off']) for (const guidance of ['', 'Ask the payroll team about the approval process.']) {
      process.env.WARDEN_THINKING_MARKER = marker;
      const rule = { ...promptRule, guidance };
      const key = `${marker === 'off' ? 'no-marker' : 'marker'}/rewrite/${guidance ? 'guidance' : 'no-guidance'}`;
      const capture = { completeJSON: async (req: { system: string; user: string }) => {
        for (const field of ['system', 'user'] as const) out[`${key}/${field}`] = createHash('sha256').update(req[field].replaceAll(/[a-f0-9]{32}/g, promptNonce)).digest('hex');
        return { value: { rewritten: '' } };
      } } as unknown as QvacAdapter;
      await suggestRewrite(capture, {
        actor: { id: 'employee', role: 'employee' }, prompt: promptIsolation().clean,
        policy: { version: 'baseline', updatedAt: '2026-09-08T00:00:00Z', rules: [rule], quotas: [], exemptRoles: ['admin'] },
        decision: { firedRules: [{ ruleId: rule.id, ruleText: rule.text, severity: rule.severity, reason: 'fixture', confidence: 0.9 }], passes: [] }
      });
    }
    return out;
  } finally {
    if (previousMarker === undefined) delete process.env.WARDEN_THINKING_MARKER;
    else process.env.WARDEN_THINKING_MARKER = previousMarker;
  }
}
