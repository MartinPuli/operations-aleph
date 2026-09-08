# Models and documents in the console

The console keeps Warden's existing white reading surface, charcoal controls,
and amber held-request state. Models is a top-level destination in both solo and
team installations. The compiler and analyzer are presented together because
an administrator needs to distinguish the model writing policy from the model
checking employee content.

## Models

Open **Models** (`#/models`). The first two rows show the runtime model and where
it operates. **Change** opens an editor directly below that row; it does not
replace the current model merely by opening or changing a field. **Runtime
details** contains worker errors and the model inventory. Existing `#/compiler`
links open the same Models surface with the compiler editor expanded.

- **Compiler:** choose local weights, a supported provider, or an installed CLI.
  Provider defaults populate the endpoint and model fields. **Test connection**
  checks an endpoint or installed CLI. **Apply compiler** updates the selection for new drafts.
- **Analyzer:** choose a built-in model. Missing weights are explicitly marked;
  a saved download preference is distinct from the model currently running.
  The desktop download action is offered only when its shell can perform it.
- **Your models:** save a named API connection or import GGUF weights. Every
  offered role needs a successful compatibility test before **Use as compiler**
  or **Use as analyzer** becomes available. Failed re-tests refresh the gate.
  An assigned model must be replaced before it can be edited or removed.
- **GGUF imports:** upload from the browser, use a path already on the gateway
  when administering from loopback, or download from a direct HTTPS URL.
  Uploads show an in-progress state and can be cancelled. Downloads have progress
  and cancellation controls and are re-read when the page is opened again.
- **Environment overrides:** the current runtime value and override are visible.
  A custom-model activation is disabled for an overridden role. Built-in saved
  preferences may be edited but do not claim to replace the environment.

These settings belong to the gateway installation. They are shared by its
administrators; this screen does not create private, per-user model tenants.
API endpoints are offered for compilation only. The analyzer remains local.
Compatibility tests establish that a model can answer the required interface;
they are not a measurement of policy accuracy.

## Prompts

Each model role has **Edit prompts** alongside **Change model**. The compiler
opens its rule-compilation instructions; the analyzer opens the active format's
single-rule message template. A selector exposes the other system, request,
policy, optional screening and rewrite templates without activating a different
format. Default/custom and current-configuration status remain separate.

The editor holds the full template, explains and inserts its required variables,
and offers read-only references for the original template and response contract.
**Save prompt** applies a valid draft to new work. **Restore default** requires
an inline confirmation for that template. Conflicting edits show the newer
saved text and preserve the local draft for explicit comparison and resolution.

Drafts survive navigation and refresh in the same browser tab; they are never
persisted to browser storage. A focused textarea keeps its selection through
rendering. Status and validation messages are announced, required fields are
labelled, and the editor remains usable at narrow widths. See
[prompt management](PROMPT-MANAGEMENT.md) for complete operation and API details.

## Documents

Open the Simulator (`#/simulator`) or choose **Try a document** on Models. Select
a non-exempt identity, type a request if needed, and use **Attach files** or drag
files onto the attachment area. A document-only check is supported. Files can
be removed individually before **Check request** is pressed.

The console reads supported formats and byte/count limits from
`GET /api/documents/capabilities`; its fallback matches the server's documented
limits. Preparation rejects unsupported, duplicate, empty, oversized, and
excess-count files with an explanation. A file marked **Ready to check** has
only been prepared in the browser; it has not yet passed extraction or policy.

The request carries complete file bytes as base64. Files are not uploaded to a
separate permanent store. Warden's response shows each document's reading
status, byte size, page count, extracted character count, method, and any
redactions. Unreadable documents get a recovery sentence and a held decision,
never an implied success. Activity includes the same metadata and the document
hash in its technical record. The browser transcript keeps only attachment
metadata after a successful check; original bytes are removed from the pending
composer. Failed requests leave files available to retry.

An empty installation asks the administrator to set up an identity instead of
silently checking with its own privileged key. The Simulator deliberately uses
the selected person's API key, even when an administrator key is stored. Its
rewrite action is omitted for document requests because rewriting only the
prompt cannot establish that the attachment has been corrected.

## Module boundaries

The console remains native JavaScript modules with no framework or build step.

| Module | Responsibility |
| --- | --- |
| `web/js/models.js` | Model role overview, built-in analyzer selection, lifecycle |
| `web/js/compiler.js` | Reusable compiler form and rule-composer picker |
| `web/js/model-library.js` | Saved connections, imports, compatibility tests, activation |
| `web/js/engine.js` | Runtime diagnostics and desktop download action |
| `web/js/documents.js` | Transient attachment preparation and reusable reading metadata |
| `web/js/form-state.js` | Safe preservation of public form values during rendering |
| `web/js/simulator.js` | Identity-bound request submission and verdict conversation |
| `web/js/activity.js` | Audit presentation, including document metadata and hashes |

Password and file inputs never enter a saved form snapshot. New compiler keys
that pass a connection test may remain in module memory for that edit, bound to
the tested provider and endpoint; they are never put back in the input. Changing
the host, closing the editor, leaving Models, or applying the compiler clears
that staged key. Saved server keys are represented by presence only. Background
audit events update navigation without replacing active model forms or file
pickers.

Native buttons, form labels, fieldsets, inline errors, live status messages,
visible focus, reduced-motion support, and wrapping layouts carry the
interaction. Long names and endpoints wrap rather than widening the page. The
team navigation scrolls horizontally within its own row on narrow screens.

## Verification

Run `node --test scripts/test-console.mjs` for console boundary tests. They cover
identity precedence and retry behavior, protected form fields, caret/checkbox
restoration, stale provider options, document escaping and reading status,
role-specific test gates, and assigned-model editing/removal restrictions.
These tests use small DOM doubles; they do not replace browser verification.

The browser verification matrix includes desktop and mobile:

1. Open Models from both solo and team navigation; read actual and configured
   selections, then expand each role editor using the keyboard.
2. Test/apply a compiler, change provider defaults, check a failed connection,
   and confirm that a password never reappears after a render.
3. Save an endpoint with a long name, test it, apply it, replace it, edit it,
   remove its key, and remove the saved connection. Repeat a failing test after
   a passing one and verify that activation becomes unavailable.
4. Inspect installed/missing built-in analyzers, an environment override, and
   unavailable runtime states without describing a pending model as running.
5. Import GGUF by upload, local gateway path, and HTTPS URL; exercise invalid
   headers, import failures, download progress, cancellation and removal.
6. Check text plus a document and a document-only request; remove a prepared
   file, reject a duplicate/unsupported/oversized file, retry a failed request,
   and inspect unreadable-document feedback and Activity metadata.
7. Confirm no page overflow at phone width, names wrap, focused controls remain
   visible, and a new audit event does not erase a partially filled form.

### Observed browser verification

On 2026-09-08 the working console was checked at 1440-pixel desktop and
390-pixel mobile widths. The walkthrough reported no page horizontal overflow
or browser console errors. It exercised endpoint save, test, activation,
replacement, editing and deletion; a document-only TXT check returned Allowed;
a corrupt PDF returned Held; an invalid GGUF upload displayed import feedback.
These observations establish those UI flows, not the accuracy of a real guard
model. Local screenshots are generated artifacts under `output/playwright/`.
