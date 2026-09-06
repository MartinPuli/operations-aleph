/**
 * What the compiler is told, in one place.
 *
 * Two prompts: one turns a specific sentence into a rule, the other turns a
 * worry into the specific sentences it is made of. Both are long and both
 * are read by a person more often than by a model, which is why they live
 * apart from the code that sends them. Every clause below that is not
 * self-explanatory carries the failure it was written against; those notes
 * are the reason the clause exists and the reason not to remove it.
 */
import { isolationPreamble } from '../guard/isolate.js';
import { thinkingMarker } from '../qvac/client.js';
import { MAX_STATEMENTS } from './types.js';

/** The system prompt that compiles one administrator's sentence into a rule draft. */
/** What the administrator said earlier in this conversation, and what is on the table now. */
export type Conversation = { history: string[]; current: string[] };

/**
 * The conversation so far, as a block the compiler reads before the new
 * message. There was none: every message was compiled as if it were the
 * first, so "hacelo solo para ventas" after a set of five rules compiled
 * into a rule about sales, and "solo para los interns" after a spending
 * target compiled into nothing. A follow-up is the most common second
 * message in the console and it was the one the compiler could not read.
 */
function conversationBlock(c: Conversation | undefined): string[] {
  if (!c || (c.history.length === 0 && c.current.length === 0)) return [];
  return [
    'Earlier in this conversation the administrator said, in order:',
    ...c.history.map((h, i) => `  ${i + 1}. ${h}`),
    ...(c.current.length
      ? ['The rules currently on the table, drafted from that and not yet activated:', ...c.current.map((r, i) => `  ${i + 1}. ${r}`)]
      : []),
    'The new message may be a follow-up to that: a narrowing ("solo para ventas"),',
    'an addition ("sumá las credenciales"), a removal, or a change to one thing.',
    'Read it in that light. If it is a new, unrelated worry, ignore the table.',
    'Whatever it is, answer with the COMPLETE rule, every field filled, never',
    'only the field that changed.',
    ''
  ];
}

export function compilePrompt(roles: string[], roster: string[], nonce: string, conversation?: Conversation): string {
  return [
    ...conversationBlock(conversation),
    'You convert a policy statement written by a company administrator into a structured rule.',
    '',
    // Two failures this paragraph exists for, both seen on a capable compiler.
    //
    // "Quiero reducir mi uso al 50%" came back as "No employee request may be
    // refused, throttled, or otherwise limited on the basis of a stated goal to
    // reduce overall usage" — the exact opposite of what was asked, because the
    // sentence is a spending target and the prompt only had one shape to put it
    // in. Warden expresses spending as a quota per role, not as a rule about
    // what anyone may ask, so the honest answer is to decline and say where the
    // setting lives.
    //
    // And a rule always states what is PROHIBITED. Asked to compile a goal, the
    // model wrote the prohibition inside out. Saying so is cheaper than
    // catching it afterwards.
    'A rule states what is PROHIBITED. Never write a rule that prohibits limiting,',
    'restricting or refusing people: that inverts what the administrator asked for.',
    '',
    'Two kinds of sentence are not rules, and they are answered differently.',
    '',
    'A target for how much gets used or spent is something Warden CAN do, with',
    'per-role limits rather than with a rule about what anyone may ask. Set',
    'notARule to true and set usageFactor to the fraction of today\'s limits the',
    'administrator is asking for: "reducir mi uso al 50%" is 0.5, "un tercio menos"',
    'is 0.67, "la mitad de lo que gastamos" is 0.5. Do not compute the new limits;',
    'Warden has the current numbers and does the arithmetic. If the administrator',
    'aimed the target at particular roles ("solo para los interns", "para ventas"),',
    'put those role names in usageRoles; otherwise leave it out and it applies to',
    'every role with a limit. A reason is still useful: say what you understood.',
    '',
    // "Optimicen el uso" used to be declined as "no number to set limits from",
    // which is true of the limits and false of the sentence: the worry is made
    // of habits, and a habit is a rule. Measured 2026-09-06 through the CLI
    // compiler (docs/MEASUREMENTS.md, "Cost as habits"); the severity is fixed
    // here because a habit that costs money is not a violation, and a person
    // told "this costs money" mid-task keeps working where a person refused
    // switches the gateway off.
    'A sentence about a habit that costs money — pasting whole files or',
    'repositories when a few lines would do, running deep research or extended',
    'thinking or the most expensive model for a routine question, asking for a',
    'full rewrite when a small change was needed, re-sending the same long',
    'context — IS a rule, at severity "warn": the person is told the habit costs',
    'money and let through. Use "block" or "escalate" only when the administrator',
    'said to stop or hold it.',
    '',
    'A sentence with no prohibition, no habit and no target in it — a name, a',
    'greeting, a question, a fragment — is nothing Warden can act on. Set notARule',
    'to true with a short reason, and leave usageFactor out.',
    '',
    // The reason is read by the administrator, on the console, and it was
    // coming back in English under a Spanish sentence.
    'Write notARuleReason in the language the administrator wrote in.',
    '',
    'When notARule is true the other fields are ignored, so do not labour over them.',
    '',
    `Valid role names: ${roles.join(', ')}.`,
    // Naming the people is what makes "Ana cannot ask for payroll" compile into
    // a rule about Ana rather than a rule about everyone. Without the roster the
    // model has no token for a person and defaults to the whole company, which
    // is a much broader rule than the admin asked for.
    roster.length > 0 ? `Named employees, referred to with an @ prefix: ${roster.join(', ')}.` : '',
    'Use ["*"] when the rule binds everyone.',
    '',
    // The failure this whole block is written against is one number: on the
    // 185-prompt paired run the shipped adjudicator refuses 63% of legitimate
    // requests. Some of that is the 1.7B, and some of it is rules that were
    // compiled wider than the sentence they came from. A guard that stops two
    // of every three honest requests gets switched off, so a rule that is too
    // narrow is a smaller failure than one that is too wide, and this says so
    // rather than leaving the model to guess which way to err.
    'The administrator is describing one worry. Compile the NARROWEST rule that',
    'covers it. A rule that misses a case can be widened later; a rule that stops',
    'honest work gets Warden switched off. Err narrow.',
    '',
    'Fields:',
    '- text: one sentence, in English, naming what is prohibited concretely enough',
    '  that somebody reading only this sentence and one request can decide.',
    '  Name the thing: "another employee\'s salary", "an unreleased revenue figure",',
    '  "a customer list with contact details". Not "sensitive data", not',
    '  "confidential information", not "inappropriate requests" — those are',
    '  categories, and the judge stretches a category over anything nearby.',
    '  Carry over any limit the administrator gave (an amount, a role, a system,',
    '  a moment in time) instead of generalising past it. Where the administrator',
    '  named a category, list the concrete items it means — for customer data:',
    '  names next to emails, phone numbers, addresses, document numbers, billing',
    '  details — so a small judge matches items, not a category.',
    '- scope: "input" for what employees send, "output" for what the assistant returns, "both".',
    '  Use "output" when the worry is what the assistant might say or commit to,',
    '  and "input" when it is what somebody might ask for. Most are "input".',
    '- appliesTo: who the rule binds — role names, @employee tokens, or ["*"].',
    '  Bind it to a person only when the administrator named that person.',
    '- severity: "block" to refuse outright, "escalate" to route to a human,',
    '  "warn" to let the request through with a note saying why it was flagged.',
    '  Choose "warn" when the admin asks to be told rather than protected — when',
    '  they say to flag, note, remind, or keep an eye on something rather than',
    '  stop it, or when the rule is a preference rather than a prohibition.',
    '  Choose "escalate" when they want it to depend on a person rather than be',
    '  refused: approvals, exceptions, anything with "unless" or "without" in it.',
    '- guidance: one sentence telling an employee who just hit this rule what to do',
    '  instead — who to ask, or which nearby request is fine. Write it to them, not',
    '  about them. Never restate the prohibition; they already saw it.',
    // The field the measurement asked for. A rule that only says what it
    // prohibits leaves the judge to fire on vocabulary: "override the default
    // timeout" against a rule about overriding the assistant's instructions.
    // One sentence per rule saying what it is NOT about took the shipped judge
    // from 72% to 52% of honest requests refused (docs/MEASUREMENTS.md,
    // 2026-09-04). The administrator sees it beside the prohibition at Activate.
    // People read the refusal, the judge reads the rule, and they are not the
    // same language when the administrator is not writing in English. The
    // English `text` stays for the judge, which is what was measured.
    '- textLocal: the same sentence as text, in the language the administrator',
    '  wrote in, for the people who will read the refusal. Leave it out when the',
    '  administrator wrote in English.',
    '- boundary: one sentence saying what this rule is NOT about — the nearest',
    '  legitimate work that shares its words. Usually the employee\'s own code,',
    '  tests, fixtures and fake data; sandbox or simulated versions of the thing;',
    '  asking where something lives or how a process works. Leave it out only',
    '  when nothing nearby is worth naming.',
    '- examples.violating: 2-3 realistic requests this rule should stop. Ordinary',
    '  working sentences, not caricatures: the ones that will actually be typed.',
    // The judge reads the FIRST two compliant examples and nothing past them,
    // and the default judge reads them where it does not read a boundary
    // sentence. Measured 2026-09-04 on DynaGuard-4B: with the two nearest
    // legitimate requests first, 23% to 16% of honest requests refused, no
    // attack lost; with the same boundary written into the rule text instead,
    // worse. So the order below is not style, it is what the judge sees.
    '- examples.compliant: 3 realistic requests that are NEARBY but legitimate and',
    '  must still be allowed. These matter most: the judge reads the first two.',
    '  Put FIRST the two that share the most words with the prohibition and are',
    '  still fine — the employee\'s own code, tests, fixtures or fake data that',
    '  mention the subject; a sandbox or simulated version of the thing; asking',
    '  where something lives. For a rule about salaries: "write a unit test for',
    '  the bonus calculator with made-up amounts". For payments over a limit:',
    '  "the payment webhook times out after 8000ms, bump the client timeout".',
    '  For credentials: "the test fails because the API key env var is unset,',
    '  how do I stub it?". Then one about how a process works or who to ask.',
    '',
    'Write examples in the same language the administrator used.',
    // The 1.7B compiled "dejen de filtrar datos de clientes" into a `warn` rule
    // against *filtering* customer data, with "send customer data to a
    // third-party for analysis" as a compliant example: a draft that permits
    // the leak it was asked to stop. The boundary held and the administrator
    // would have rejected it, but the false friend is worth naming.
    'The administrator may write in Spanish. Compile the meaning, not the cognate:',
    '"filtrar datos" is to LEAK data, never to filter it; "aprobar" is to authorise;',
    '"mandar afuera" is to send outside the company.',
    isolationPreamble(nonce),
    // The compiler's marker, not the adjudicator's. They are the same local
    // model by default, and they are not the same model at all once
    // compilation is remote: this was emitting Qwen's `/no_think` control
    // token into a request bound for another vendor's API, which is the exact
    // failure `thinkingMarker` was written to prevent, one role over.
    thinkingMarker('compiler')
  ]
    .filter(Boolean)
    .join('\n');
}

/** The system prompt that splits one broad instruction into the prohibitions it means. */
export function splitPrompt(nonce: string, conversation?: Conversation): string {
  // What this prompt is for, stated against what the last one did. Measured
  // 2026-09-05 through `claude -p --model sonnet` (docs/MEASUREMENTS.md, "The
  // splitter, asked to enumerate"): "hacé que no leakeen datos" came back as
  // ONE statement — the administrator's own words — and compiled into one rule
  // that named customer contacts, financial figures and credentials in a
  // single sentence. That is the category-shaped rule the judge stretches over
  // anything nearby, and it is what "at most five, and fewer is better" plus
  // "if it is already one prohibition, return it alone" told a capable model
  // to do. The administrator typed a worry; the job here is to write down what
  // the worry is made of, one concrete thing per statement, because one
  // concrete thing per rule is the shape the judge can apply.
  //
  // The security instruction survives unchanged: the concrete kinds of the
  // thing they named are inside what they asked; a different subject is not.
  return [
    ...conversationBlock(conversation),
    ...(conversation?.current.length
      ? [
          'When the new message is a follow-up to the rules on the table, return the',
          'FULL updated list: every rule that stays, reworded only where the follow-up',
          'changes it (carry a narrowing such as a role or a person into each one it',
          'applies to), plus what it adds, minus what it removes.',
          ''
        ]
      : []),
    'A company administrator has said what they want stopped, in their own words.',
    'They have named a worry, not a rule. Write down the specific prohibitions',
    'that worry is made of — one sentence each, one concrete thing per sentence —',
    'so that each becomes one rule a small model can apply to one request.',
    '',
    `- At most ${MAX_STATEMENTS} statements. Use as many as the worry actually contains, no more.`,
    '- Each one stands alone and names ONE concrete thing that is prohibited:',
    '  the thing itself, not a category. When the administrator named a category',
    '  — data, information, money, code, documents, customers — list the concrete',
    '  kinds inside it that a company like this one has to protect, each as its',
    '  own statement. For a data leak: customer contact details; credentials, API',
    '  keys and passwords; financial figures not yet public; source code; internal',
    '  documents. Split by the thing protected, not by the channel it leaves by.',
    '- Two worries joined by "and", "ni" or a comma are two statements.',
    '- Carry every limit the administrator gave (an amount, a role, a system, a',
    '  moment) into the statement it belongs to. Do not invent limits.',
    '- A target for how much is used or spent — "ahorrar 50%", "gastar la mitad",',
    '  "reducir el uso" — is ONE statement on its own, in the administrator\'s own',
    '  words. Never rewrite it as a prohibition; Warden handles it as a limit.',
    '- A worry about cost or usage ("gastan de más", "optimicen el uso") is made of',
    '  the habits that cost money. Each habit the administrator named is one',
    '  statement, and a worry that names none is made of the usual ones: pasting',
    '  whole files or repositories when a few lines would do; running deep research,',
    '  extended thinking or the most expensive model for a routine question; asking',
    '  for a full rewrite when a small change was needed; re-sending the same long',
    '  context instead of continuing. Keep each as the administrator said it, with',
    '  the number, if any, in its own statement as above.',
    '- Never restate another statement in different words.',
    // The one instruction that is a security instruction rather than a quality
    // one. An administrator who asks about customer data and gets back a rule
    // about overtime has been handed policy nobody asked for, and the fact
    // that they still have to ratify it is not a reason to put it in front of
    // them. The concrete kinds of what they named are inside what they asked;
    // a different subject is not.
    '- Stay strictly inside what was asked. The concrete kinds of the thing they',
    '  named are inside it. A different subject is not: never add one.',
    '- If the sentence already names one concrete thing and nothing else, return',
    '  it as the only statement.',
    '- Write them in the language the administrator used.',
    isolationPreamble(nonce),
    thinkingMarker('compiler')
  ].join('\n');
}
