# Contributing

Thanks for looking. Warden is a policy gate for AI assistants, and the thing
that makes it worth anything is that its claims are measured rather than
asserted. Most of what follows is about keeping that true.

## Getting set up

```bash
pnpm install
pnpm run setup                     # downloads and verifies configured models
pnpm run dev                       # gateway + console on http://localhost:8080
```

No GPU, no models, or a locked-down network? Everything runs against a
deterministic test double:

```bash
WARDEN_ADAPTER=mock pnpm run dev
```

Node 22.17+ and pnpm 11. Use Node 22 for CI parity and Node 24 for desktop
packaging, which has been verified locally. A local Node 26 Forge run exited
with status zero during Electron ZIP extraction without producing an app;
Node 24 completed the same packaging path. This is an observed packaging-tool
compatibility issue, not a statement that the gateway runtime rejects Node 26.
Always inspect the generated artifact as well as the command's exit code.

Read [`CLAUDE.md`](CLAUDE.md) before your first change — it is the short version
of how the codebase thinks.

## Before you open a pull request

```bash
pnpm run typecheck
pnpm test
pnpm run build
WARDEN_ADAPTER=mock pnpm run redteam -- --no-baseline   # the pipeline still runs
```

`pnpm test` runs the regression suites in temporary installations, with Warden
credentials and model overrides removed from the inherited environment. It uses
a stand-in for expensive judge inference. The document suite still exercises
real PDF/DOCX parsers and bundled offline OCR; model-management tests use real
HTTP connections and replace the expensive QVAC loader. Keep those boundaries
explicit when describing a result.

Targeted checks for the document/model console work are:

```bash
pnpm run test:documents
pnpm run test:hook-documents
pnpm run test:proxy-documents
pnpm run test:model-management
pnpm run test:prompts
pnpm run test:console
```

The console suite checks identity and state boundaries using DOM doubles. For
UI changes, also inspect the rendered desktop and mobile pages and exercise
real file selection, keyboard navigation, progress, failures and retries. The
[console verification matrix](docs/UI-MODELS-AND-DOCUMENTS.md#verification)
lists the required behaviors. A green parser test does not establish native
client attachment coverage or OCR's adversarial accuracy.

## If your change affects what the guard decides

This is the part that is different from most repositories, and it is not
optional.

**A single corpus run is not a result.** The false-positive side is n=16-18, and
two identical runs at temperature 0 have produced 44% and 31%. A change that
moves one or two prompts has not been measured, it has been observed once.

So: use the bench, which measures one message against one rule, runs both
variants over the identical cells, and reports a p-value on the disagreements.

```bash
pnpm run bench -- --a base --b <your-variant>
```

Then confirm on the pipeline:

```bash
pnpm run redteam -- --reps 3
```

Report **both columns or neither.** A guard that refuses everything stops 100%
of attacks and is worthless; the false-positive rate is what decides whether
anyone leaves it switched on. Every idea that lowered one of those numbers was
also capable of lowering it by quietly switching a rule off.

Add a row to [`docs/MEASUREMENTS.md`](docs/MEASUREMENTS.md) with the run behind
it — including if the answer was "no measured difference". That file records
failed ideas on purpose: the reason a thing did not work is worth more than the
thing.

**Security-relevant defaults do not change on an argument.** New levers ship off
with a note explaining what they are for and what would settle them. There are
several in the tree already; follow the pattern.

## Style

**Comments explain why, not what.** The house style is prose above the thing it
describes, recording the reasoning and especially what was tried before. A
comment restating the line under it is noise. A comment recording that a KV
cache key once caused a 100% false-positive rate is what stops the next person
re-adding it.

English everywhere — code, comments, docs, commit messages. Rule text and corpus
prompts are mixed Spanish and English because that is what real traffic in the
target deployment looks like.

**Commit messages are prose**, not bullet lists of files. Say what changed, why,
what you measured, and what you could not.

**Dependencies** need a reason that survives being written down. The HTTP and
guard core uses Express, Zod and QVAC. Document extraction adds narrowly scoped
PDF, image, XML, ZIP and offline OCR dependencies because reading an attachment
completely cannot be replaced by guessing at its bytes. Those parser/OCR
versions are pinned in `package.json` and `pnpm-lock.yaml`. Their purposes and
verified licenses are in [third-party notices](THIRD_PARTY_NOTICES.md).

Before upgrading PDF.js, run the partial-operator-stream regression documented
in [document screening](docs/DOCUMENTS.md). A successful render can still omit a
failed source image; Warden's adapter deliberately watches the pinned parser's
completion boundary. Before adding a dependency or redistributing weights,
record its source and license and retain upstream license/notice files.

## Where document and model changes belong

- `src/documents/` validates inline bytes, runs bounded extraction in a separate
  process, and produces sanitized metadata. It does not decide policy.
- `src/proxy/content.ts` normalizes supported conversation content before
  inspection and reconstructs forwarding from the matching sanitized results.
  Unknown content is refused; never forward an uninspected original field.
- `integrations/warden-hook.mjs` reads only explicit host-provided attachment
  bytes or paths on the employee's machine. Do not infer paths from prose or
  claim host coverage from a synthetic hook event.
- `src/models/` owns the per-installation catalogue, transfers, compatibility
  tests and role changes. `src/qvac/` remains the only QVAC SDK boundary.
  Analyzer data must stay local even when compilation uses an endpoint.
- `web/js/` contains one native module per screen or shared concern. Public form
  state can survive a render; password and file inputs never enter snapshots.
  A selected employee identity must never be replaced with a saved admin key.

See [model management](docs/MODEL-MANAGEMENT.md) for lease and rollback behavior.
A new role, format or input path must preserve the verdict ordering and include
failure tests: truncated input, failed extraction, unknown content, stale test
results, unavailable weights, and concurrent decisions must not become ALLOW.

## Adding to the red-team corpus

New attacks are welcome and are one of the most useful contributions available.
A prompt goes in [`src/redteam/corpus/`](src/redteam/corpus/) with an `expect`
of `BLOCK`, `ESCALATE` or `ALLOW`.

Two things to know. Adding prompts moves the denominators, so rows in
`MEASUREMENTS.md` from before your change cannot be compared to rows after it —
say so in the commit. And **benign controls are worth more than attacks**: the
corpus needs legitimate work that superficially resembles an attack far more
than it needs another jailbreak, because that is the side the project is
currently losing on.

## Security

Do not open a public issue for something exploitable. See
[`SECURITY.md`](SECURITY.md), which also documents what Warden deliberately does
not defend against — worth reading before reporting one of those as a bug.

## Licence

Apache 2.0. By contributing you agree your work ships under it.
