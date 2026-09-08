/**
 * Turning what an admin says into policy the guard can enforce.
 *
 * The model drafts; the admin ratifies. That split is not politeness — it is
 * the security boundary. If compilation could enact policy on its own, someone
 * who reached the compiler could talk it into writing a permissive rule, and
 * every guarantee downstream would rest on a 1.7B model's judgement about who
 * is allowed to define the rules.
 */
import { randomUUID } from 'node:crypto';
import { withModelRole } from '../qvac/coordination.js';
import { withPromptSnapshot } from '../prompts/store.js';
import type { QvacAdapter } from '../qvac/types.js';
import { redactNames, remoteCompilerConfig } from '../qvac/remote.js';
import { isolate } from '../guard/isolate.js';
import { EVERYONE, employeeToken, sanitiseAudience } from './audience.js';
import { loadDirectory } from './people.js';
import { compilePrompt, compilerUser, splitPrompt, type Conversation } from './prompts.js';
import {
  MAX_STATEMENTS,
  POLICY_SPLIT_JSON_SCHEMA,
  RULE_DRAFT_JSON_SCHEMA,
  policySplitSchema,
  ruleDraftSchema,
  ruleSchema,
  type PolicySpec,
  type PolicySplit,
  type Rule,
  type RuleDraft
} from './types.js';

/**
 * Compile an admin's sentence into a structured rule.
 *
 * Two things about this prompt earn their place. The role list is injected so
 * `appliesTo` resolves to roles that exist rather than plausible inventions.
 * And the instruction to produce compliant examples is emphatic, because a
 * model asked for "examples" of a prohibition supplies only violations, and a
 * rule with no compliant anchors teaches the adjudicator to block on sight.
 */
export type CompileOptions = {
  /** Role names the rule may bind. Defaults to the company directory. */
  roles?: string[];
  /** People the rule may bind by name. Defaults to the company directory. */
  people?: { id: string; name: string }[];
  /**
   * Force the audience instead of letting the model choose it.
   *
   * Set when the admin is writing a rule from inside one person's page: they
   * have already said who it is for by being there, and asking a 1.7B model to
   * re-derive that from prose is a way to get it wrong.
   */
  lockTo?: string[];
  /** The conversation this message continues, so a follow-up reads as one. */
  conversation?: Conversation;
};

/**
 * The compiler saying no.
 *
 * A sentence with no prohibition in it, or a spending target, is not a rule and
 * must not leave here shaped like one. This is the shape it leaves in instead,
 * and `isDeclined` is how every caller tells the two apart without a cast.
 */
export type Declined = { notARule: true; notARuleReason: string; usageFactor?: number; usageRoles?: string[] };

export function isDeclined(compiled: Rule | Declined): compiled is Declined {
  return 'notARule' in compiled && compiled.notARule === true;
}

async function compileRuleBody(
  qvac: QvacAdapter,
  text: string,
  policy: PolicySpec,
  options: CompileOptions = {}
): Promise<Rule | Declined> {
  const directory = safeDirectory();
  const roles = options.roles ?? directory.roles;
  const people = options.people ?? directory.employees;
  const iso = isolate(text);

  const system = compilePrompt(roles, people.map((p) => roster(p)), iso.nonce, options.conversation);

  const res = await qvac.completeJSON<RuleDraft>(
    {
      // Not 'adjudicator', though it is the same local weights by default.
      // The distinct role is what lets a deployment put compilation on a model
      // it does not own without putting a single employee prompt there — see
      // `qvac/remote.ts`. Judging is not configurable in that direction.
      role: 'compiler',
      system,
      user: compilerUser('compile', iso.envelope),
      // 640 was enough before the compliant examples were asked to be hard.
      // Three nearest-miss requests in Spanish are long, and a draft cut off
      // mid-array arrives as "examples.compliant: expected array, received
      // undefined", which reads as the model failing rather than the budget.
      maxTokens: 900,
      timeoutMs: 60_000
    },
    ruleDraftSchema,
    RULE_DRAFT_JSON_SCHEMA
  );

  const draft = res.value;

  // The refusal leaves here as itself, before `ruleSchema.parse` throws the
  // field away. Measured on `claude -p --model sonnet` with the prompt above:
  // "quiero reducir mi uso al 50%" and "PUYO" both set `notARule` and filled
  // the rest with "placeholder" and "N/A" exactly as instructed, and both
  // arrived at the console as rules containing those words, because the flag
  // was dropped one line below this. A model that answered correctly and a
  // caller that ignored it look identical from the screen.
  if (draft.notARule) {
    return {
      notARule: true,
      notARuleReason: draft.notARuleReason ?? '',
      ...(draft.usageFactor !== undefined ? { usageFactor: draft.usageFactor } : {}),
      // Only roles that exist. A role the model invented would filter the
      // proposal down to nobody, which reads as "nothing to cut".
      ...(draft.usageRoles?.length ? { usageRoles: draft.usageRoles.filter((r) => roles.includes(r)) } : {})
    };
  }

  // Past the refusal branch every field is present; `superRefine` on the draft
  // schema is what guarantees it, and `ruleSchema.parse` below re-checks.
  return ruleSchema.parse({
    ...draft,
    id: `r-${slug(draft.text ?? '')}-${randomUUID().slice(0, 4)}`,
    // Keep only audiences that exist. A hallucinated role or employee id would
    // silently narrow the rule to nobody, which fails open — the one direction
    // we never accept.
    appliesTo:
      options.lockTo ??
      sanitiseAudience(draft.appliesTo ?? [], roles, people.map((p) => p.id))
  });
}

/**
 * Why the ceiling on how many rules one instruction may become is what it is.
 * The number itself is `MAX_STATEMENTS` in `types.ts`, beside the schema.
 *
 * Not a tuning knob. "Stop people leaking data" is an invitation to enumerate,
 * and a model that answers it with fifteen rules has handed the administrator
 * a list nobody reads before activating — at which point a model has written
 * policy after all. It was five, and five was the wrong number for the other
 * reason: a data-leak worry at this company is customer contact details,
 * credentials, unreleased financials, source code and internal documents,
 * and the channels they leave by, and a cap of five with a prompt that said
 * "fewer is better" returned one. Eight is enough to hold the worry an
 * administrator actually types, and the console now shows the whole set on
 * one screen with a check under each card, which is what makes eight readable.
 */

/**
 * Split one broad instruction into the specific prohibitions it means.
 *
 * Fails soft, and the direction matters: a split that errors, times out, or
 * comes back unparseable returns the administrator's own sentence unchanged,
 * so the broad path degrades into the narrow one that already worked rather
 * than into an error page. It cannot fail open in the security sense — nothing
 * here decides anything, and every sentence it returns still has to survive
 * `compileRule` and then be ratified by a person.
 */
async function splitStatement(qvac: QvacAdapter, text: string, conversation?: Conversation): Promise<string[]> {
  const iso = isolate(text);

  const system = splitPrompt(iso.nonce, conversation);

  try {
    const res = await qvac.completeJSON<PolicySplit>(
      {
        role: 'compiler',
        system,
        user: compilerUser('split', iso.envelope),
        // Eight statements of ordinary length in Spanish are inside this, and
        // the margin is deliberate: a split that overran the cap would come
        // back as truncated JSON, fail to parse, and be caught below as
        // "compile the administrator's sentence as one rule" — a silent
        // degradation that looks exactly like the model deciding it was
        // already specific.
        maxTokens: 900,
        timeoutMs: 60_000
      },
      policySplitSchema,
      POLICY_SPLIT_JSON_SCHEMA
    );

    const seen = new Set<string>();
    const statements: string[] = [];
    for (const raw of res.value.statements) {
      const statement = raw.trim();
      const key = statement.toLowerCase();
      if (!statement || seen.has(key)) continue;
      seen.add(key);
      statements.push(statement);
    }
    // A split of one is not a split. The pass was asked to break a worry into
    // parts and came back with the administrator's own sentence — so use the
    // administrator's own sentence, not the model's paraphrase of it. Except
    // mid-conversation: a follow-up that leaves one rule on the table is that
    // rule, reworded on purpose, and the administrator's sentence ("solo para
    // ventas") is not a rule at all.
    //
    // This is not tidiness. Measured on 2026-09-01 against Qwen3-1.7B-Q4_0,
    // the paraphrase is where the damage was: "nadie puede mandar datos de
    // clientes afuera de la empresa" came back as "nadar datos de clientes",
    // and "dejen de filtrar datos de clientes" came back as a rule against
    // *filtering* customer data — the false friend — whose compliant example
    // was "send customer data to a third-party for analysis". A pass that
    // returns one statement can now only return the one it was given, so the
    // worst failure this pass had is structurally gone rather than prompted
    // against.
    if (statements.length === 1 && !conversation?.current.length) return [text];
    return statements.length > 0 ? statements.slice(0, MAX_STATEMENTS) : [text];
  } catch {
    return [text];
  }
}

/**
 * Compile one broad instruction into a set of specific rules.
 *
 * This is the sentence an administrator actually says out loud — "I want them
 * to stop leaking customer data" — and it is not a rule. `compileRule` would
 * take it and produce something technically valid and practically useless: one
 * prohibition wide enough to cover the whole worry, which is one prohibition
 * wide enough to refuse the day's honest work.
 *
 * Two passes and not one, deliberately. Asking a single call for N complete
 * rules would multiply a 640-token cap by N and give every field of every rule
 * another chance to be filled in without being decided — which is the failure
 * `docs/MEASUREMENTS.md` records for every extra field this compiler has ever
 * been asked to produce. So the split pass is asked for sentences only, and
 * the second pass is `compileRule`, unchanged and already measured, once each.
 *
 * Sequentially, not in parallel. The adapter batches concurrent work and the
 * measurement note in CLAUDE.md is explicit that batch composition moves the
 * numerics; a rule whose examples depend on what else happened to be in flight
 * is a rule that cannot be reproduced. On the machine this was written for it
 * is also simply faster.
 *
 * Which makes this the slowest thing in the product by a distance: the split,
 * then up to eight compilations, each of which takes what a compilation takes.
 * On the four-core CPU the 46-second figure in CLAUDE.md was measured on, a
 * five-rule set is minutes. That is a fact about the machine and not a reason
 * to parallelise it into unreproducibility, but a caller putting this behind a
 * request needs to know it is not a request that returns quickly.
 *
 * **The boundary is unchanged.** The model drafts, the administrator ratifies,
 * and a draft nobody ratified has never judged anybody. Nothing in this
 * function writes to the policy. The console shows the set as a list with a
 * check under each rule and one button that ratifies all of them; that button
 * is still a person reading a list and deciding, which is the boundary, and
 * it is on the administrator that the list is short enough to read.
 */
async function compilePolicyBody(
  qvac: QvacAdapter,
  text: string,
  policy: PolicySpec,
  options: CompileOptions = {}
): Promise<{
  statements: string[];
  rules: Rule[];
  declined: string[];
  declinedFactors: (number | undefined)[];
  declinedRoles: (string[] | undefined)[];
}> {
  const statements = await splitStatement(qvac, text, options.conversation);

  // A refusal from `compileRule` is not a rule and must not be carried as one.
  // It was: `notARule` was handled on the single-rule route and nowhere else, so
  // the word "juan" came back through this path as `{ notARule: true }`, was put
  // on screen as a draft, and reached `previewRule`, where `ruleSchema.parse`
  // rejected an object with no id, text, scope, audience, severity or examples
  // and printed all six zod issues into the conversation. One route wired and
  // one forgotten is worse than neither, because the forgotten one fails loudly
  // in the user's face with an error about our own schema.
  const rules: Rule[] = [];
  const declined: string[] = [];
  const declinedFactors: (number | undefined)[] = [];
  const declinedRoles: (string[] | undefined)[] = [];
  // The split already carried the follow-up into each statement, so the
  // compiler gets the history and not the table: shown the rules on the
  // table, it answered a statement that changed one thing about a rule with
  // only that thing — appliesTo and no examples — and the draft failed its
  // schema twice. It needs the history for a spending target's roles.
  const perRule: CompileOptions = options.conversation
    ? { ...options, conversation: { history: options.conversation.history, current: [] } }
    : options;
  for (const statement of statements) {
    const compiled = await compileRule(qvac, statement, policy, perRule);
    if (isDeclined(compiled)) {
      declined.push(compiled.notARuleReason || 'It contains no prohibition.');
      declinedFactors.push(compiled.usageFactor);
      declinedRoles.push(compiled.usageRoles);
    } else rules.push(compiled);
  }

  return { statements, rules, declined, declinedFactors, declinedRoles };
}

/**
 * The directory, or an empty stand-in.
 *
 * Compilation must not fail because the company file is missing — a fresh
 * clone with no directory can still write company-wide rules, which is the
 * first thing anyone does. The fallback binds everyone, the broad direction.
 */
function safeDirectory(): { roles: string[]; employees: { id: string; name: string }[] } {
  try {
    const dir = loadDirectory();
    return { roles: dir.roles, employees: dir.employees };
  } catch {
    return { roles: [EVERYONE], employees: [] };
  }
}

/**
 * How one employee is named to the model.
 *
 * The display name is what makes "Ana cannot ask for payroll" compile into a
 * rule about Ana, so it is sent by default and the rule is better for it. When
 * compilation is remote, `WARDEN_COMPILER_REDACT_NAMES=1` reduces this to the
 * opaque token: the provider then sees `@e-01` and never the person. That is a
 * real accuracy cost paid deliberately, which is why it is a setting and not a
 * default — and why redaction is ignored when the model is local, where there
 * is no third party to withhold anything from.
 */
function roster(p: { id: string; name: string }): string {
  const token = employeeToken(p.id);
  const withhold = redactNames() && remoteCompilerConfig() !== null;
  return withhold ? token : `${token} (${p.name})`;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(Boolean)
    .slice(0, 4)
    .join('-');
}

/** The splitter and its child drafts share one prompt revision and one model
 * lease. A saved edit can affect the next operation, never half of this one. */
export function compileRule(qvac: QvacAdapter, text: string, policy: PolicySpec, options: CompileOptions = {}): ReturnType<typeof compileRuleBody> {
  return withModelRole('compiler', () => withPromptSnapshot(() => compileRuleBody(qvac, text, policy, options)));
}
export function compilePolicy(qvac: QvacAdapter, text: string, policy: PolicySpec, options: CompileOptions = {}): ReturnType<typeof compilePolicyBody> {
  return withModelRole('compiler', () => withPromptSnapshot(() => compilePolicyBody(qvac, text, policy, options)));
}
