/**
 * Where rule compilation runs, as a page rather than four environment variables and a restart.
 */
import { $, esc, post, state } from './core.js';
import { refreshCompiler } from './data.js';
import { modelLabel } from './format.js';
import { render } from './render.js';
import { go } from './router.js';
import { rulesTabs } from './rules.js';
import { VIEWS } from './views.js';

/**
 * Where rule compilation runs, as a page rather than four environment
 * variables and a restart.
 *
 * It sits under Rules, and the line that leads here sits in the composer,
 * because that is where the cost of a weak compiler is felt: a rule whose
 * compliant examples are generic is a rule that blocks honest work, and the
 * local 1.7B writes generic ones. Asked to allow something it has produced a
 * rule prohibiting it.
 *
 * The judge is deliberately absent from this page. It is not a model anyone
 * gets to move from a browser — it sees every employee prompt — and offering
 * the choice here would suggest otherwise.
 */
VIEWS.compiler = {
  railParent: 'policy',
  body: compilerPage,
  bind: bindCompiler
};

/** The draft being edited, seeded from what the server reports. */
function compilerDraft() {
  if (!state.compilerDraft) {
    const c = state.compiler ?? { provider: 'local', baseUrl: '', model: '', redactNames: false };
    const preset = (c.providers ?? []).find((p) => p.id === (c.provider ?? 'local'));
    state.compilerDraft = {
      provider: c.provider ?? 'local',
      // Falls back to the provider's own endpoint so a half-saved setting shows
      // the right host rather than an empty box.
      baseUrl: c.baseUrl || preset?.baseUrl || '',
      model: c.model || preset?.models?.[0] || '',
      apiKey: '',
      redactNames: Boolean(c.redactNames)
    };
  }
  return state.compilerDraft;
}

function compilerPage() {
  const c = state.compiler;
  if (!c) return `<div class="sheet settings">${rulesTabs()}<div class="note">Could not read the compiler settings.</div></div>`;

  const d = compilerDraft();
  const providers = c.providers ?? [];
  const chosen = providers.find((p) => p.id === d.provider) ?? providers[0];
  // Three kinds of provider and they need different forms. `local` asks for
  // nothing. A `-cli` provider asks for nothing either — that is the point of
  // it — beyond which model to pass through. Only a real endpoint needs a URL
  // and a key, so only that one gets those fields.
  const cli = d.provider.endsWith('-cli');
  const remote = d.provider !== 'local' && !cli;
  const t = state.compilerTest;
  const host = (() => {
    try { return new URL(d.baseUrl || chosen?.baseUrl || '').host; } catch { return ''; }
  })();

  return `<div class="sheet settings">
    ${rulesTabs()}

    <div class="section">
      <div class="label">Which model writes your rules</div>

      ${c.overriddenByEnv ? `<div class="banner warn">
        <b>The environment is setting this.</b> <code>WARDEN_COMPILER_API</code> wins over what you save here.
      </div>` : ''}

      <div class="field">
        <label>Provider</label>
        <div class="hero-sugg tight">
          ${providers.map((p) => {
            // A CLI option that is not installed is still offered, greyed and
            // labelled, rather than hidden. Hiding it answers "why can I not
            // use my Claude Code session" with silence; saying "not found on
            // this machine" answers it with the reason.
            const cliState = cliFor(p.id);
            const missing = cliState !== null && !cliState.found;
            return `<button type="button" class="pill${p.id === d.provider ? ' on' : ''}${missing ? ' faded' : ''}" data-prov="${esc(p.id)}">${esc(p.label)}${missing ? ' · not found' : ''}</button>`;
          }).join('')}
        </div>
        ${cliNote(d.provider)}
      </div>

      ${cli ? `
      <div class="field">
        <label for="cModel">Model</label>
        <input id="cModel" type="text" spellcheck="false" list="cModelList" value="${esc(d.model)}"
               placeholder="${esc(chosen?.models?.[0] ?? 'leave blank for its default')}">
        ${chosen?.models?.length ? `<datalist id="cModelList">${chosen.models.map((m) => `<option value="${esc(m)}"></option>`).join('')}</datalist>` : ''}
        <span class="note">${esc(chosen?.note ?? '')}</span>
      </div>

      <div class="field">
        <label class="check"><input id="cRedact" type="checkbox"${d.redactNames ? ' checked' : ''}>
          <span>Send <code>@ana</code> instead of employee names</span></label>
        <span class="note">Sent: your sentence, your role names, your staff list.
          Never: prompts, the log, your policy. Judging stays here.</span>
      </div>
      ` : ''}

      ${remote ? `
      <div class="grid2">
        <div class="field">
          <label for="cBase">Endpoint</label>
          <input id="cBase" type="text" spellcheck="false" value="${esc(d.baseUrl)}" placeholder="https://…/v1">
        </div>
        <div class="field">
          <label for="cModel">Model</label>
          <input id="cModel" type="text" spellcheck="false" list="cModelList" value="${esc(d.model)}"
                 placeholder="${esc(chosen?.models?.[0] ?? 'model name')}">
          ${chosen?.models?.length ? `<datalist id="cModelList">${chosen.models.map((m) => `<option value="${esc(m)}"></option>`).join('')}</datalist>` : ''}
        </div>
      </div>

      <div class="field">
        <label for="cKey">API key</label>
        <input id="cKey" type="password" spellcheck="false" autocomplete="off" value=""
               placeholder="${c.hasKey ? `saved ${esc(c.keyHint)} — leave blank to keep it` : 'paste your key'}">
        <span class="note">${chosen?.note ? `${esc(chosen.note)}. ` : ''}Kept on this machine, never shown again.</span>
      </div>

      <div class="field">
        <label class="check"><input id="cRedact" type="checkbox"${d.redactNames ? ' checked' : ''}>
          <span>Send <code>@ana</code> instead of employee names</span></label>
        <span class="note">Sent: your sentence, your role names, your staff list.
          Never sent: employee prompts, the audit log, your policy.</span>
      </div>
      ` : ''}

      <div class="actions">
        ${remote ? '<button type="button" class="btn" id="cTest">Test connection</button>' : ''}
        <button type="button" class="btn primary" id="cSave">Save</button>
        ${t ? `<span class="note ${t.ok ? 'good' : 'bad'}">${
          t.saved ? 'Saved.'
          : t.ok ? `Answered in ${t.ms} ms.`
          : esc(String(t.error ?? `HTTP ${t.status}`).slice(0, 160))}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function bindCompiler() {
  const d = compilerDraft();
  const providers = state.compiler?.providers ?? [];

  /**
   * Switching provider rewrites the endpoint and model boxes, and has to say so
   * explicitly.
   *
   * `render()` restores every field by id *after* replacing the pane, which is
   * right while someone is typing and wrong when the re-render is happening
   * *because* the values changed: the new provider's endpoint went into the
   * HTML and was immediately overwritten with the old one. The page then showed
   * Google selected next to `api.anthropic.com`, which is not a cosmetic
   * disagreement — it is the wrong host in the box that decides where the staff
   * list gets sent. `adopt` marks the one render that must win over the restore,
   * and `bindCompiler` runs after it.
   */
  if (d.adopt) {
    const base = document.getElementById('cBase');
    const model = document.getElementById('cModel');
    if (base) base.value = d.baseUrl;
    if (model) model.value = d.model;
    delete d.adopt;
  }

  for (const b of document.querySelectorAll('[data-prov]')) {
    b.onclick = () => {
      const next = providers.find((p) => p.id === b.dataset.prov);
      // Adopts that provider's own endpoint and first model, so the common case
      // is one click. It does not clear a typed key — changing the model of the
      // same provider is the other common case.
      state.compilerDraft = {
        ...d,
        provider: b.dataset.prov,
        baseUrl: next?.baseUrl ?? '',
        model: next?.models?.[0] ?? '',
        adopt: true
      };
      state.compilerTest = null;
      render();
    };
  }

  const readForm = () => ({
    provider: d.provider,
    baseUrl: document.getElementById('cBase')?.value.trim() ?? '',
    model: document.getElementById('cModel')?.value.trim() ?? '',
    apiKey: document.getElementById('cKey')?.value ?? '',
    redactNames: Boolean(document.getElementById('cRedact')?.checked)
  });

  const test = document.getElementById('cTest');
  if (test) test.onclick = async () => {
    state.compilerDraft = readForm();
    test.disabled = true;
    test.textContent = 'Testing…';
    const { j } = await post('/api/settings/compiler/test', state.compilerDraft).catch(() => ({ j: { ok: false, error: 'could not reach Warden' } }));
    state.compilerTest = j;
    render();
  };

  const save = document.getElementById('cSave');
  if (save) save.onclick = async () => {
    state.compilerDraft = readForm();
    save.disabled = true;
    save.textContent = 'Saving…';
    const { ok, j } = await post('/api/settings/compiler', state.compilerDraft, { method: 'PUT' }).catch(() => ({ ok: false, j: { error: 'could not reach Warden' } }));
    if (!ok) {
      state.compilerTest = { ok: false, error: j?.error ?? 'could not save' };
      render();
      return;
    }
    await refreshCompiler();
    state.compilerDraft = null;
    state.compilerTest = { ok: true, saved: true };
    render();
    // Clear the key box by hand. `restoreFields` reinstates form values across
    // a re-render, which is right for every other field and wrong for this one:
    // dropping the draft is not enough to get the secret back out of the DOM,
    // and the placeholder already says a key is saved and shows its last four.
    const box = document.getElementById('cKey');
    if (box) box.value = '';
  };
}

/** One line in the composer saying who is about to write the rule. */
/**
 * What the gateway found when it looked for this CLI, or null if this provider
 * is not one. `cliTools` is absent on a gateway older than the route that
 * reports it, which reads as "no claim either way" and shows nothing.
 */
const CLI_TOOL_OF = {
  'claude-cli': 'claude',
  'codex-cli': 'codex',
  'gemini-cli': 'gemini',
  'opencode-cli': 'opencode',
  'cursor-cli': 'cursor-agent',
  'copilot-cli': 'copilot'
};

function cliFor(providerId) {
  const tool = CLI_TOOL_OF[providerId];
  if (!tool) return null;
  return (state.compiler?.cliTools ?? []).find((t) => t.tool === tool) ?? null;
}

/** The one line under the picker that says whether the chosen CLI is there. */
function cliNote(providerId) {
  const found = cliFor(providerId);
  if (!found) return '';
  return found.found
    ? `<span class="note good">Found. It uses the session you are already signed in to, so there is no key to paste and no second bill.</span>`
    : `<span class="note bad">Not on this machine. Install <span class="mono">${esc(found.tool)}</span>, sign in, then come back to this page.</span>`;
}

/**
 * The model picker, inside the composer.
 *
 * This used to be a grey line under the box, "Drafting with opus · Claude Code
 * Change", and nobody found it: the line read as a caption and the verb at the
 * end of it was the whole control. So the choice now sits where the chat tools
 * people already use put theirs, a button in the bottom-left corner of the box
 * with the model's name on it, and a menu that switches in one click for the
 * options that need nothing typed. An endpoint still needs a URL and a key, so
 * that option goes to the settings page rather than pretending it fits a menu.
 *
 * The name on the button comes from `/api/models`, which resolves the CLI,
 * the endpoint and the local weights together. It used to be derived from
 * `activeSource`, which knows about an endpoint and nothing about a signed-in
 * CLI, and two lines on one screen disagreed about the same fact.
 */
export function modelPicker() {
  const d = state.models?.drafting;
  const c = state.compiler;
  if (!d || !c) return '';
  const env = Boolean(c.overriddenByEnv);
  const current = c.provider ?? 'local';
  // Only what switches in one click: the local weights and the CLIs that are
  // actually on this machine. The ones that are not, and the endpoints, live
  // on the settings page, where there is room to say what is missing.
  const quick = (c.providers ?? []).filter((p) => p.id === 'local' || (p.id.endsWith('-cli') && cliFor(p.id)?.found));
  return `<details class="menu model-pick" id="modelPick">
    <summary title="Which model writes your rules"><span class="dot"></span>${esc(modelLabel(d.model))} · ${esc(d.where)}<span class="caret">⌄</span></summary>
    <div class="menu-list">
      <div class="menu-head">${env ? 'Set by the environment (WARDEN_COMPILER_*)' : 'Which model writes your rules'}</div>
      ${quick.map((p) => {
        const on = !env && p.id === current;
        const sub = p.id === 'local' ? 'nothing leaves the machine'
          : `your signed-in session${p.models?.[0] ? ` · ${p.models[0]}` : ''}`;
        return `<button type="button" class="menu-item${on ? ' on' : ''}" data-pick="${esc(p.id)}"${env ? ' disabled' : ''}>
          <span>${esc(p.label.replace(' on this machine', ''))}</span><span class="menu-sub">${esc(sub)}</span></button>`;
      }).join('')}
      <button type="button" class="menu-item" data-go="compiler"><span>Another model, or an endpoint…</span><span class="menu-sub">pick a model by name, or point at an API</span></button>
    </div>
  </details>`;
}

/** One click in the menu saves the provider and its first model, then re-reads who is drafting. */
export function bindModelPicker() {
  const c = state.compiler;
  for (const b of document.querySelectorAll('[data-pick]')) {
    b.onclick = async () => {
      b.closest('details')?.removeAttribute('open');
      const next = (c?.providers ?? []).find((p) => p.id === b.dataset.pick);
      if (!next || next.id === c?.provider) return;
      b.disabled = true;
      // An empty key keeps whatever is saved; neither the local model nor a CLI
      // needs one, and the endpoint providers are not offered here.
      const body = { provider: next.id, baseUrl: '', model: next.models?.[0] ?? '', apiKey: '', redactNames: Boolean(c?.redactNames) };
      const { ok, j } = await post('/api/settings/compiler', body, { method: 'PUT' }).catch(() => ({ ok: false, j: { error: 'could not reach Warden' } }));
      state.compilerDraft = null;
      if (!ok) {
        // The settings page has the room to say what went wrong; the menu does not.
        state.compilerTest = { ok: false, error: j?.error ?? 'could not save' };
        go('compiler');
        return;
      }
      await refreshCompiler();
      render();
    };
  }
}
