/**
 * Rules: the policy as a list, the composer, the banners, and the sentences the console says when a compile does not yield a rule.
 */
import { bindLogPeek } from './answers.js';
import { compilerLine } from './compiler.js';
import { $, attr, del, esc, post, severityMeans, state } from './core.js';
import { refreshPeople, refreshPolicy } from './data.js';
import { bindPolicy, ruleChatPane } from './draft.js';
import { audienceLabel, clip, isPersonal, plural, ruleName } from './format.js';
import { limitsGrid } from './limits.js';
import { disclosure, render } from './render.js';
import { go } from './router.js';
import { VIEWS } from './views.js';

// ═══ RULES ═══════════════════════════════════════════════════════════════════

/**
 * Rules is two tabs, not one page.
 *
 * Writing a rule is a conversation with Warden; the policy is a list. Those are
 * different modes of using the screen, and stacking them meant that the moment
 * you sent the first message the list underneath was orphaned — still there,
 * no longer part of what you were doing. So they became peers: the list you
 * come back to, and the conversation you start.
 */
function onNewRule() { return state.view === 'policy' && state.sel === 'new'; }
function inConversation() { return onNewRule() && (state.ruleChat.length > 0 || Boolean(state.draft) || Boolean(state.set)); }
export function composing() { return inConversation(); }

VIEWS.policy = {
  flush: onNewRule,
  body: () => (onNewRule() ? (inConversation() ? ruleChatPane() : newRulePage()) : rulesBody()),
  bind: bindPolicy
};

/** The switch between the two, at the top of the column in both. A dot on the
 *  New rule side when a draft is waiting there — leaving the tab does not
 *  throw the conversation away. */
export function rulesTabs(right = '') {
  const on = onNewRule();
  return `<div class="toolbar">
    <span class="seg">
      <button type="button" class="${on ? 'on' : ''}" data-go="policy" data-sel="new">New rule${!on && (state.draft || state.set) ? ' •' : ''}</button>
      <button type="button" class="${on ? '' : 'on'}" data-go="policy">Rules</button>
    </span>
    <span class="spacer"></span>
    ${right}
  </div>`;
}

/** The policy you have. */
function rulesBody() {
  return `<div class="sheet">
    ${rulesTabs(`
      <button type="button" class="btn" data-go="simulator">Try a prompt</button>`)}

    ${state.policy.rules.length
      ? state.policy.rules.map(ruleRow).join('')
      : '<div class="empty"><b>No rules yet, so nothing gets stopped</b><span>Every prompt your team sends goes straight through until you write one.</span></div>'}

    ${state.policy.rules.length ? `<div class="row-actions">
      <button type="button" class="btn quiet" id="clearSample">Take out what came with Warden</button>
      <button type="button" class="btn quiet danger" id="wipeRules">Delete every rule</button>
    </div>` : ''}

    <div class="section">
      <div class="label">Limits by role</div>
      ${limitsGrid()}
      <div class="note">Token counts are reported by the tool, not measured here.</div>
    </div>
  </div>`;
}

/** Roles the policy declines to govern. Read from the policy, never guessed. */
function exemptRoles() {
  return state.policy.exemptRoles ?? [];
}

export function isExempt(role) {
  return exemptRoles().includes(role);
}

/**
 * Who you can send a test prompt as, with the exempt ones last and labelled.
 *
 * The sample company's admin is called Martín Pulitano, admin sits in
 * `exemptRoles`, and the browser picks the first option by itself. So the
 * person most likely to test Warden picked their own name off the top of an
 * unsorted list and got ALLOW on everything they tried, including "pasame el
 * sueldo de Ana Ruiz", which the same gateway blocks under four rules when the
 * intern sends it. Nothing was broken: an exempt role is measured against no
 * rules at all, which is the point of it. The list just never said so.
 */
export function sendAsOptions() {
  const people = [...state.company.employees].sort(
    (a, b) => Number(isExempt(a.role)) - Number(isExempt(b.role))
  );
  return people.map((e) => `<option value="${esc(e.id)}">${esc(e.name)} · ${esc(e.role)}${
    isExempt(e.role) ? ' · exempt from every rule' : ''
  }</option>`).join('');
}

/**
 * The two ways to get rid of rules you did not write.
 *
 * They answer different questions and that is why there are two of them. "Take
 * out what came with Warden" removes only rows that match the files we ship, so
 * a policy somebody has been building keeps everything they built; it is the
 * boot migration, run on request, for the installs the migration itself will
 * not touch because naming your company cleared the flag it reads. "Delete
 * every rule" is the blunt one, and it asks first.
 */
export function bindSweeps() {
  bindLogPeek();
  const clear = $('clearSample');
  if (clear) clear.onclick = async () => {
    clear.disabled = true;
    const { ok, j } = await post('/api/company/sample/clear');
    clear.disabled = false;
    if (!ok) return;
    await Promise.all([refreshPolicy(), refreshPeople()]);
    render();
    // Nothing matched, so say that rather than leaving a button that looks
    // broken: the policy is already all theirs.
    if (!j.people && !j.rules && !j.quotas) {
      clear.insertAdjacentHTML('afterend',
        '<span class="note">Nothing here came with Warden. Every rule and every person is yours.</span>');
    }
  };

  const wipe = $('wipeRules');
  if (wipe) wipe.onclick = async () => {
    const n = state.policy.rules.length;
    if (!confirm(`Delete all ${n} rules? Warden will stop nothing until you write another. Limits by role are kept.`)) return;
    wipe.disabled = true;
    await del('/api/policy/rules');
    await Promise.all([refreshPolicy(), refreshPeople()]);
    render();
  };
}

/** The conversation before it starts: tabs pinned at the top, the composer
 *  centred in whatever is left, the way an empty chat sits on the screen. */
function newRulePage() {
  return `<div class="blank">
    <div class="sheet">${rulesTabs()}</div>
    <div class="blank-fill">${heroComposer()}</div>
  </div>`;
}

/**
 * The composer, at the size the thing deserves.
 *
 * A question rather than a page title, one box wide enough for a sentence, the
 * send control inside it, and suggestions that are shortcuts rather than
 * decoration. The categories stay collapsed until you pick one, so the default
 * state is a question and a box and nothing else.
 */
/**
 * An empty policy is a real state, and on a fresh install it is the first thing
 * anyone sees. It must not look like a page that failed to load, and the honest
 * thing to say is also the best explanation of the product: there are no rules,
 * therefore nothing is being stopped.
 */
function emptyPolicyBanner() {
  if (state.policy.rules.length) return '';
  return `<div class="banner warn">
    <b>Nothing is being stopped.</b> Warden only stops what you tell it to. Write the first rule below, or take one from the catalogue.
  </div>`;
}

/**
 * Demo mode, and the way out of it.
 *
 * It used to say only what was true — "these decisions did not come from a
 * real model" — and stop there, which names the problem and leaves you in it.
 * Somebody who installs the app, lands in demo mode and reads that banner has
 * been told the product is not working and given nothing to do about it; the
 * exit existed and was a tray menu item, which is not where anyone looks.
 *
 * Both paths, because the console is served to whoever opened it: the desktop
 * app, where the fix is a menu item, and a checkout, where it is one command.
 */
/**
 * A genuinely fresh install: nobody in the directory, nothing in the policy.
 *
 * The product used to fill both in for you — every install opened as Northwind
 * Logistics SA with seven people who do not exist and eight rules nobody wrote
 * — and the way out was a Company block on a tab the console does not open on.
 * Nothing is seeded now, so this is what the first screen looks like, and it
 * says the two things that are true about it: nothing is being stopped yet,
 * and the sample is here if you want to look around first.
 *
 * It disappears the moment either half stops being empty, so it cannot become
 * furniture.
 */
export function firstRunBanner() {
  if (state.company.employees.length || state.policy.rules.length) return '';
  return `<div class="banner">
    <b>Nothing is being stopped yet.</b> Write a rule on
    <button type="button" class="linkish" data-go="policy" data-sel="new">Rules</button>,
    or put your team in on <button type="button" class="linkish" data-go="people">Team</button>.
    <div class="chips">
      <button type="button" class="btn" id="loadSample">Load the sample company instead</button>
    </div>
  </div>`;
}

/**
 * Demo mode, and the way out of it.
 *
 * The way out used to be a sentence pointing at `Gateway → Download models` in
 * the menu bar. People did not find it, which is what happens to an action
 * three levels inside a submenu nobody opens, and the report was "I can't see
 * where to download the models". The action belongs where the sentence about it
 * already is.
 *
 * In a browser against a checkout there is no shell to do the downloading, so
 * there is no button there: the command is the honest offer.
 */
export function mockBanner() {
  return `<div class="banner warn">
    <b>Demo mode. None of this is real.</b> No model has judged anything you see here.
    ${state.canLeaveDemo
      ? `<div class="banner-act">
           <button type="button" class="btn primary" id="getModels">Download the models</button>
           <span class="note">5.4&nbsp;GB, once. Warden restarts by itself when they land.</span>
         </div>`
      : '<div class="note">Run <span class="mono">pnpm run setup</span>. 5.4&nbsp;GB, once.</div>'}
  </div>`;
}

function heroComposer() {
  const cat = state.presetCat == null ? null : state.presets[state.presetCat];
  return `<div class="hero">
    ${emptyPolicyBanner()}
    <h2 class="hero-q">What should Warden stop?</h2>

    <div class="hero-box">
      <textarea id="ruleMsg" rows="2" placeholder="Describe it the way you would to a colleague…"></textarea>
      <button type="button" class="btn primary send" id="ruleSend">Write it</button>
    </div>

    ${compilerLine()}

    <div class="hero-sugg" id="cats">
      ${state.presets.map((c, i) => `
        <button type="button" class="pill${i === state.presetCat ? ' on' : ''}" data-cat="${i}">${esc(c.label ?? c.category)}</button>`).join('')}
    </div>

    ${cat ? `<div class="hero-sugg" id="presetList">
      ${(cat.rules ?? []).map((r, k) => `
        <button type="button" class="pill wrap" data-preset="${state.presetCat}" data-r="${k}">${esc(clip(r.text, 90))}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

function ruleRow(r) {
  const open = state.sel === r.id;
  return `<button type="button" class="row roomy${open ? ' on' : ''}" data-toggle="policy" data-sel="${attr(r.id)}" aria-expanded="${open}">
      <span class="dot ${esc(r.severity)}"></span>
      <span class="col">
        <span class="t">${esc(ruleName(r))}</span>
        <span class="m2">${esc(r.text)}</span>
        <span class="m">
          <span class="badge ${esc(r.severity)}">${esc(r.severity)}</span>
          <span>${esc(audienceLabel(r.appliesTo))}</span>
          ${r.pinned ? '<span class="badge">always checked</span>' : ''}
          ${isPersonal(r) ? '<span class="badge">personal</span>' : ''}
        </span>
      </span>
    </button>
    ${open ? ruleDetail(r) : ''}`;
}

function ruleDetail(rule) {
  const hits = state.audit.filter((a) => (a.decision?.firedRules ?? []).some((r) => r.ruleId === rule.id));
  const guidance = hits[0]?.decision.firedRules.find((r) => r.ruleId === rule.id)?.guidance;
  const blocked = hits.filter((h) => h.decision?.verdict !== 'ALLOW').length;
  // How many of those the person on the other end said were wrong. This is the
  // only false-positive signal the console actually has: in the audit log a
  // correct block and an incorrect one are the same record. Counting how much
  // a rule catches without counting what it costs makes every rule look good.
  const disputed = state.appeals.filter((a) => a.ruleId === rule.id);

  // An active rule is an object you consult, not a decision you take, so it
  // gets the property-list shape rather than the draft's decide-first one.
  return `<div class="detail">
    <p class="summary">${esc(rule.text)}</p>

    <div class="kv">
      <div class="r"><span class="k">If it fires</span><span class="v"><span class="badge ${esc(rule.severity)}">${esc(rule.severity)}</span>
        ${severityMeans(rule.severity)}</span></div>
      <div class="r"><span class="k">Applies to</span><span class="v">${esc(audienceLabel(rule.appliesTo))}</span></div>
      ${rule.boundary ? `<div class="r"><span class="k">Not about</span><span class="v">${esc(rule.boundary)}</span></div>` : ''}
      <div class="r"><span class="k">Checked</span><span class="v">${rule.pinned ? 'on every request' : 'when the request looks related'}</span></div>
      ${guidance ? `<div class="r"><span class="k">Told instead</span><span class="v">“${esc(guidance)}”</span></div>` : ''}
    </div>

    <div class="evidence">
      <div class="top">
        <span class="badge${disputed.length ? ' BLOCK' : ''}">${blocked} / ${hits.length}</span>
        <b>${hits.length
          ? `Stopped ${blocked} of the ${hits.length} requests it looked at`
          : 'This rule has not fired yet'}</b>
      </div>
      ${hits.length ? `<div class="body">
        ${disputed.length
          ? `<div class="note bad">${plural(disputed.length, 'of those was', 'of those were')} reported as wrong by the person it stopped.</div>`
          : '<div class="note">Nobody has reported one of these as wrong.</div>'}
        <div class="chips">
          <button type="button" class="btn" data-go="activity" data-q="rule=${attr(rule.id)}">See those decisions</button>
          ${disputed.length ? '<button type="button" class="btn" data-go="inbox">See the reports</button>' : ''}
        </div>
      </div>` : ''}
    </div>

    <div class="folds">
      ${rule.examples ? disclosure('r:examples', 'Examples it was checked against', `
        <div class="label">Would be stopped</div>
        ${(rule.examples.violating ?? []).map((x) => `<div class="note">· ${esc(x)}</div>`).join('') || '<div class="note">—</div>'}
        <div class="label">Must still go through</div>
        ${(rule.examples.compliant ?? []).map((x) => `<div class="note">· ${esc(x)}</div>`).join('') || '<div class="note">—</div>'}`) : ''}
      ${disclosure('r:id', 'Technical record', `<div class="kv">
        <div class="r"><span class="k">Rule id</span><span class="v mono">${esc(rule.id)}</span></div>
        <div class="r"><span class="k">Scope</span><span class="v">${esc(rule.scope ?? '—')}</span></div>
      </div>`)}
    </div>

    <div><button type="button" class="btn danger" id="delRule" data-id="${attr(rule.id)}">Remove rule</button></div>
  </div>`;
}
