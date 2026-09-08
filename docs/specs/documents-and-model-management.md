# Documents and model management

This work extends the existing Apache-2.0 application. The administrator can
inspect and change both inference roles, keep a library of compatible models,
and govern documents supplied with employee requests. The existing visual
identity and local judging boundary remain authoritative.

## Delivery requirements

| Requirement | Evidence required before release |
| --- | --- |
| PDF, DOCX, text and image attachments reach the guard | Real extraction fixtures and HTTP integration tests |
| Scanned and mixed-content PDFs are inspected locally | Offline OCR tests, including a page containing both selectable text and an image |
| Unsupported, unreadable, oversized and partially extracted documents cannot pass unseen | Failure-path and no-upstream-forwarding assertions |
| The proxy screens structured content and forwards only inspected, masked text | Captured upstream payloads with documents in earlier conversation turns |
| Hooks transmit explicitly supplied files and preserve refusals | Child-process hook and OpenCode contract tests |
| Both model roles are visible and configurable in personal and team installations | Browser interaction checks at desktop and narrow widths |
| Compatible custom local models and compiler endpoints can be saved, tested and selected | Persistence, compatibility, credential-redaction and activation tests |
| Model changes affect the running process and respect requests already in progress | Concurrent-operation and actual-adapter-selection tests |
| Remote administrators can import models without arbitrary filesystem access | Streaming upload and authorization tests |
| Downloads report progress, support cancellation and avoid partial activation | Transfer failure and cancellation tests |
| Modules, public contracts, dependency rationale and limitations are documented | Contributor and feature documentation review |
| Existing behavior is preserved | Existing regression scripts, typecheck, production build and corpus runs |
| The release is on main with downloadable installers | Remote main SHA, successful release workflow and published asset inspection |

## Boundaries

Settings belong to one gateway installation. Administrators of that installation
share the same library and active roles; this does not introduce a hosted
multi-tenant service. Compiler endpoints may leave the machine as before.
Judging and document extraction stay local. Importing weights does not certify
their policy accuracy or train a model.

Only file bytes actually delivered by an integration can be inspected. A hook
whose upstream event exposes prompt text alone cannot claim coverage of hidden
attachments. The integration documentation must distinguish observed payload
contracts and boundary tests from a real client session.

## Verification record

Implementation and release evidence is recorded in `docs/MEASUREMENTS.md` and
the feature documentation. A passing mock suite proves routing and failure
behavior, not model accuracy. Real-model observations must identify the model,
machine, corpus and repetitions rather than borrowing mock results.
