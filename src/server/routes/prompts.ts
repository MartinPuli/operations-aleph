/** Prompt text is an administrator-only configuration surface. Audit records
 * identify revisions and hashes; neither audit nor events receives the text. */
import { Router, type Request, type Response } from 'express';
import { definitions, templateIsActive } from '../../prompts/catalog.js';
import { changePrompt, MAX_TEMPLATE_CHARS, PromptError, readPromptState, templateHash, type PromptState } from '../../prompts/store.js';
import { formFromEnv } from '../../guard/passes/forms.js';
import { recordAdminAction } from '../../audit/log.js';
import { actorForCredential } from '../../policy/people.js';

export const promptRoutes = Router();
function catalog(state: PromptState = readPromptState()) {
  const form = formFromEnv();
  const policy = process.env['WARDEN_DYNAGUARD_POLICY'] === 'v2' ? 'v2' : 'v1';
  const screen = process.env['WARDEN_POLICY_SCREEN'] === '1';
  return { revision: state.revision, updatedAt: state.updatedAt, maxTemplateChars: MAX_TEMPLATE_CHARS,
    templates: definitions().map((entry) => ({ ...entry,
      template: state.overrides[entry.id] ?? entry.defaultTemplate,
      hash: templateHash(state.overrides[entry.id] ?? entry.defaultTemplate),
      custom: Object.hasOwn(state.overrides, entry.id), active: templateIsActive(entry.id, form, policy, screen),
      requiredTokens: entry.tokens.filter((token) => token.required).map((token) => token.name)
    })) };
}
function endpoint(work: (req: Request, res: Response) => void) {
  return (req: Request, res: Response) => {
    try { work(req, res); }
    catch (error) {
      const known = error instanceof PromptError;
      res.status(known ? error.status : 500).json({ error: known ? error.message : 'The prompt operation could not be completed.',
        code: known ? error.code : 'prompt_operation_failed', ...(known ? error.detail : {}) });
    }
  };
}
promptRoutes.get('/api/prompts', endpoint((_req, res) => { res.json(catalog()); }));
for (const reset of [false, true]) {
  const route = reset ? '/api/prompts/:id/reset' : '/api/prompts/:id';
  promptRoutes[reset ? 'post' : 'put'](route, endpoint((req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).some((key) => !(reset ? ['revision'] : ['revision', 'template']).includes(key))) {
      throw new PromptError('Send the revision and template fields for this operation.', 400, 'invalid_template');
    }
    const id = String(req.params.id);
    const changed = changePrompt(id, req.body.revision, req.body.template, reset);
    const actor = actorForCredential(req.header('authorization'));
    try {
      recordAdminAction(actor ? { id: actor.id, role: actor.role } : { id: 'local', role: 'administrator' },
        `prompt:${reset ? 'reset' : 'update'} ${id} revision=${changed.state.revision} sha256=${changed.hash} previous=${changed.previousHash}`, 200);
    } catch (error) {
      // The atomic configuration write already succeeded. An audit disk error
      // must be visible to the operator without telling the editor its save
      // failed and inviting an overwrite based on a stale revision.
      console.error('Prompt change was saved but its audit record could not be written:', error);
    }
    res.json(catalog(changed.state));
  }));
}
