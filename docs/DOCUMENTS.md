# Document screening

Warden screens attached document contents alongside the employee's message. The
reader runs on the gateway, including OCR. It is independent of the compiler
provider and the guard's QVAC/llama.cpp backend; it does not require the old,
unavailable `OCR_LATIN` model.

## Supported input

| Format | What is read |
| --- | --- |
| TXT, Markdown, CSV | Complete UTF-8 text; UTF-16 LE/BE with a byte-order mark. Invalid encodings and binary text are held. |
| PDF | Native text on every page, annotations and form values; source images and scanned/mixed pages through OCR. |
| DOCX | Body, tables, headers, footers, notes, comments, other XML text and drawing alt text; embedded document images through OCR. |
| PNG, JPEG, WebP, BMP | Offline English and Spanish OCR. Animated inputs are held. |

PDF and DOCX are parsed as documents, not passed as bytes to a language model.
PDF source images are read at their native resolution as well as in the rendered
page. This prevents a clear native text layer from making an unreadable, small,
covered or clipped image appear successfully screened.

OCR remains recognition, not a guarantee of perfect transcription. Empty OCR or
mean recognition confidence below 35 is held. This includes pictures and logos
with no recognizable text: a readable paragraph elsewhere does not waive an
unreadable image. Handwriting, unsupported scripts, complex image masks and poor
scans can require a text version. Unsupported input is reported as unreadable;
Warden does not silently remove the unsupported part and approve the rest.

## Public API

`POST /api/guard/check` accepts the existing employee credential and:

```json
{
  "prompt": "Review the attached report",
  "attachments": [
    {
      "name": "report.txt",
      "mimeType": "text/plain",
      "data": "UXVhcnRlcmx5IHJlcG9ydA=="
    }
  ]
}
```

`data` is canonical base64, without a `data:` prefix. `mimeType` is optional and
is inferred from the extension when absent. Paths, URLs, file IDs, unknown object
fields and path-like names are rejected. An employee's file path is never opened
on the gateway. The trusted local red-team harness retains its older internal
`GuardInput.attachments: string[]` interface; the HTTP API does not expose it.

`GET /api/documents/capabilities` reports formats, limits and whether the packaged
OCR language assets are installed. File-only requests are supported. Invalid
attachment structure returns JSON with HTTP 400; byte/count limits return 413.
Validly submitted files that cannot be completely read produce a normal
`ESCALATE` decision, or a stricter `BLOCK` if a policy violation was also found.

Decisions contain ordered `documents` reports:

```json
{
  "name": "report.txt",
  "mimeType": "text/plain",
  "sha256": "64-character SHA-256 of the complete original bytes",
  "bytes": 16,
  "status": "read",
  "pages": 1,
  "chars": 16,
  "method": "text",
  "redactions": 0
}
```

Unreadable reports include a stable `reason`, such as `encrypted-document`,
`ocr-empty`, `document-text-limit` or `document-reader-timeout`. Parser exception
messages and document-controlled paths do not enter these reports. `redactions`
counts masked secrets in the display name and extracted text.

The proxy replaces original attachments with the screened, masked text before
forwarding. It uses transient internal `maskedDocuments`, in original input order
including duplicates. That field is removed from HTTP guard replies, SSE events
and the audit log. A prompt-submit hook cannot replace a file that its host tool
already owns, so the hook holds an attachment whose report requires redaction.

The chat proxy accepts bounded standard generation settings, function tool
definitions/calls, legacy functions and JSON response schemas. Descriptions,
schemas and decoded function arguments join the inspected content and are
masked before forwarding. Tool call references retain their relationship
through local aliases. Unknown request fields and unsupported tool protocols
return HTTP 400. When output policies apply, every returned choice and function
argument is inspected before any answer is released. Unsupported output parts
and token log probabilities return HTTP 502; provider extension fields are not
returned as unchecked content.

## Resource and completeness limits

| Limit | Value |
| --- | --- |
| Attachments per request | 5 |
| Original bytes per file | 8 MiB |
| Original bytes per request | 16 MiB |
| PDF pages per file | 20 |
| Distinct PDF images / DOCX images per file | 20 |
| Extracted characters per request | 120,000 |
| Decoded image / rendered page | 12 million pixels |
| DOCX archive entries | 512 |
| DOCX expanded data | 32 MiB total, 8 MiB per entry |
| Reader processes | 2 concurrently |
| Extraction time | 45 seconds per request |
| Document model judgement | 25 seconds across all windows and rules |

DOCX, TXT and other flowing text do not have stable page layout; their report's
single text unit is not a claim about printed page count. The character limit
governs these formats. Large requests are held instead of truncated or summarized.
Hooks need at least 75 seconds for the combined extraction and judgement limits;
normal text-only requests keep their existing timeout.

Every applicable input rule is checked for documents. Long text is divided into
overlapping 6,000-character windows with 500 characters repeated at each boundary.
Every window must be cleared. A violation can stop a rule's remaining windows;
an unread window, failed model call or exhausted deadline cannot produce ALLOW.
Whole-policy shortcut screening is disabled for document requests. Model calls
receive the remaining deadline; an outer deadline also covers a cold model load.
Runtime model loading may finish after a cancelled request, but that late work
cannot approve or forward the request.

Each batch runs in a separate process with a 512 MiB JavaScript heap limit. A
timeout or disconnected client kills the process and its OCR threads. File bytes
stay in memory. A temporary private directory contains only copies of the trusted
OCR language assets, and the parent removes it after success, failure or
cancellation. The parser is a fault-isolation process, not an OS security sandbox;
native libraries are still part of the application's trusted dependencies.

DOCX archive sizes are checked before and during decompression, with filename,
duplicate-entry and CRC checks. XML document types/entities, macros, embedded
documents and external content references are held. Hyperlink target text is
screened but never fetched. Encrypted PDFs, JavaScript actions, embedded files,
XFA and optional PDF layers are held. Incomplete PDF recovery warnings are held.

PDF.js 6.3.289 has a failure-path issue where `getOperatorList()` and `render()`
can resolve partial output before their underlying operator stream rejects.
Warden monitors that stream's completion as well. This is a narrow adapter to the
pinned version's internals; if that interface changes, extraction fails closed.
The test suite includes the actual reproducer: a text page whose oversized image
would otherwise disappear silently. Re-run this test before upgrading PDF.js.

## Privacy and audit

Original files and extracted document text are not saved in the audit log, prompt
retention store or live event stream. Each report's complete-byte digest, sanitized
name, size, extraction status and redaction count are included in the hashed audit
decision. Two requests with identical prompt text but different files therefore
have different document evidence. Existing prompt text retention is unchanged.

OCR uses the installed `@tesseract.js-data/eng` and `spa` assets with an explicit
local language directory and cache disabled. PDF CMaps, fonts and WebAssembly
files resolve from the installed PDF.js package. There is no download fallback,
document URL fetch, remote OCR provider or compiler-provider call on this path.

## Verification and upstream documentation

Run `pnpm run test:documents` and the project's typecheck/build. The suite creates
valid PDF, DOCX and image fixtures in memory and runs the real extraction process,
including OCR. It covers mixed/readable/unreadable source parts, all-rule window
coverage, late document attacks, secret masking, duplicate document order, digest
binding, timeouts, cancellation and cleanup. It does not claim an adversarial
accuracy benchmark for OCR or the selected guard model.

`node dist/documents/smoke.js` checks compiled extraction with a real native PDF
and an image requiring actual offline OCR. Desktop smoke mode invokes that same
check from the packaged app, so it also tests child extraction using Electron's
executable and the dependencies and language assets left after Forge pruning.

- [PDF.js Node rendering example](https://github.com/mozilla/pdf.js/blob/master/examples/node/pdf2png/pdf2png.mjs)
- [PDF.js source and API](https://github.com/mozilla/pdf.js)
- [Tesseract.js worker, local language paths and termination](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)
- [Official distributable Tesseract language assets](https://github.com/naptha/tessdata/blob/gh-pages/README.md)
- [yauzl lazy archive reading and size validation](https://github.com/thejoshwolfe/yauzl)
- [Saxes XML parser](https://github.com/lddubeau/saxes)
