/** The two model roles, their actual runtime selections, and your saved models. */
import { $, esc, post, state } from './core.js';
import { bindCompiler, clearCompilerSecret, compilerSettings } from './compiler.js';
import { refreshAdjudicator, refreshCompiler } from './data.js';
import { bindGetModels } from './engine.js';
import { modelLabel } from './format.js';
import { bindLibrary, library, libraryMarkup, loadLibrary } from './model-library.js';
import { bindPromptEditor, closePromptEditor, hasPromptChanges, loadPrompts, promptEditor, promptEditorMarkup, togglePromptEditor } from './prompt-editor.js';
import { render } from './render.js';
import { VIEWS } from './views.js';

let expanded = null;
let changingAnalyzer = '';
let analyzerNote = null;
let refreshing = false;

async function refreshSelections() {
  await Promise.all([refreshCompiler(), refreshAdjudicator()]);
  if (promptEditor.catalog) await loadPrompts();
}

async function enterModels() {
  if (state.view === 'compiler') expanded = 'compiler';
  if (refreshing) return;
  refreshing = true;
  try { await Promise.all([loadLibrary(), refreshSelections()]); }
  finally { refreshing = false; if (['models', 'compiler'].includes(state.view)) render(); }
}

function runtimeNote() {
  const m = state.models;
  if (!m) return '<p class="note bad" role="status">Model status is unavailable. Refresh to try again.</p>';
  if (m.mock) return '<p class="note">Demo mode uses a stand-in. Apply models here to configure this installation; live model behavior must be checked with the real runtime.</p>';
  if (m.runtime?.ok === false || m.state === 'failed') return '<p class="note bad" role="status">The analyzer is unavailable. Requests that cannot be evaluated are held for review. Open runtime details to see what needs attention.</p>';
  return `<p class="note${m.state === 'ready' ? ' good' : ''}" role="status">${m.state === 'ready' ? 'Local analysis is running.' : 'The local analyzer will load when needed.'} Requests and documents are analyzed on this gateway.</p>`;
}

function activeRole(role) {
  const compiler = role === 'compiler';
  const active = compiler ? state.models?.drafting : state.models?.judging;
  const inForce = library.catalog?.inForce?.[role] ?? (compiler ? state.compiler?.inForce : state.adjudicator?.inForce) ?? active?.model;
  const basename = String(inForce ?? '').split(/[\\/]/).pop();
  // A saved built-in preference may still be downloading while custom weights
  // remain loaded. Resolve the running file before consulting role metadata.
  const custom = library.catalog?.models.find((model) => model.kind === 'local' && (basename === `${model.id}.gguf` || basename === model.filename))
    ?? library.catalog?.models.find((model) => model.activeRoles?.includes(role));
  const overridden = compiler ? state.compiler?.overriddenByEnv : state.adjudicator?.overriddenByEnv;
  const title = compiler ? 'Compiler' : 'Analyzer';
  const open = expanded === role;
  return `<section class="active-model-role" aria-labelledby="${role}Title">
    <div class="active-model-row">
      <div class="active-role-title"><h2 id="${role}Title">${title}</h2><p>${compiler ? 'Turns your instructions into rules' : 'Checks employee requests and documents'}</p></div>
      <div class="active-role-value"><b data-active-model="${role}">${esc(custom?.name || modelLabel(inForce) || 'Status unavailable')}</b><span>${esc(active?.where ?? 'Refresh to read the current model')}</span>${overridden ? '<span class="model-status warn">Environment override</span>' : ''}</div>
      <div class="active-role-actions"><button type="button" class="btn" id="edit-${role}" data-edit-role="${role}" aria-expanded="${open}" aria-controls="${role}Editor">${open ? 'Close' : 'Change model'}</button><button type="button" class="btn quiet" id="prompts-${role}" data-prompt-role="${role}" aria-expanded="${promptEditor.openRole === role}" aria-controls="${role}Prompts">${promptEditor.openRole === role ? 'Close prompts' : 'Edit prompts'}</button>${hasPromptChanges(role) ? '<span class="note warn">Unsaved prompt changes</span>' : ''}</div>
    </div>
    ${open ? `<div id="${role}Editor" class="active-model-editor">${compiler ? compilerSettings() : analyzerSettings()}</div>` : ''}
    ${promptEditorMarkup(role)}
  </section>`;
}

function analyzerSettings() {
  const a = state.adjudicator;
  if (!a) return '<p class="note bad" role="alert">Analyzer choices could not be loaded. Refresh Models to try again.</p>';
  const custom = library.catalog?.selections?.adjudicator;
  const chosen = !custom ? a.model : null;
  const selected = a.choices.find((choice) => choice.id === chosen);
  return `<div class="model-editor analyzer-editor" aria-busy="${Boolean(changingAnalyzer)}">
    <p class="note">Choose installed weights, or select a model to download. The analyzer always runs on this gateway. Your own compatible models appear in Your models below.</p>
    ${a.overriddenByEnv ? `<div class="banner warn"><b>Controlled by the environment.</b> ${esc(modelLabel(a.inForce))} is in force. Saved preferences apply after the environment override is removed.</div>` : ''}
    <ul class="analyzer-options">${a.choices.map((choice) => {
      const on = choice.id === chosen;
      const current = !a.overriddenByEnv && choice.onDisk && on;
      return `<li class="analyzer-option${on ? ' chosen' : ''}"><div><div class="library-model-name"><h3>${esc(choice.label)}</h3>${on ? `<span class="model-status${current ? ' good' : ' warn'}">${current ? 'Selected' : 'Saved preference'}</span>` : ''}</div><p>${esc(choice.trade)}</p><div class="model-metadata"><span>${(choice.approxMB / 1000).toFixed(1)} GB</span><span class="${choice.onDisk ? 'good' : 'warn'}">${choice.onDisk ? 'On this gateway' : 'Not downloaded'}</span><span>${esc(choice.perDecision ?? 'Speed not measured')}</span></div></div><div class="analyzer-option-action">${on && !choice.onDisk && state.canLeaveDemo ? '<button type="button" class="btn primary js-get-models">Download model</button>' : `<button type="button" class="btn" data-analyzer-choice="${esc(choice.id)}"${changingAnalyzer || on ? ' disabled' : ''}>${changingAnalyzer === choice.id ? 'Applying…' : current ? 'Selected' : choice.onDisk ? 'Use model' : 'Select for download'}</button>`}</div></li>`;
    }).join('')}</ul>
    ${selected && !selected.onDisk ? `<p class="note warn">${esc(selected.label)} is not downloaded yet. ${state.canLeaveDemo ? 'Download it to finish applying this selection.' : 'Run the model setup on the gateway to download it.'} The current runtime model is shown above.</p>` : ''}
    ${analyzerNote ? `<p class="note ${analyzerNote.ok ? 'good' : 'bad'}" role="${analyzerNote.ok ? 'status' : 'alert'}">${esc(analyzerNote.text)}</p>` : ''}
  </div>`;
}

function modelsPage() {
  return `<div class="sheet settings models-page">
    <div class="models-page-head"><div><h1>Models</h1><p>Choose what writes your rules and what checks each request. Edit the prompts each role uses.</p></div><button type="button" class="btn quiet" id="refreshModels"${refreshing ? ' disabled' : ''}>${refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
    <div class="models-runtime-line">${runtimeNote()}<button type="button" class="linkbtn" data-go="engine">Runtime details</button></div>
    <div class="active-models">${activeRole('compiler')}${activeRole('adjudicator')}</div>
    ${libraryMarkup()}
    <section class="models-document-note" aria-labelledby="documentsModelTitle"><div><h2 id="documentsModelTitle">Documents use the same analyzer</h2><p class="note">PDF, Word, text files, scans and images are read locally before policy checks. Try a file to inspect its reading status and verdict.</p></div><button type="button" class="btn" data-go="simulator">Try a document</button></section>
  </div>`;
}

function bindModels() {
  if ($('refreshModels')) $('refreshModels').onclick = () => { void enterModels(); render(); };
  for (const button of document.querySelectorAll('[data-edit-role]')) button.onclick = () => { clearCompilerSecret(); closePromptEditor(); expanded = expanded === button.dataset.editRole ? null : button.dataset.editRole; render(); $(button.id)?.focus(); };
  for (const button of document.querySelectorAll('[data-prompt-role]')) button.onclick = () => { clearCompilerSecret(); expanded = null; togglePromptEditor(button.dataset.promptRole); render(); $(button.id)?.focus(); };
  if (expanded === 'compiler') bindCompiler(loadLibrary);
  for (const button of document.querySelectorAll('[data-analyzer-choice]')) button.onclick = async () => {
    if (changingAnalyzer) return;
    changingAnalyzer = button.dataset.analyzerChoice; analyzerNote = null; render();
    try {
      const result = await post('/api/settings/adjudicator', { model: changingAnalyzer });
      if (!result.ok) throw new Error(typeof result.j?.error === 'string' ? result.j.error : 'The analyzer could not be changed. Try again.');
      analyzerNote = { ok: true, text: result.j.needsDownload ? 'Preference saved. Download this model to finish applying it.' : 'Analyzer applied. New requests use this selection.' };
      await Promise.all([refreshSelections(), loadLibrary()]);
    } catch (error) { analyzerNote = { ok: false, text: error.message || 'Warden could not be reached. Try again.' }; }
    finally { changingAnalyzer = ''; if (['models', 'compiler'].includes(state.view)) { render(); $('edit-adjudicator')?.focus(); } }
  };
  bindGetModels();
  bindLibrary(refreshSelections);
  bindPromptEditor();
}

VIEWS.models = { body: modelsPage, bind: bindModels, onEnter: enterModels, onLeave: clearCompilerSecret };
// Existing links from the rule composer keep working, while both roles and
// custom models remain visible from the same top-level administration page.
VIEWS.compiler = { ...VIEWS.models, railParent: 'models' };
