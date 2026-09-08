/** Compiler settings, shared by the Models screen and its older deep link. */
import { $, esc, post, state } from './core.js';
import { refreshCompiler } from './data.js';
import { modelLabel } from './format.js';
import { render } from './render.js';
import { go } from './router.js';
import { VIEWS } from './views.js';

// A tested key can be applied without asking the administrator to paste it
// twice. It is scoped to the tested host and never reinserted into an input.
let testedKey = null;
export function clearCompilerSecret() { testedKey = null; }

VIEWS.compiler = {
  railParent: 'models',
  body: () => `<div class="sheet settings"><button class="btn quiet" data-go="models">Back to Models</button>${compilerSettings()}</div>`,
  bind: bindCompiler
};

function compilerDraft() {
  if (!state.compilerDraft) {
    const c = state.compiler ?? {};
    const provider = (c.providers ?? []).some((p) => p.id === c.provider) ? c.provider : 'local';
    const preset = (c.providers ?? []).find((p) => p.id === provider);
    state.compilerDraft = {
      provider, baseUrl: c.baseUrl || preset?.baseUrl || '',
      model: c.model || preset?.models?.[0] || '', redactNames: Boolean(c.redactNames)
    };
  }
  return state.compilerDraft;
}

/** The registry owns named custom connections; this form keeps the existing
 * preset and signed-in CLI choices in the same administrative surface. */
export function compilerSettings() {
  const c = state.compiler;
  if (!c) return '<p class="note bad" role="alert">Compiler settings could not be loaded. Refresh Models to try again.</p>';
  const d = compilerDraft();
  const chosen = (c.providers ?? []).find((p) => p.id === d.provider);
  const cli = d.provider.endsWith('-cli');
  const remote = d.provider !== 'local' && !cli;
  const busy = state.compilerBusy;
  const t = state.compilerTest;
  return `<form id="compilerForm" class="model-editor" aria-label="Compiler settings" aria-busy="${Boolean(busy)}">
    <p class="note">The compiler turns your instructions into rules. A provider or signed-in CLI can receive your instruction, role names and staff list. Employee requests are analyzed locally.</p>
    ${c.overriddenByEnv ? '<div class="banner warn"><b>Controlled by the environment.</b> Your saved preference will apply after the environment override is removed.</div>' : ''}
    <fieldset class="model-fields"${busy ? ' disabled' : ''}>
      <div class="field">
        <label for="cProvider">Provider</label>
        <select id="cProvider" data-no-restore>${(c.providers ?? []).map((p) => `<option value="${esc(p.id)}"${p.id === d.provider ? ' selected' : ''}>${esc(p.label)}${cliFor(p.id)?.found === false ? ' · not installed' : ''}</option>`).join('')}</select>
        ${cliNote(d.provider)}
      </div>
      ${remote ? `<div class="field"><label for="cBase">API endpoint</label><input id="cBase" type="text" spellcheck="false" autocomplete="url" required value="${esc(d.baseUrl)}" placeholder="https://api.example.com/v1"><span class="note">Use the provider’s OpenAI-compatible endpoint.</span></div>` : ''}
      ${remote || cli ? `<div class="field">
        <label for="cModel">Model ${cli ? '<span class="optional">(optional)</span>' : ''}</label>
        <input id="cModel" type="text" spellcheck="false" list="cModelList"${remote ? ' required' : ''} value="${esc(d.model)}" placeholder="${esc(chosen?.models?.[0] ?? 'Provider default')}">
        <datalist id="cModelList">${(chosen?.models ?? []).map((m) => `<option value="${esc(m)}"></option>`).join('')}</datalist>
        ${chosen?.note ? `<span class="note">${esc(chosen.note)}</span>` : ''}
      </div>` : `<p class="note">Uses the compiler weights installed on this machine. Choose a model from Your models below to use your own local weights.</p>`}
      ${remote ? `<div class="field"><label for="cKey">API key <span class="optional">(if required)</span></label><input id="cKey" type="password" autocomplete="off" spellcheck="false" value="" placeholder="${testedKey ? 'Tested key ready to apply.' : c.hasKey ? 'A key is saved. Leave blank to keep it.' : 'Enter a provider key'}"><span class="note">Stored on the gateway. Saved keys are never returned to this page.</span></div>` : ''}
      ${remote || cli ? `<div class="field"><label class="check"><input id="cRedact" type="checkbox"${d.redactNames ? ' checked' : ''}><span>Replace employee names with their IDs before sending</span></label></div>` : ''}
      <div class="actions">
        ${remote ? '<button type="button" class="btn" id="cTest">Test connection</button>' : ''}
        <button type="submit" class="btn primary" id="cSave">${busy === 'save' ? 'Applying…' : 'Apply compiler'}</button>
      </div>
    </fieldset>
    <div id="compilerFeedback" role="status" aria-live="polite">${busy === 'test' ? '<p class="note">Testing the connection…</p>' : t ? `<p class="note ${t.ok ? 'good' : 'bad'}">${t.saved ? 'Compiler applied. New rule drafts use this selection.' : t.ok ? `Connection answered in ${t.ms ?? 0} ms. Apply the compiler when you are ready.` : esc(String(t.error ?? 'The compiler could not be updated. Try again.'))}</p>` : ''}</div>
  </form>`;
}

export function bindCompiler(onChanged = async () => {}) {
  if (!$('compilerForm')) return;
  const d = compilerDraft();
  if (d.adopt) {
    if ($('cBase')) $('cBase').value = d.baseUrl;
    if ($('cModel')) $('cModel').value = d.model;
    delete d.adopt;
  }
  $('cProvider').onchange = (event) => {
    testedKey = null;
    const next = (state.compiler?.providers ?? []).find((p) => p.id === event.target.value);
    state.compilerDraft = { provider: next.id, baseUrl: next.baseUrl ?? '', model: next.models?.[0] ?? '', redactNames: Boolean($('cRedact')?.checked), adopt: true };
    state.compilerTest = null;
    render();
    $('cProvider')?.focus();
  };
  const readForm = () => ({
    provider: d.provider, baseUrl: $('cBase')?.value.trim() ?? '', model: $('cModel')?.value.trim() ?? '',
    redactNames: Boolean($('cRedact')?.checked)
  });
  // Public fields survive background audit refreshes. The secret is read only
  // at submission and lives in that request, never in long-lived UI state.
  for (const f of $('compilerForm').querySelectorAll('input:not([type="password"])')) f.oninput = () => {
    Object.assign(d, readForm()); state.compilerTest = null;
    if (f.id === 'cBase') { testedKey = null; if ($('cKey')) $('cKey').value = ''; }
  };
  async function submit(mode) {
    if (state.compilerBusy || !$('compilerForm').reportValidity()) return;
    const fields = readForm();
    const sameHost = testedKey?.provider === fields.provider && testedKey?.baseUrl === fields.baseUrl;
    const body = { ...fields, apiKey: $('cKey')?.value || (sameHost ? testedKey.key : '') };
    state.compilerDraft = readForm();
    state.compilerBusy = mode;
    state.compilerTest = null;
    render();
    try {
      const result = await post(`/api/settings/compiler${mode === 'test' ? '/test' : ''}`, body, mode === 'save' ? { method: 'PUT' } : {});
      if (!result.ok || result.j?.ok === false) {
        state.compilerTest = { ok: false, error: typeof result.j?.error === 'string' ? result.j.error : 'The provider did not answer. Check the endpoint, model and key, then try again.' };
      } else if (mode === 'test') {
        testedKey = body.apiKey ? { key: body.apiKey, provider: body.provider, baseUrl: body.baseUrl } : null;
        state.compilerTest = { ...result.j, ok: true };
      } else {
        testedKey = null;
        await refreshCompiler();
        await onChanged();
        state.compilerDraft = null;
        state.compilerTest = { ok: true, saved: true };
      }
    } catch {
      state.compilerTest = { ok: false, error: 'Warden could not be reached. Check the gateway connection and try again.' };
    } finally {
      body.apiKey = '';
      state.compilerBusy = false;
      render();
      $(mode === 'test' ? 'cTest' : 'cSave')?.focus();
    }
  }
  if ($('cTest')) $('cTest').onclick = () => void submit('test');
  $('compilerForm').onsubmit = (event) => { event.preventDefault(); void submit('save'); };
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
    <summary title="Which model writes your rules"><span class="dot"></span><span class="k">Model</span>${esc(modelLabel(d.model))} · ${esc(d.where)}<span class="caret">⌄</span></summary>
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
