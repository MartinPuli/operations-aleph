# Configure the compiler

New Warden installations start with **Claude Code on this machine** selected.
The compiler writes draft rules from administrator instructions. The analyzer
continues to check employee requests and documents with local QVAC weights.

## First configuration

1. Open **Configure Claude Code** in the console, or open **Models**. The
   compiler configuration opens automatically while setup is incomplete.
2. Install the Claude Code CLI on the computer running the Warden gateway.
   Follow the [official installation guide](https://code.claude.com/docs/en/setup).
   Installing it on a remote administrator's browser computer is not enough.
3. Sign in on that same computer with `claude auth login`. Authentication stays
   in Claude Code; Warden does not ask for or copy a login token. See the
   [official CLI reference](https://code.claude.com/docs/en/cli-reference).
4. Choose **Test connection**. Warden sends a fixed, synthetic question through
   the same CLI adapter used for compilation and validates its structured
   answer. This uses the account and usage limits configured in Claude Code.
5. Choose **Apply compiler** to save the connection. Warden checks it again
   before replacing the previous configuration.

Leave **Model** blank to use Claude Code's own default. Enter an alias or model
identifier only when you want to override it. A model selected in Warden does
not change the default in your interactive Claude Code sessions.

The setup notice appears in both solo and team mode. You can navigate the
console and retain draft text while setting up. Real rule compilation asks you
to finish configuration first. It does not silently switch to a different
compiler when Claude Code is missing or unavailable. You can explicitly choose
local weights, another supported installed CLI, or a compatible API endpoint
from the same Models screen.

## Existing installations and privacy

Existing saved compiler selections remain unchanged. Explicit compiler
environment overrides take precedence. The initial Claude preference applies
only when no compiler has been configured; it does not migrate an existing
local compiler or overwrite an API connection. A fresh demo continues to use
the mock adapter and does not invoke Claude Code implicitly.

Running the CLI on the gateway does not mean the model runs locally. Normal
compilation sends the administrator's instruction, role names and employee
roster to the CLI's configured provider. The form offers name redaction.
Employee requests and documents are analyzed locally and are not compiler
input. See [the data boundary](../SECURITY.md).

Installation detection is not proof of authentication, and authentication is
not proof that a particular model can answer. Warden reports these separately.
The bounded authentication probe exposes status only, without account email,
organization details, credentials, or raw command output. An older CLI with an
unrecognized status response can still be checked using **Test connection**.

## API

These routes require the existing administrator authorization:

- `GET /api/settings/compiler` includes `setupRequired` and `claude` status
  alongside the saved provider, model, environment override and CLI inventory.
  `claude.auth` is `signed-in`, `signed-out`, `unknown`, or `unavailable`.
  `claude.status` is `ready`, `sign-in-required`, `install-required`, or `unknown`.
  Add `?refresh=1` to bypass the short status cache. `configurationError` reports
  an invalid explicit environment setting; such a setting cannot silently use
  the initial Claude preference or another compiler.
- `POST /api/settings/compiler/test` accepts
  `{ "provider": "claude-cli", "model": "" }` and checks a structured response
  without saving a selection. Failure returns a sanitized actionable error.
- `PUT /api/settings/compiler` accepts the existing compiler settings object.
  A Claude selection must pass the connection check before it is saved.

The settings remain installation-wide and are written atomically. Failed tests
leave the saved connection intact. Runtime compiler changes retain the existing
role lease, so work already in progress finishes before a selection changes.
Prompt templates remain separate and survive compiler changes; see
[prompt management](PROMPT-MANAGEMENT.md).

A real draft attempted before setup returns HTTP 409 with
`kind: "compiler-setup-required"`. The console offers configuration instead of
asking the administrator to rephrase the instruction. Existing text is retained.

## Verification limits

`pnpm run test:compiler-setup` uses temporary settings and controlled CLI processes to cover new setup,
preserved selections, environment precedence, missing installation, signed-out
and unknown authentication, failed generation, validated saving and the local
analysis boundary. Console checks cover the setup notice, model selection,
testing and applying, error states and navigation.

A real check on the development machine on 2026-09-08 found Claude Code 2.1.260
installed and reported a signed-out session. This verifies real status detection,
not a successful authenticated completion. Connection testing is not a policy
accuracy evaluation.
