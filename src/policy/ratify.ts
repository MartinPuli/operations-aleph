/**
 * Putting a rule into force, and taking one out.
 *
 * The only paths that change what employees are judged against, which is why
 * they live behind explicit admin actions rather than at the end of
 * compilation, and in their own file rather than beside the compiler.
 */
import { EVERYONE, employeeIdOf } from './audience.js';
import { loadDirectory } from './people.js';
import { loadPolicy, savePolicy } from './store.js';
import { ruleSchema, type PolicySpec, type Rule } from './types.js';

/**
 * Put a rule into force.
 *
 * The only path that changes what employees are judged against, which is why
 * it lives behind an explicit admin action rather than happening at the end of
 * compilation.
 *
 * The audience is re-checked here, not only at compile time: the console edits
 * `appliesTo` freely between the two steps, and a person can leave the
 * directory in the gap. A token naming nobody would store a rule that displays
 * normally and binds no one — failing open while looking active — so ratify
 * refuses it loudly instead of silently widening or narrowing the rule.
 */
export async function ratifyRule(rule: Rule): Promise<PolicySpec> {
  const parsed = ruleSchema.parse(rule);

  const dir = tryDirectory();
  if (dir) {
    const unknown = parsed.appliesTo.filter((token) => {
      if (token === EVERYONE) return false;
      const id = employeeIdOf(token);
      return id !== null
        ? !dir.employees.some((p) => p.id === id)
        : !dir.roles.includes(token);
    });
    if (unknown.length > 0) {
      throw new Error(
        `audience names nobody in the directory (${unknown.join(', ')}) — fix who the rule binds, then activate`
      );
    }
  }

  const current = loadPolicy();
  const rules = current.rules.filter((r) => r.id !== parsed.id).concat(parsed);
  return savePolicy(rules, current.quotas);
}

export async function removeRule(ruleId: string): Promise<PolicySpec> {
  const current = loadPolicy();
  return savePolicy(current.rules.filter((r) => r.id !== ruleId), current.quotas);
}


/** The directory, or null when it cannot be read — callers decide what degrades. */
function tryDirectory(): { roles: string[]; employees: { id: string }[] } | null {
  try {
    const dir = loadDirectory();
    return { roles: dir.roles, employees: dir.employees };
  } catch {
    return null;
  }
}
