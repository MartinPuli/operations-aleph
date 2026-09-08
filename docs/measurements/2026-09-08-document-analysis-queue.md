# Document analysis queue: real-model diagnosis

The previous 25-second document analysis limit was reproduced with successful
OCR followed by unfinished rule checks. The replacement admission queue and
180-second analysis budget completed a larger, two-window PDF case and detected
a violation on its final page. These are different workloads, not a direct
speed comparison or an accuracy benchmark.

## Environment and isolation

Both runs used the existing `DynaGuard-8B.Q4_K_M.gguf` through QVAC on an Apple
M1 Pro, 16 GiB RAM, macOS kernel 25.5.0, arm64, Node v26.8.1. Model SHA-256:
`692a65b2e1cf5ddecdbbc67b1ace71e3a571173383e44c059d2b4d8e2fac05c3`.
This was a shared development machine, not an idle benchmark host.

The runner used temporary policy, settings, prompt-template, model-catalogue and
audit paths. It read existing model weights, generated synthetic inputs and
disposed its own model process afterward. It did not call the live gateway or
read employee documents. Warmup is reported separately from decision time.
The recorded source files were unchanged during each run; the JSON artifacts
identify the measured implementations by hashes. Those hashes, rather than a
later release revision, define the scope of these results.

After these measurements, the cancellation boundary was extended to include
waiting for an administrator's model change. Deterministic tests cover that
additional admission path and its normal audited `ESCALATE` result; the PDF pair
did not include a concurrent model change and was not repeated for that edit.

## Reproduced failure

The [previous compiled implementation](2026-09-08-document-analysis-before-24-rules.json)
ran one small image against 24 applicable rule entries: twelve synthetic
restrictions repeated under distinct IDs. It ran from 16:26:05 to 16:26:46 UTC;
warmup took 10,336 ms.

- OCR succeeded: one page, 112 extracted characters, 1,180 ms.
- The decision took 26,221 ms and returned `ESCALATE`.
- Sixteen rules completed. The remaining eight failed at 25,005–25,009 ms with
  `Document judgement was cancelled or timed out; remaining content was not cleared`.

The model calls completed mostly one after another despite the model's
`parallel: 4` setting. Queue waiting consumed the same 25-second budget as all
generations. This demonstrates an analysis timeout after successful OCR.

## Replacement queue: representative PDF pair

The [source implementation with document admission](2026-09-08-document-analysis-after-pdf-pair.json)
ran from 16:31:47 to 16:37:21 UTC. Warmup took 10,252 ms. Each generated PDF had
four pages, native headings and scanned body text. Eleven different synthetic
restrictions applied. The second PDF added an instruction to email private
payroll records outside the company at the end of page four.

| Case | Extracted characters | OCR/reading | Analysis | Total | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| Ordinary meeting notes | 9,658 | 13,379 ms | 129,205 ms | 142,607 ms | ALLOW |
| Final-page payroll instruction | 9,768 | 16,593 ms | 159,163 ms | 175,809 ms | BLOCK |

Analysis time is the longest adjudication trace, including queue and window
waits. Total time also includes the remaining guard passes.

Both reports retained `status: read`, `pages: 4` and `method: mixed`. Every one
of the eleven adjudication traces records two windows, establishing 22 completed
rule/window checks per case. Neither case has a failed or timed-out check. Only
the payroll restriction fired in the second case. A separate extraction-only
preflight also verified that the exact final-page instruction survived OCR.

The replacement preserves all applicable rules and overlapping 6,000-character
windows. It admits one document generation at a time, starts its individual
60-second budget on admission, and retains a 180-second overall analysis limit.
Unread or unchecked content still cannot produce `ALLOW`. Reading retains its
separate 45-second limit.

## Reproduction and limits

Run `scripts/measure-document-workload.ts <existing.gguf> <output.json>` with
`WARDEN_MEASURE_SCENARIO=pdf-pair WARDEN_MEASURE_RULES=11` for the PDF pair.
`WARDEN_MEASURE_RULES=24` selects the short image workload.
`WARDEN_MEASURE_COMPILED=1` uses an existing compiled build;
`WARDEN_MEASURE_EXTRACT_ONLY=1` checks the generated files without loading GGUF.
Reproducing the previous failure requires its recorded old implementation.

Each workload ran once. The PDFs contain repetitive, clearly printed synthetic
text, and the violation pair is a coverage check rather than an estimate of
model accuracy. Larger documents, more rules, other hardware or concurrent work
can still exceed the bounded budget. The measured PDF checks took roughly two
to three minutes; this change restores time to finish the checks and does not
establish faster inference. Cancellation and incomplete-content behavior have
separate deterministic regression coverage.
