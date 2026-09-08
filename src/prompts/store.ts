/** Installation-owned instructions. A request keeps one immutable revision;
 * edits affect the next request and never interpolate employee text twice. */
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { atomicJSON } from '../models/store.js';
import { definitions, type PromptDefinition } from './catalog.js';

export class PromptError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'invalid_template', readonly detail: Record<string, unknown> = {}) { super(message); }
}
export type PromptState = { version: 1; revision: string; updatedAt: string | null; overrides: Record<string, string> };
type Snapshot = { state?: PromptState; error?: PromptError };
const context = new AsyncLocalStorage<Snapshot>();
export const MAX_TEMPLATE_CHARS = 32_768;
export function promptTemplatesPath(): string {
  return process.env['WARDEN_PROMPT_TEMPLATES_PATH'] ?? join(dirname(process.env['WARDEN_SETTINGS_PATH'] ?? 'data/settings.json'), 'prompts.json');
}
export function templateHash(template: string): string { return createHash('sha256').update(template).digest('hex'); }
export function validateTemplate(definition: PromptDefinition, template: unknown): asserts template is string {
  if (typeof template !== 'string' || template.length > MAX_TEMPLATE_CHARS || template.includes('\0')) {
    throw new PromptError(`A prompt must be text of at most ${MAX_TEMPLATE_CHARS} characters, without null bytes.`, 400, 'invalid_template', { field: 'template' });
  }
  const names = [...template.matchAll(/\{\{([^{}]*)\}\}/g)].map((match) => match[1]!);
  const allowed = definition.tokens.map((token) => token.name);
  const missingTokens = definition.tokens.filter((token) => token.required && !names.includes(token.name)).map((token) => token.name);
  const unknownTokens = [...new Set(names.filter((name) => !allowed.includes(name)))];
  // Closing JSON objects naturally contain "}}". Only an unclosed opening
  // delimiter claims to be a variable; ordinary nested JSON remains literal.
  const malformed = /\{\{/.test(template.replace(/\{\{[^{}]*\}\}/g, ''));
  if (missingTokens.length || unknownTokens.length || malformed) throw new PromptError('Keep every required variable and use only the listed {{variables}}.', 400, 'invalid_template', { field: 'template', missingTokens, unknownTokens });
}
export function readPromptState(): PromptState {
  const path = promptTemplatesPath();
  if (!existsSync(path)) return { version: 1, revision: '0', updatedAt: null, overrides: {} };
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as PromptState;
    if (!raw || raw.version !== 1 || typeof raw.revision !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(raw.revision)
      || (raw.updatedAt !== null && typeof raw.updatedAt !== 'string') || !raw.overrides || typeof raw.overrides !== 'object' || Array.isArray(raw.overrides)
      || Object.keys(raw).some((key) => !['version', 'revision', 'updatedAt', 'overrides'].includes(key))) throw new Error('invalid state');
    const catalog = definitions();
    for (const [id, template] of Object.entries(raw.overrides)) {
      const definition = catalog.find((entry) => entry.id === id);
      if (!definition) throw new Error('unknown template');
      validateTemplate(definition, template);
    }
    return Object.freeze({ ...raw, overrides: Object.freeze({ ...raw.overrides }) });
  } catch {
    throw new PromptError('The saved prompt templates are unreadable. Restore the installation file before changing or using them.', 503, 'prompt_store_unreadable');
  }
}
export function changePrompt(id: string, revision: unknown, template: unknown, reset = false): { state: PromptState; previousHash: string; hash: string } {
  const definition = definitions().find((entry) => entry.id === id);
  if (!definition) throw new PromptError('Prompt template not found.', 404, 'prompt_not_found');
  const current = readPromptState();
  if (typeof revision !== 'string' || !revision) throw new PromptError('Send the revision shown by the prompt editor.', 400, 'invalid_revision', { field: 'revision' });
  if (revision !== current.revision) throw new PromptError('These prompts changed while you were editing. Reload the latest revision before saving.', 409, 'revision_conflict', { revision: current.revision });
  const defaultTemplate = definition.defaultTemplate;
  if (!reset) validateTemplate(definition, template);
  const overrides = { ...current.overrides };
  const previousHash = templateHash(overrides[id] ?? defaultTemplate);
  if (reset || template === defaultTemplate) delete overrides[id];
  else overrides[id] = template as string;
  const state: PromptState = { version: 1, revision: randomUUID(), updatedAt: new Date().toISOString(), overrides };
  atomicJSON(promptTemplatesPath(), state);
  return { state, previousHash, hash: templateHash(overrides[id] ?? defaultTemplate) };
}
export function withPromptSnapshot<T>(work: () => Promise<T>): Promise<T> {
  if (context.getStore()) return work();
  let snapshot: Snapshot;
  try { snapshot = { state: readPromptState() }; }
  catch (error) { snapshot = { error: error as PromptError }; }
  // Delay an unreadable-store error until rendering: adjudication's existing
  // per-rule failure path then records ESCALATE instead of a silent fallback.
  return context.run(snapshot, work);
}
function snapshotState(): PromptState {
  const snapshot = context.getStore();
  if (snapshot?.error) throw snapshot.error;
  return snapshot?.state ?? readPromptState();
}
export function promptOverride(id: string): string | undefined { return snapshotState().overrides[id]; }
export function renderPrompt(id: string, values: Record<string, string>, fallback: () => string): string {
  const template = promptOverride(id);
  if (template === undefined) return fallback();
  // Count only the literals and values consumed so far. A repeated message
  // variable must hit the bound before allocating hundreds of megabytes, and
  // empty later variables must not cause an otherwise valid prompt to fail.
  let renderedChars = 0;
  let cursor = 0;
  for (const match of template.matchAll(/\{\{([^{}]*)\}\}/g)) {
    const token = match[1]!;
    if (!Object.hasOwn(values, token)) throw new PromptError('A prompt variable could not be supplied.', 503, 'prompt_context_unavailable');
    renderedChars += match.index - cursor + values[token]!.length;
    if (renderedChars > 256_000) throw new PromptError('The rendered prompt exceeds its context limit.', 400, 'prompt_context_limit');
    cursor = match.index + match[0].length;
  }
  renderedChars += template.length - cursor;
  if (renderedChars > 256_000) throw new PromptError('The rendered prompt exceeds its context limit.', 400, 'prompt_context_limit');
  return template.replace(/\{\{([^{}]*)\}\}/g, (_match, token: string) => values[token]!);
}
export function promptMetadata(): { promptRevision: string; promptHash: string } {
  const state = snapshotState();
  const effective = definitions().map((entry) => [entry.id, state.overrides[entry.id] ?? entry.defaultTemplate]).sort(([a], [b]) => a!.localeCompare(b!));
  return { promptRevision: state.revision, promptHash: templateHash(JSON.stringify(effective)) };
}
