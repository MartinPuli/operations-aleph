# Compiler and analyzer prompts

The **Models** screen exposes **Edit prompts** beside both roles. These are the
complete templates Warden actually sends to its compiler and analyzer, including
their system and request turns. A custom template replaces that template; it is
not an extra instruction silently appended to an unchanged prompt.

The settings belong to the gateway installation. Administrators share them.
They are associated with a role and response format, independently of a model
catalogue entry, so selecting another model does not erase a customization.
The editor identifies the templates used by the current configuration and keeps
the other formats available. An environment-selected analyzer format still
determines which templates run.

## Editing and restoring

1. Open **Models**, then **Edit prompts** for the relevant role.
2. Select the stage to inspect. Read the full template, its variables and the
   required response format. Expand the default-template reference to compare.
3. Edit the text and choose **Save prompt**. Ctrl+Enter or Command+Enter also
   saves. Opening the editor, typing or switching templates does not save.
4. Use **Restore default** to remove that template's customization. The inline
   confirmation identifies the template and explains that its draft is discarded.

Unsaved drafts remain in memory in the same browser tab when switching templates,
closing an editor or leaving Models. They are not stored in browser storage;
save before reloading or closing the tab. The browser warns about pending edits
when supported. A refresh updates saved information without replacing a dirty
draft. **Discard changes** loads the current saved version of that template.

Every write includes the revision that was read. If another administrator has
changed the same template, the editor keeps the draft and shows the newer saved
text for comparison. **Keep my draft** explicitly prepares it to replace that
newer version on the next save. **Discard draft and use saved prompt** accepts
the other administrator's version. A change to a different template advances
the revision without losing unrelated drafts.

## Template catalogue

| Template ID | Purpose |
| --- | --- |
| `compiler.compile.system` / `.user` | Compile one rule from an administrator statement and its conversation. |
| `compiler.split.system` / `.user` | Split a broad instruction before compiling its individual statements. |
| `analyzer.compliance.system` / `.user` | General instruction models using VIOLATES / COMPLIES / UNCLEAR. |
| `analyzer.choice.system` / `.user` | Experimental ORDINARY_REQUEST form, when selected explicitly. |
| `analyzer.dynaguard.system` / `.user` | DynaGuard's grammar-constrained PASS / FAIL form. |
| `analyzer.dynaguard-native.system` / `.user` | Experimental native PASS / FAIL form, when selected explicitly. |
| `analyzer.dynaguard.screen.user` | Optional multi-rule screening for the grammar-constrained form. |
| `analyzer.dynaguard-native.screen.user` | Optional multi-rule screening for the native form. |
| `analyzer.dynaguard.policy.v1` / `.v2` | The policy block supplied to DynaGuard; v2 is an explicit experimental option. |
| `analyzer.rewrite.system` / `.user` | A requested reformulation after a block; its result must pass the guard again. |

Showing an experimental template does not enable that feature. The optional
injection detector is a separate purpose and is not customized by this editor,
including when a benchmark configures it to borrow the adjudicator's weights.
Model compatibility probes and upstream assistant instructions are also separate
from the policy compiler and analyzer templates.

## Variables and fixed contracts

Variables use literal `{{name}}` syntax. The API and editor list the variables
accepted by each template and their meanings. For example, `{{message}}` supplies
the isolated request, `{{rule}}` the ratified rule, and `{{isolation}}` the
instructions matching that request's generated nonce. Conversation history,
audiences, examples, optional boundary clauses and model thinking markers are
supplied by their own variables rather than copied from a preview request.

Required variables must remain present even when their value can be empty for a
particular request. Unknown or malformed variables, null bytes and templates over
32,768 characters are rejected. Substitution is one literal pass: variable-like
text inside a rule, conversation or employee message is never evaluated as a
second template. There is no script execution, file access or network lookup in
the renderer. A custom rendered template is capped at 256,000 characters.

The response schemas, parsers, request isolation, policy ratification, rewrite
gates and verdict aggregation are controlled by code. Editing a prompt cannot
change those contracts. Invalid analyzer output still fails closed. Saving a
template validates its structure, not the policy accuracy of the instructions:
an administrator can write a prompt that causes missed violations or false
positives. Existing measured results apply to the settings used for those runs.

## Storage and concurrent work

Customizations are stored in `prompts.json` beside `WARDEN_SETTINGS_PATH`, normally
`data/prompts.json`. `WARDEN_PROMPT_TEMPLATES_PATH` overrides that location. This
is different from `WARDEN_PROMPT_PATH`, which controls the separate retention of
masked employee request text in `prompts.jsonl`.

The versioned file is replaced atomically with mode `0600`; default values are
read from the shipped prompt builders. A reset removes an override. An unreadable
existing file is preserved and reported as an error, rather than silently
reverting to defaults. The file contains administrator-authored text in plaintext
and should be protected with the installation's other administrative state.

A compiler operation holds one immutable template snapshot across a policy split
and its compiled rules. An analysis holds one snapshot across screening, rules,
windows and repeated votes. Saved changes apply to subsequent work; a write
cannot change half of a running operation. Template content is not added to the
administrative audit log or employee decision stream.

## HTTP reference

All routes require the existing administrator authorization, including reads.
Loopback trust follows the installation's existing configuration; remote callers
must provide an exempt administrator key.

| Method and route | Request and result |
| --- | --- |
| `GET /api/prompts` | Returns the installation `revision` and `templates` catalogue. |
| `PUT /api/prompts/:id` | `{ "revision": "<read revision>", "template": "<full text>" }`; saves one template and returns the updated catalogue. |
| `POST /api/prompts/:id/reset` | `{ "revision": "<read revision>" }`; restores one shipped default and returns the updated catalogue. |

Each template includes its `id`, `role`, `name`, `description`, current `template`,
`defaultTemplate`, variable `tokens`, `outputContract`, and `active` / `custom`
status. Validation failures return HTTP 400, unknown IDs 404, revision conflicts
409, and unreadable stored configuration 503. Errors contain human-readable
`error` text and a stable `code`; variable errors identify missing or unknown
token names without returning the submitted template.

## Verification

`pnpm run test:prompts` checks the pre-editor default prompt bytes, required
context, literal substitution, persistence, restoration, authorization and
concurrent snapshots through actual prompt builders and HTTP handlers. Capture
adapters observe runtime requests without claiming model accuracy. The console
suite covers escaping, draft preservation, active formats and conflict handling;
rendered desktop and mobile workflows are checked separately.

The adjudicator bench includes the effective template hash in its cache key and
saved results, and pins one snapshot across the whole run. An edited prompt
cannot reuse answers produced by the previous template. Restoring identical
defaults can reuse that default's own results. Use repeated paired evaluation,
not a single successful save or completion, to assess a customization.

On 2026-09-08, an isolated real-QVAC check with `Qwen3-0.6B-Q4_0.gguf`
confirmed that saved compiler and analyzer templates reached the actual model
calls. A deliberately prescribed RuleDraft parsed in 3,901 ms and a prescribed
COMPLIES response parsed in 1,171 ms. Both overrides were reset and the temporary
installation was removed. These two synthetic completions establish plumbing
and format compatibility only; they do not establish whether a customization
judges policy well. [Recorded evidence](measurements/2026-09-08-prompt-runtime.json)
includes request hashes, model identity and the source files checked.
