/**
 * Writing a rule as a conversation: the turns, the draft card, the check, the audience, and Activate.
 */
import { $, REGRESSION_SAMPLE, api, esc, severityVerb, state } from './core.js';
import { refreshPeople, refreshPolicy } from './data.js';
import { audienceLabel, personById, plural, sendOnEnter } from './format.js';
import { bindLimits } from './limits.js';
import { disclosure, render } from './render.js';
import { go } from './router.js';
import { bindSweeps, compileFailure, composing, isExempt, limitsPlan, notARuleAnswer, readable, rulesTabs } from './rules.js';

// ── the conversation ─────────────────────────────────────────────────────────
//
// Writing a rule is iterative: you say it, you see what it would have done, you
// narrow it. The old form could not express that — every reword was a fresh
// compile that threw away what you had learned. Here the check is a turn in the
// conversation rather than a button, and the rule being built is a card inside
// the conversation rather than a pane the conversation points at.

/** Once the first message is sent the hero collapses: the box docks to the
 *  bottom and the turns take the space it was holding. */
export function ruleChatPane() {
  return `<div class="chatwrap">
    <div class="chat" id="ruleChat">
      <div class="sheet">
        ${rulesTabs('<button type="button" class="btn quiet" id="cancelDraft">Start over</button>')}
        ${state.ruleChat.map(renderTurn).join('')}
        ${state.draft ? draftCard() : ''}
        ${state.set ? setCards() : ''}
      </div>
    </div>
    <div class="composer">
      <div class="sheet">
        <div class="hero-box">
          <textarea id="ruleMsg" rows="2" placeholder="${state.draft
            ? 'Tell Warden how to change it…'
            : state.set ? 'Or describe another rule…' : 'Describe the rule in your own words…'}"></textarea>
          <button type="button" class="btn primary send" id="ruleSend"${state.ruleBusy ? ' disabled' : ''}>${state.ruleBusy ? 'Working…' : 'Send'}</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderTurn(t) {
  if (t.from === 'you') {
    return `<div class="msg"><div class="who">You</div><div class="say">${esc(t.text)}</div></div>`;
  }
  return `<div class="msg">
    <div class="who">Warden</div>
    <div class="say${t.pending ? ' pending' : ''}">${t.html ?? esc(t.text)}</div>
  </div>`;
}

/** The rule as it stands, inside the conversation. Only the current draft is
 *  rendered, so there is never a stale card with a live Activate button. */
/**
 * The draft, ordered by the decision you came to make.
 *
 * What the rule says, whether the check found anything, activate. Everything
 * else folds. Inside a conversation this card is a message, not a page, and a
 * message you have to scroll through to find a button is the wrong shape.
 *
 * The one exception to folding: when the check found a false positive, that
 * fold opens itself. It is the only reason not to activate, so it is never
 * something you have to go looking for.
 */
/**
 * One line saying what the check found, for a draft card or a card in a set.
 *
 * In demo mode the check ran on the stand-in, which judges nothing, so the
 * counts underneath it are not findings about this rule and must not be
 * dressed as them. A person evaluating Warden with no models downloaded was
 * being told their rule missed two of its own examples — a criticism produced
 * by a test double, of a rule a test double wrote. The honest line is the one
 * that says so and points at the download.
 */
function verdictLine(p, checking = false) {
  if (state.mock) {
    return `<div class="verdict-line"><span class="dot"></span>
        <b>Not checked.</b>
        <span>No model is installed, so nothing on this card was judged.</span></div>`;
  }
  if (checking) return '<div class="verdict-line"><span class="dot"></span><span>Checking it against its examples…</span></div>';
  if (!p) return '<div class="verdict-line"><span class="dot"></span><span>Not checked yet.</span></div>';
  if (p.falsePositives > 0) {
    return `<div class="verdict-line"><span class="dot BLOCK"></span>
          <b>${plural(p.falsePositives, 'legitimate request')} would be blocked.</b>
          <span>Reword it before activating.</span></div>`;
  }
  if (p.misses > 0) {
    return `<div class="verdict-line"><span class="dot ESCALATE"></span>
            <b>${plural(p.misses, 'example')} it should have caught slipped through.</b>
            <span>Worth being more specific.</span></div>`;
  }
  return `<div class="verdict-line"><span class="dot ALLOW"></span>
            <b>Checked against ${plural(p.rows.length, 'request')}.</b>
            <span>None of them would be wrongly stopped.</span></div>`;
}

function checkRowsOf(p) {
  return p ? p.rows.map((r) => `
    <div class="preview-row${r.isFalsePositive ? ' fp' : ''}">
      <span class="v ${esc(r.verdict)}">${esc(r.verdict)}</span>
      <span class="p">${esc(r.prompt)}</span>
      ${r.source === 'log' ? '<span class="badge">real</span>' : ''}
      ${r.isFalsePositive ? '<span class="badge block">wrongly stopped</span>' : ''}
      ${r.isMiss ? '<span class="badge escalate">missed</span>' : ''}
    </div>`).join('') : '';
}

function examplesFold(key, d) {
  return disclosure(key, 'Examples Warden wrote for it', `
        <div class="label">Would be stopped</div>
        ${(d.examples?.violating ?? []).map((x) => `<div class="note">· ${esc(x)}</div>`).join('')}
        <div class="label">Must still go through</div>
        ${(d.examples?.compliant ?? []).map((x) => `<div class="note">· ${esc(x)}</div>`).join('')}`);
}

/**
 * The set: every rule one instruction became, as a list of cards.
 *
 * Each card carries its own check, its own Activate and its own Discard, and
 * "Edit alone" lifts it into the single-rule conversation above when it needs
 * rewording. The button at the top ratifies every card still on the list, after
 * a confirm that lists what is about to bind whom — that dialog is the reading
 * the old queue was trying to force one rule at a time.
 */
function setCards() {
  const set = state.set;
  const items = set.items;
  const open = items.filter((it) => it.status !== 'active' && it.status !== 'editing');
  const active = items.filter((it) => it.status === 'active').length;
  const editing = items.length - active - open.length;
  const checking = items.some((it) => it.status === 'checking' || it.status === 'pending');
  // In demo mode the checks came from the stand-in and a "missed" there is
  // not a finding; the verdict line on each card already says so, and a hint
  // up here that contradicted it was read as the rule being wrong.
  const worrying = state.mock ? 0 : open.filter((it) => it.preview && (it.preview.falsePositives > 0 || it.preview.misses > 0)).length;

  const head = `<div class="artifact set-head">
    <div class="detail-head">
      <b>${plural(items.length, 'rule')} from that instruction</b>
      <span class="when">${active} active · ${open.length} waiting${editing ? ` · ${editing} being edited above` : ''}</span>
    </div>
    ${open.length ? `<div class="chips">
      <button type="button" class="btn primary" id="ratifyAll"${state.ruleBusy || checking ? ' disabled' : ''}>
        ${checking ? 'Checking each one…' : `Activate all ${open.length}`}</button>
      <button type="button" class="btn quiet" id="dropAll">Discard the rest</button>
    </div>
    ${worrying ? `<div class="note">${plural(worrying, 'rule')} below ${worrying === 1 ? 'has' : 'have'} a check worth reading before you activate everything.</div>` : ''}`
    : ''}
  </div>`;

  return head + items.map((it, i) => {
    const d = it.rule;
    const active = it.status === 'active';
    if (it.status === 'editing') {
      return `<div class="artifact done"><div class="detail-head">
        <span class="badge ${esc(d.severity)}">${esc(d.severity)}</span>
        <span class="when">${i + 1} of ${items.length} · being edited above</span>
      </div><p class="summary">${esc(d.text)}</p></div>`;
    }
    return `<div class="artifact${active ? ' done' : ''}">
    <div class="detail-head">
      <span class="badge ${esc(d.severity)}">${esc(d.severity)}</span>
      ${d.draftedBy ? `<span class="when">written by ${esc(d.draftedBy)}</span>` : ''}
      <span class="when">${active ? 'active' : `${i + 1} of ${items.length} · not active yet`}</span>
    </div>
    <p class="summary">${esc(d.text)}</p>
    ${d.textLocal ? `<p class="note"><b>Employees will read:</b> ${esc(d.textLocal)}</p>` : ''}
    ${d.boundary ? `<p class="note"><b>Not about:</b> ${esc(d.boundary)}</p>` : ''}
    ${active ? '' : verdictLine(it.preview, it.status === 'checking')}
    <div class="kv"><div class="r">
      <span class="k">Applies to</span><span class="v">${esc(audienceLabel(d.appliesTo))}</span>
    </div></div>
    ${active ? '' : `<div class="chips">
      <button type="button" class="btn primary" data-set-act="ratify" data-set-i="${i}"${state.ruleBusy ? ' disabled' : ''}>Activate</button>
      <button type="button" class="btn sm" data-set-act="edit" data-set-i="${i}"${state.ruleBusy || state.draft ? ' disabled' : ''}>Edit alone</button>
      <button type="button" class="btn quiet" data-set-act="drop" data-set-i="${i}">Discard</button>
    </div>`}
    <div class="folds">
      ${it.preview ? disclosure(`s:check:${i}`, `The ${plural(it.preview.rows.length, 'request')} it was checked against`, checkRowsOf(it.preview)) : ''}
      ${d.guidance ? disclosure(`s:told:${i}`, 'What the employee is told instead', `<div class="banner">${esc(d.guidance)}</div>`) : ''}
      ${examplesFold(`s:examples:${i}`, d)}
    </div>
  </div>`;
  }).join('');
}

function draftCard() {
  const d = state.draft;
  const locked = Boolean(state.draftFor);
  const p = state.preview;
  const verdict = verdictLine(p);

  const checkRows = p ? p.rows.map((r) => `
    <div class="preview-row${r.isFalsePositive ? ' fp' : ''}">
      <span class="v ${esc(r.verdict)}">${esc(r.verdict)}</span>
      <span class="p">${esc(r.prompt)}</span>
      ${r.source === 'log' ? '<span class="badge">real</span>' : ''}
      ${r.isFalsePositive ? '<span class="badge block">wrongly stopped</span>' : ''}
      ${r.isMiss ? '<span class="badge escalate">missed</span>' : ''}
    </div>`).join('') : '';

  return `<div class="artifact">
    <div class="detail-head">
      <span class="badge ${esc(d.severity)}">${esc(d.severity)}</span>
      ${
        // Who wrote this, at the moment it is about to bind people. The
        // composer says it before you type, but by the time the Activate button
        // is on screen the composer is gone — and this is the point where it
        // matters whether the sentence came off this machine.
        d.draftedBy
          ? `<span class="when">written by ${esc(d.draftedBy)}</span>`
          : ''
      }
      <span class="when">not active yet</span>
    </div>

    <p class="summary">${esc(d.text)}</p>
    ${d.textLocal ? `<p class="note"><b>Employees will read:</b> ${esc(d.textLocal)}</p>` : ''}
    ${d.boundary ? `<p class="note"><b>Not about:</b> ${esc(d.boundary)}</p>` : ''}

    ${verdict}

    <div class="kv">
      <div class="r">
        <span class="k">Applies to</span>
        <span class="v">${esc(audienceLabel(d.appliesTo))}${locked
          ? ' · locked, you started this from their page'
          : `<button type="button" class="btn sm" id="editAudience">${state.audienceOpen ? 'Done' : 'Change'}</button>`}</span>
      </div>
    </div>
    ${!locked && state.audienceOpen ? '<div class="chips" id="audienceChips"></div>' : ''}
    ${state.audienceWarning && !state.audienceConfirmed
      ? '<div class="note" id="audienceWarnNote">Choose who this rule applies to before activating it.</div>'
      : ''}

    <div class="chips">
      <button type="button" class="btn primary" id="ratifyBtn"${state.ruleBusy ? ' disabled' : ''}>Activate</button>
      <button type="button" class="btn quiet" id="dropBtn">Discard</button>
    </div>

    <div class="folds">
      ${p ? disclosure('n:check', `The ${plural(p.rows.length, 'request')} it was checked against`, checkRows) : ''}
      ${d.guidance ? disclosure('n:told', 'What the employee is told instead', `<div class="banner">${esc(d.guidance)}</div>`) : ''}
      ${examplesFold('n:examples', d)}
    </div>
  </div>`;
}

export function say(html, pending = false) {
  // The same sentence twice in a row is never two answers. A compile failure
  // was seen printed as two identical WARDEN turns; whatever path produced the
  // second, the reader gains nothing from it.
  const last = state.ruleChat.at(-1);
  if (!pending && last?.from === 'warden' && !last.pending && last.html === html) return;
  state.ruleChat.push({ from: 'warden', html, pending });
}

function dropPending() {
  state.ruleChat = state.ruleChat.filter((t) => !t.pending);
}

export async function sendRuleMessage(text) {
  const clean = String(text ?? '').trim();
  if (!clean || state.ruleBusy) return;

  state.ruleChat.push({ from: 'you', text: clean });
  state.ruleBusy = true;
  const box = $('ruleMsg');
  if (box) box.value = '';
  say('Compiling it on the local model…', true);
  // Sending from the rules list (or from a person's page) is what opens the
  // conversation — there is no button that does it separately.
  if (composing()) render(); else go('policy', 'new');

  // The compiler has no notion of a conversation, so a refinement is sent as
  // the current rule plus the correction. Restating the rule is what keeps the
  // second turn from being read as a brand new one.
  const body = state.draft
    ? { text: `${state.draft.text}\n\nChange it as follows: ${clean}` }
    : { text: clean };
  if (state.draftFor) body.lockTo = [`@${state.draftFor}`];

  const { ok, j } = await api('/api/policy/draft', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });

  dropPending();

  // The compiler read the sentence and says it is not a rule. "Quiero reducir
  // mi uso al 50%" is a spending target, and the honest answer is the screen
  // that holds spending targets, not a prohibition invented to fit the shape.
  // Before it had one, that sentence compiled into a rule forbidding anyone to
  // be limited on the basis of a usage goal, which is the request inside out.
  if (ok && j.notARule) {
    state.ruleBusy = false;
    say(notARuleAnswer(j));
    render();
    return;
  }

  if (!ok) {
    state.ruleBusy = false;
    say(compileFailure(j));
    render();
    return;
  }

  state.draft = j;
  startDraftAudience();
  state.preview = null;
  const n = (j.examples?.violating?.length ?? 0) + (j.examples?.compliant?.length ?? 0);
  say(`Here it is. It ${severityVerb(j.severity)} matching requests for <b>${esc(audienceLabel(j.appliesTo))}</b>. Let me check it against the ${n} examples I wrote.`);
  render();

  await runPreview();
}

/**
 * One button, and the console works out what you meant.
 *
 * There were two: "Write it" for a sentence, and "Write the set" for a worry.
 * That is a real distinction in `compile.ts` and it is not the administrator's
 * to make — they typed a sentence, and whether it contains one prohibition or
 * three is a question about the sentence, not about which button to press.
 *
 * So the split pass runs whenever the compiler can do it well, and does not
 * when it cannot. On the local 1.7B it returned one statement on three of three
 * inputs and cost thirty seconds to do it, so that model gets the direct path.
 * On a CLI or a configured endpoint it splits correctly and quickly, so those
 * get the pass that makes a policy out of one sentence. Either way a specific
 * sentence still yields exactly one rule; the difference is only whether a
 * broad one is allowed to yield more.
 */
function writeRule(text) {
  // `capable` is the gateway saying which compiler is in force, environment
  // included; `provider` is only what was saved from this page, and a CLI set
  // by environment variable left it at "local" and skipped the split.
  const capable = state.compiler?.capable ?? ((state.compiler?.provider ?? 'local') !== 'local');
  return capable ? sendRuleSet(text) : sendRuleMessage(text);
}

/**
 * One broad instruction, several rules, all on screen.
 *
 * The compiler splits what you said into the specific prohibitions it means
 * and compiles each of those; what comes back is a set, not a policy. Every
 * rule goes on screen as its own card, each is checked in turn against its own
 * examples, and nothing is written until you press Activate — on a card, or
 * once for the whole list after a confirm that says what is about to bind
 * whom. A spending target inside the same sentence comes back beside the rules
 * as proposed limits, with its own button, rather than being dropped because
 * a rule also compiled.
 */
async function sendRuleSet(text) {
  const clean = String(text ?? '').trim();
  if (!clean || state.ruleBusy) return;

  state.ruleBusy = true;
  const box = $('ruleMsg');
  if (box) box.value = '';
  state.ruleChat.push({ from: 'you', text: clean });
  say('Working out what that means, then compiling each part…', true);
  if (composing()) render(); else go('policy', 'new');

  const body = { text: clean };
  if (state.draftFor) body.lockTo = [`@${state.draftFor}`];

  const { ok, j } = await api('/api/policy/draft-set', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });

  dropPending();

  // Same refusal, same handling. This route is the one that was forgotten.
  if (ok && j.notARule) {
    state.ruleBusy = false;
    say(notARuleAnswer(j));
    render();
    return;
  }

  if (!ok || !Array.isArray(j.rules) || j.rules.length === 0) {
    state.ruleBusy = false;
    say(compileFailure(j));
    render();
    return;
  }

  // The part of the sentence that was a spending target, if any, answered in
  // the same turn as the rules. The limits carry their own Apply button.
  const limitsNote = typeof j.factor === 'number'
    ? `<div class="note">Part of that was a spending target, not a rule.</div>${limitsPlan(j)}`
    : '';

  if (j.rules.length === 1) {
    state.draft = j.rules[0];
    startDraftAudience();
    state.preview = null;
    say(`That was already one specific thing, so it is one rule.${limitsNote}`);
    render();
    await runPreview();
    return;
  }

  state.draft = null;
  state.preview = null;
  state.set = {
    items: j.rules.map((rule) => ({ rule, preview: null, status: 'pending' })),
    limits: j.limits ?? null,
    factor: j.factor
  };
  state.ruleBusy = false;
  say(`That means ${plural(j.rules.length, 'separate rule')} to me. All of them are below, each with its own check.
    Activate them one by one, or all at once when you have read the list.${limitsNote}`);
  render();

  await runSetPreviews(state.set);
}

/**
 * Check every card in the set, one after the other.
 *
 * Sequential because each check is a handful of real adjudications on the
 * local model, and the set can be eight rules; run at once they would queue
 * behind each other anyway and the cards would all sit on "checking". One at
 * a time, the first card's verdict is on screen while the last is still
 * being judged. Stops quietly if the set was discarded or replaced meanwhile.
 */
async function runSetPreviews(set) {
  for (const item of set.items) {
    if (state.set !== set) return;
    if (item.status !== 'pending') continue;
    item.status = 'checking';
    render();
    const { ok, j } = await api('/api/policy/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rule: item.rule })
    });
    if (state.set !== set) return;
    if (item.status === 'checking') {
      item.preview = ok ? j : null;
      item.status = ok ? 'checked' : 'error';
      if (ok && (j.falsePositives > 0 || j.misses > 0)) state.open.add(`s:check:${set.items.indexOf(item)}`);
    }
    render();
  }
  if (state.set !== set || state.mock) return;
  const flagged = set.items.filter((it) => it.preview && (it.preview.falsePositives > 0 || it.preview.misses > 0)).length;
  say(flagged
    ? `Checked all ${set.items.length}. ${plural(flagged, 'rule')} ${flagged === 1 ? 'has' : 'have'} something worth reading in ${flagged === 1 ? 'its' : 'their'} check before you activate everything.`
    : `Checked all ${set.items.length} against their own examples. Nothing wrongly stopped. Activate them when you are happy with the list.`);
  render();
}

/** Ratify one rule of the set, keeping the card as an "active" record. */
async function ratifySetItem(item) {
  await api('/api/policy/ratify', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rule: item.rule })
  });
  item.status = 'active';
}

/** When nothing in the set is left to decide, leave the conversation for the list. */
async function settleSet() {
  if (!state.set) return;
  if (state.set.editing || state.set.items.some((it) => it.status !== 'active')) { render(); return; }
  const person = state.draftFor;
  resetDraft();
  await Promise.all([refreshPolicy(), refreshPeople()]);
  if (person) go('people', person); else go('policy');
}

/**
 * The step that keeps a badly-worded rule from reaching anyone.
 *
 * False positives are called out loudly rather than folded into a score,
 * because a rule that blocks legitimate work is the failure that actually
 * costs the company something.
 */
async function runPreview(against = []) {
  state.ruleBusy = true;
  say(against.length
    ? `Replaying ${plural(against.length, 'request')} Warden already allowed, to see if this rule would have stopped them…`
    : 'Checking it…', true);
  render();

  const { ok, j } = await api('/api/policy/preview', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(against.length ? { rule: state.draft, against } : { rule: state.draft })
  });

  dropPending();
  state.ruleBusy = false;
  if (!ok) { say(`The check failed: ${esc(readable(j.error))}`); render(); return; }

  state.preview = j;
  // Anything the check found — a legitimate request wrongly stopped, or a
  // violation that slipped through — is a reason to look at the rows, so the
  // fold opens itself rather than waiting to be found. A clean check stays shut.
  if (j.falsePositives > 0 || j.misses > 0) state.open.add('n:check');
  else state.open.delete('n:check');
  const logFps = j.rows.filter((r) => r.source === 'log' && r.isFalsePositive);

  if (state.mock) {
    // Same reason as the verdict line above: no model ran, so there is nothing
    // to report except that.
    say('No model is installed, so nothing was actually checked. The rows below came from the demo stand-in. Download the models and the check becomes real.');
    render();
    return;
  }

  if (j.falsePositives > 0) {
    say(`<b>${plural(j.falsePositives, 'legitimate request')} would be blocked by this.</b>
      ${logFps.length ? `${logFps.length} of them actually went through the gateway before. ` : ''}
      They are marked below. Tell me how to narrow it — “only for sales”, or “not when it is their own data”.`);
  } else if (j.misses > 0) {
    say(`No false positives, but ${plural(j.misses, 'example')} it should have caught slipped through. Worth being more specific about what you mean.`);
  } else if (against.length) {
    say('None of those real requests would have been stopped. This one looks safe to activate.');
  } else {
    say(`Clean against its own examples. ${offerRegression()}`);
  }
  render();
}

function offerRegression() {
  const n = regressionSample().length;
  if (!n) return 'Activate it below when you are happy with it.';
  return `Before you activate it, I can replay the last ${n} requests Warden allowed and see whether this rule would have stopped any of them.
    <button type="button" class="btn sm" id="regressBtn">Replay ${n} real requests</button>`;
}

function regressionSample() { return state.audit
  .filter((a) => a.decision?.verdict === 'ALLOW' && a.decision.maskedPrompt)
  .slice(0, REGRESSION_SAMPLE); }

export function bindPolicy() {
  const del = $('delRule');
  if (del) del.onclick = async () => {
    if (!confirm('Remove this rule? It stops binding everyone immediately.')) return;
    await api(`/api/policy/rules/${encodeURIComponent(del.dataset.id)}`, { method: 'DELETE' });
    await Promise.all([refreshPolicy(), refreshPeople()]);
    go('policy');
  };

  bindLimits();
  bindSweeps();

  const apply = $('applyLimits');
  if (apply) apply.onclick = async () => {
    apply.disabled = true;
    apply.textContent = 'Applying…';
    const { ok, j } = await api('/api/quotas/apply', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limits: state.pendingLimits ?? [] })
    });
    if (!ok) { apply.disabled = false; apply.textContent = 'Apply these limits'; return; }
    state.pendingLimits = null;
    await refreshPolicy();
    say(`Done. ${plural(j.applied, 'role')} now on the new daily limit.`);
    render();
  };

  const cancel = $('cancelDraft');
  if (cancel) cancel.onclick = discardDraft;

  const send = $('ruleSend');
  if (send) send.onclick = () => writeRule($('ruleMsg').value);
  const msg = $('ruleMsg');
  sendOnEnter(msg, () => writeRule(msg.value));

  const cats = $('cats');
  if (cats) cats.onclick = (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    // Picking the lit category again collapses it, so the default state of the
    // page is a question and a box and nothing else.
    const i = Number(chip.dataset.cat);
    state.presetCat = state.presetCat === i ? null : i;
    render();
  };

  const presetList = $('presetList');
  if (presetList) presetList.onclick = (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    // A preset arrives complete, but it still enters the conversation so it
    // passes the same check as anything written by hand.
    const r = state.presets[Number(btn.dataset.preset)].rules[Number(btn.dataset.r)];
    state.ruleChat.push({ from: 'you', text: r.text });
    state.draft = { ...r, id: `r-preset-${Date.now().toString(36)}` };
    startDraftAudience();
    state.preview = null;
    say('Taken from the catalogue. Checking it against its examples.');
    render();
    void runPreview();
  };

  const regress = $('regressBtn');
  if (regress) regress.onclick = () => runPreview(
    regressionSample().map((a) => ({ prompt: a.decision.maskedPrompt, expected: 'ALLOW' }))
  );

  const editAud = $('editAudience');
  if (editAud) editAud.onclick = () => { state.audienceOpen = !state.audienceOpen; render(); };

  renderAudienceChips();

  const drop = $('dropBtn');
  if (drop) drop.onclick = () => {
    // Discarding a card that was lifted out of a set puts it back on the
    // list as it was; the set is not what is being discarded.
    const editing = state.set?.editing;
    if (editing) {
      editing.status = editing.preview ? 'checked' : 'pending';
      state.set.editing = null;
      state.draft = null;
      state.preview = null;
      render();
      return;
    }
    discardDraft();
  };

  const ratify = $('ratifyBtn');
  if (ratify) ratify.onclick = async () => {
    // `sanitiseAudience` falls back to `['*']` on the server if this is ever
    // skipped, which is the right last-resort default but the wrong normal
    // path — a rule going live is a decision, and nobody has made it if the
    // chips were never touched. Refuse to send the request and ask instead.
    if (!state.audienceConfirmed) {
      state.audienceOpen = true;
      state.audienceWarning = true;
      render();
      return;
    }

    ratify.disabled = true;
    const person = state.draftFor;
    await api('/api/policy/ratify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rule: state.draft })
    });
    const id = state.draft.id;
    // A rule taken out of a set to be edited alone goes back to the set as an
    // active card, and the rest of the set stays on screen to be decided.
    if (state.set) {
      const item = state.set.editing;
      if (item) { item.rule = state.draft; item.status = 'active'; }
      state.set.editing = null;
      state.draft = null;
      state.preview = null;
      state.ruleBusy = false;
      await refreshPolicy();
      say('Activated. The rest of the set is below.');
      await settleSet();
      return;
    }
    resetDraft();
    await Promise.all([refreshPolicy(), refreshPeople()]);
    if (person) go('people', person); else go('policy', id);
  };

  bindSet();

}

/**
 * The set's buttons: one per card, and the pair at the top.
 *
 * "Activate all" confirms with the list of what binds whom, in a dialog the
 * person has to read to dismiss. That is where the reading happens now; the
 * per-card audience chips of the single flow are not on these cards, and
 * "Edit alone" is the way to a card that needs its audience changed.
 */
function bindSet() {
  const set = state.set;
  if (!set) return;

  const describe = (it) => `${it.rule.severity.toUpperCase()} · ${it.rule.text} — ${audienceLabel(it.rule.appliesTo)}`;

  const all = $('ratifyAll');
  if (all) all.onclick = async () => {
    const open = set.items.filter((it) => it.status !== 'active' && it.status !== 'editing');
    if (!open.length) return;
    const lines = open.map((it, i) => `${i + 1}. ${describe(it)}`).join('\n');
    if (!confirm(`Activate ${plural(open.length, 'rule')}? They start binding people immediately.\n\n${lines}`)) return;
    state.ruleBusy = true;
    render();
    let n = 0;
    for (const it of open) {
      if (state.set !== set) return;
      await ratifySetItem(it);
      n++;
      render();
    }
    state.ruleBusy = false;
    say(`Activated ${plural(n, 'rule')}.`);
    await settleSet();
  };

  const dropAll = $('dropAll');
  if (dropAll) dropAll.onclick = () => {
    const open = set.items.filter((it) => it.status !== 'active').length;
    if (!confirm(`Discard the ${plural(open, 'rule')} not yet activated?`)) return;
    set.items = set.items.filter((it) => it.status === 'active');
    if (!set.items.length) { discardDraft(); return; }
    void settleSet();
  };

  document.querySelectorAll('[data-set-act]').forEach((btn) => {
    btn.onclick = async () => {
      const item = set.items[Number(btn.dataset.setI)];
      if (!item || item.status === 'active') return;
      const act = btn.dataset.setAct;
      if (act === 'ratify') {
        if (!confirm(`Activate this rule? It starts binding people immediately.\n\n${describe(item)}`)) return;
        state.ruleBusy = true;
        render();
        await ratifySetItem(item);
        state.ruleBusy = false;
        await refreshPolicy();
        say('Activated.');
        await settleSet();
      } else if (act === 'drop') {
        set.items = set.items.filter((it) => it !== item);
        if (!set.items.length) { discardDraft(); return; }
        void settleSet();
      } else if (act === 'edit') {
        // Out of the list and into the conversation above it, where the
        // audience chips and "change it as follows" work as for any draft.
        // Held by reference, not by id: a reword compiles a fresh id.
        item.status = 'editing';
        set.editing = item;
        state.draft = item.rule;
        state.preview = item.preview;
        startDraftAudience();
        say('Taken out of the set. Tell me how to change it, or fix who it applies to, then activate it.');
        render();
      }
    };
  });
}

/**
 * Called every time `state.draft` starts a new rule.
 *
 * Locked to a person's page is the only case with nothing to confirm — the
 * audience is fixed by context, not proposed by the model — so it is the
 * only case that starts already confirmed. Everything else, including the
 * next rule in a compiled set, starts unconfirmed even though a person is
 * mid-conversation, because the audience is a fresh proposal each time.
 */
function startDraftAudience() {
  state.audienceConfirmed = Boolean(state.draftFor);
  state.audienceWarning = false;
}

function resetDraft() {
  state.draft = null;
  state.set = null;
  state.draftFor = null;
  state.preview = null;
  state.ruleChat = [];
  state.ruleBusy = false;
  state.audienceConfirmed = false;
  state.audienceWarning = false;
}

/** Throws away the conversation and leaves you on a blank one — you came here
 *  to write a rule, so the tab you land on is still the one for writing rules.
 *  Unless you started from someone's page, in which case that is where you were. */
function discardDraft() {
  const person = state.draftFor;
  resetDraft();
  if (person) go('people', person); else go('policy', 'new');
}

/**
 * The audience editor.
 *
 * The model proposes who a rule binds; the admin decides. Getting this wrong in
 * either direction is expensive — too broad and the whole company trips over a
 * rule meant for one team, too narrow and it guards nobody.
 */
function renderAudienceChips() {
  const host = $('audienceChips');
  if (!host || !state.draft) return;
  const on = new Set(state.draft.appliesTo);
  const opts = [
    { token: '*', label: 'Everyone' },
    ...state.company.roles.map((r) => ({ token: r, label: r })),
    ...state.company.employees.map((e) => ({ token: `@${e.id}`, label: e.name }))
  ];

  // `rulesForActor` only lets the exemption cut apply to `*` rules — a chip
  // that names an exempt role or person explicitly does bind them, on
  // purpose (`docs/specs/solo-mode.md` §2). That is a real change from
  // "admin is exempt from everything", so a chip that reaches into it says
  // so here rather than leaving it as a silent side effect of a click.
  const roleOfToken = (token) => (token.startsWith('@') ? personById(token.slice(1))?.role : token);
  const exemptOn = opts.filter((o) => o.token !== '*' && on.has(o.token) && isExempt(roleOfToken(o.token) ?? ''));

  host.innerHTML = opts
    .map((o) => `<button type="button" class="chip${on.has(o.token) ? ' on' : ''}" data-token="${esc(o.token)}">${esc(o.label)}</button>`)
    .join('') + (exemptOn.length
      ? `<div class="note" id="audienceExemptNote" style="flex-basis:100%">This rule will also apply to ${exemptOn.map((o) => esc(o.label)).join(', ')} — normally exempt from every rule, but a rule that names them by role or by name reaches them anyway.</div>`
      : '');
  host.onclick = (e) => {
    const chip = e.target.closest('[data-token]');
    if (!chip) return;
    // Touching any chip — even re-confirming what the model already proposed
    // — is what makes the audience a decision instead of a default nobody
    // looked at. See the ratify handler, which refuses to fire until this is true.
    state.audienceConfirmed = true;
    const warnNote = $('audienceWarnNote');
    if (warnNote) warnNote.remove();
    const token = chip.dataset.token;
    const next = new Set(state.draft.appliesTo);
    if (token === '*') {
      // "Everyone" is not one audience among many — it subsumes them.
      state.draft.appliesTo = ['*'];
    } else {
      next.delete('*');
      next.has(token) ? next.delete(token) : next.add(token);
      state.draft.appliesTo = next.size ? [...next] : ['*'];
    }
    renderAudienceChips();
  };
}
