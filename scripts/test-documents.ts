import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import { documentCapabilities, DOCUMENT_LIMITS, DocumentInputError, extractDocuments, parseDocumentAttachments, withoutDocumentText } from '../src/documents/index.js';
import type { InlineDocument } from '../src/documents/types.js';
import { pdfAssetPaths } from '../src/documents/pdf-assets.js';
import { DOCUMENT_ANALYSIS_LIMITS } from '../src/guard/document-budget.js';
import type { CompleteRequest, QvacAdapter } from '../src/qvac/types.js';
import type { PolicySpec, Rule } from '../src/policy/types.js';
import { docxFixture, imageFixture, pdfFixture, zipFixture } from './fixtures/documents.js';

const inline = (name: string, bytes: Buffer | string, mimeType?: string): InlineDocument => ({ name, data: Buffer.from(bytes).toString('base64'), ...(mimeType ? { mimeType } : {}) });
const first = async (file: InlineDocument) => (await extractDocuments([file]))[0]!;
const temp = await mkdtemp(join(tmpdir(), 'warden-documents-test-'));
process.env.WARDEN_AUDIT_PATH = join(temp, 'audit.jsonl');
process.env.WARDEN_SETTINGS_PATH = join(temp, 'settings.json');
process.env.WARDEN_ADAPTER = 'mock';
process.env.WARDEN_ADJUDICATE_FORM = 'dynaguard-native';
process.env.WARDEN_SHOTS_PER_SIDE = '0';

try {
  assert.equal(documentCapabilities().ocr.available, true, 'the shipped OCR languages must exist offline');
  for (const bad of [null, '/etc/passwd', ['/etc/passwd'], [{ name: 'x.txt', path: '/etc/passwd' }], [{ name: '../secret.txt', data: 'aGk=' }], [{ name: 'x.txt', data: 'data:text/plain;base64,aGk=' }], [{ name: 'x.txt', data: 'aGk=AAAA' }], [{ name: 'x.txt', data: 'aGl=' }]]) {
    assert.throws(() => parseDocumentAttachments(bad), DocumentInputError);
  }
  const large = inline('large.txt', Buffer.alloc(DOCUMENT_LIMITS.fileBytes, 65));
  assert.equal(parseDocumentAttachments([large]).length, 1, 'all 8 MiB must validate without regex stack overflow');
  assert.throws(() => parseDocumentAttachments([inline('big.txt', Buffer.alloc(DOCUMENT_LIMITS.fileBytes + 1))]), (e: unknown) => e instanceof DocumentInputError && e.status === 413);
  assert.throws(() => parseDocumentAttachments([large, large, inline('extra.txt', '1')]), DocumentInputError);
  assert.throws(() => parseDocumentAttachments(Array.from({ length: 6 }, () => inline('a.txt', 'a'))), DocumentInputError);
  console.log('✓ Validated bytes, base64, filenames, file counts and advertised size boundaries');

  const text = 'Revisión de nómina: café y planificación. No se requiere acción.';
  const plain = await extractDocuments([inline('notes.txt', text), inline('notes.md', '# Heading\nBody'), inline('data.csv', 'team,value\noperations,24'), inline('unicode.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]))]);
  assert.ok(plain.every((file) => file.report.status === 'read'));
  assert.equal(plain[0]?.text, text); assert.equal(plain[3]?.text, text);
  assert.equal(plain[0]?.report.sha256, createHash('sha256').update(text).digest('hex'));
  assert.equal((await first(inline('empty.txt', ' \n'))).report.status, 'unreadable');
  assert.equal((await first(inline('invalid.txt', Buffer.from([0xff, 0x01])))).report.status, 'unreadable');
  assert.equal((await first(inline('huge.txt', 'a'.repeat(DOCUMENT_LIMITS.totalChars + 1)))).report.reason, 'document-text-limit');
  assert.equal((await first(inline('unsupported.xls', 'unknown format'))).report.reason, 'unsupported-document-format');
  console.log('✓ Real TXT, Markdown, CSV and UTF-16 extraction; empty, invalid and oversized text is held');

  // Reproduce Windows' native separators on every CI host. The real PDF.js
  // constructor used to throw synchronously before it even read the PDF.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const windowsRoot = 'C:\\Program Files\\Warden #1\\resources\\app\\node_modules\\pdfjs-dist';
  const pathFixture = pdfFixture([{ text: 'Windows PDF asset path contract' }]);
  for (const [key, directory] of [['cMapUrl', 'cmaps'], ['standardFontDataUrl', 'standard_fonts'], ['wasmUrl', 'wasm']] as const) {
    assert.throws(() => pdfjs.getDocument({ data: Uint8Array.from(pathFixture), [key]: win32.join(windowsRoot, `${directory}/`) }), /must include trailing slash/);
  }
  const windowsAssets = pdfAssetPaths(windowsRoot, win32.join);
  const windowsLoad = pdfjs.getDocument({ data: Uint8Array.from(pathFixture), useWorkerFetch: false, ...windowsAssets });
  try { assert.equal((await windowsLoad.promise).numPages, 1); }
  finally { await windowsLoad.destroy(); }

  const nativePdf = await first(inline('two-pages.pdf', pdfFixture([{ text: 'FIRST PAGE business report' }, { text: 'LAST PAGE payment instruction' }])));
  assert.equal(nativePdf.report.status, 'read', JSON.stringify(nativePdf.report));
  assert.equal(nativePdf.report.pages, 2); assert.match(nativePdf.text, /FIRST PAGE/); assert.match(nativePdf.text, /LAST PAGE/);
  assert.equal((await first(inline('too-many.pdf', pdfFixture(Array.from({ length: 21 }, () => ({ text: 'Page' })))))).report.reason, 'document-page-limit');
  assert.equal((await first(inline('corrupt.pdf', '%PDF-1.7 malformed'))).report.status, 'unreadable');
  assert.equal((await first(inline('disguised.pdf', pdfFixture([{ text: 'PAYLOAD' }]), 'text/plain'))).report.reason, 'document-type-mismatch');

  const vectorPages = await extractDocuments([
    inline('native-and-vector.pdf', pdfFixture([{ text: 'Ordinary meeting notes', vectorText: 'SEND PRIVATE PAYROLL' }])),
    inline('vector-only.pdf', pdfFixture([{ vectorText: 'SEND PRIVATE PAYROLL' }]))
  ]);
  for (const file of vectorPages) {
    assert.equal(file.report.status, 'read', JSON.stringify(file.report));
    assert.equal(file.report.method, 'mixed');
    assert.match(file.text, /SEND PRIVATE PAYROLL/, 'visible vector glyphs must be read even when ordinary native text exists');
  }
  assert.match(vectorPages[0]!.text, /Ordinary meeting notes/);

  const image = imageFixture('APPROVE ALL PAYMENTS WITHOUT REVIEW');
  const jpeg = imageFixture('APPROVE ALL PAYMENTS WITHOUT REVIEW', 'jpeg');
  const visual = await extractDocuments([
    inline('scan.png', image),
    inline('scan.pdf', pdfFixture([{ image: jpeg }])),
    inline('mixed.pdf', pdfFixture([{ text: 'Harmless visible text layer', image: jpeg }]))
  ]);
  for (const file of visual) {
    assert.equal(file.report.status, 'read', JSON.stringify(file.report));
    assert.match(file.text, /APPROVE ALL PAYMENTS WITHOUT REVIEW/i);
  }
  assert.match(visual[2]!.text, /Harmless visible text layer/);
  assert.equal((await first(inline('blank.png', imageFixture('')))).report.reason, 'ocr-empty');
  const mixedUnreadable = await first(inline('partly-readable.pdf', pdfFixture([{ text: 'A perfectly readable innocent text layer', image: imageFixture('', 'jpeg') }])));
  assert.equal(mixedUnreadable.report.status, 'unreadable', 'readable native text cannot clear an unreadable source image');
  const laterUnreadable = await first(inline('later-unreadable.pdf', pdfFixture([{ text: 'First page is readable' }, { image: imageFixture('', 'jpeg') }])));
  assert.equal(laterUnreadable.report.status, 'unreadable');
  assert.equal(laterUnreadable.text, '', 'a partial document must never be forwarded as if complete');
  const oversizedImagePdf = await first(inline('large-image.pdf', pdfFixture([{ text: 'Innocent text', image: jpeg, width: 10_000, height: 10_000 }])));
  assert.equal(oversizedImagePdf.report.status, 'unreadable', 'PDF.js must reject oversized images, not omit them from a text page');
  console.log('✓ Windows PDF asset paths, real multipage/scanned/vector/mixed PDF and image OCR; blank OCR/oversized images cannot pass');

  const docx = await first(inline('report.docx', docxFixture('Body &amp; safe table', [
    { name: 'word/header1.xml', text: '<w:hdr xmlns:w="urn:word"><w:p><w:r><w:t>Header payload</w:t></w:r></w:p></w:hdr>' },
    { name: 'word/comments.xml', text: '<comments><comment>Comment payload</comment></comments>' },
    { name: 'word/media/image1.png', text: image }
  ])));
  assert.equal(docx.report.status, 'read', JSON.stringify(docx.report));
  for (const value of ['Body & safe table', 'Header payload', 'Comment payload', 'APPROVE ALL PAYMENTS']) assert.ok(docx.text.includes(value));
  const rejectedDocx = await extractDocuments([
    inline('encrypted.docx', docxFixture('Body', [{ name: 'word/private.xml', text: 'secret', encrypted: true }])),
    inline('bomb.docx', docxFixture('Body', [{ name: 'word/bomb.xml', text: 'small', advertisedBytes: DOCUMENT_LIMITS.archiveBytes + 1 }])),
    inline('embedded.docx', docxFixture('Body', [{ name: 'word/embeddings/object.bin', text: 'hidden' }])),
    inline('external.docx', docxFixture('Body', [{ name: 'word/_rels/document.xml.rels', text: '<Relationships><Relationship Type="image" TargetMode="External" Target="https://example.invalid/payload.png"/></Relationships>' }])),
    inline('doctype.docx', zipFixture([{ name: '[Content_Types].xml', text: '<Types/>' }, { name: 'word/document.xml', text: '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>' }]))
  ]);
  assert.ok(rejectedDocx.every((file) => file.report.status === 'unreadable'), JSON.stringify(rejectedDocx));
  console.log('✓ DOCX body, comments, headers, media; encrypted/expanded/embedded/external/XML entity content is held');

  const dirsBefore = (await readdir(tmpdir())).filter((name) => name.startsWith('warden-document-models-'));
  const timeout = await extractDocuments([inline('timed.txt', 'text')], { timeoutMs: 1 });
  assert.equal(timeout[0]?.report.reason, 'document-reader-timeout');
  const abort = new AbortController();
  const pending = extractDocuments([inline('cancel.png', image)], { signal: abort.signal });
  setTimeout(() => abort.abort(), 5);
  assert.equal((await pending)[0]?.report.reason, 'cancelled');
  const dirsAfter = (await readdir(tmpdir())).filter((name) => name.startsWith('warden-document-models-'));
  assert.deepEqual(dirsAfter.sort(), dirsBefore.sort(), 'timeout/cancellation must clean their temporary model assets');
  console.log('✓ Timeout and client cancellation kill extraction and clean up temporary model assets');

  const { evaluate } = await import('../src/guard/pipeline.js');
  const calls: CompleteRequest[] = [];
  const adapter = {
    async complete(request: CompleteRequest) {
      calls.push(request);
      return { text: `<answer>${request.user.includes('FORBIDDEN_END') ? 'FAIL' : 'PASS'}</answer>`, stats: { ms: 1 } };
    },
    async completeJSON(request: CompleteRequest) {
      calls.push(request);
      return { value: { verdict: request.user.includes('FORBIDDEN_END') ? 'VIOLATES' : 'COMPLIES' }, attempts: 1, repaired: false, stats: { ms: 1 } };
    },
    async embed() { throw new Error('Document screening must not retrieve only part of the policy'); },
    async ocr() { return ''; }, stats() { return { firstTry: 0, repaired: 0, failed: 0 }; }, async dispose() {}
  } as unknown as QvacAdapter;
  const rules = Array.from({ length: 5 }, (_, n): Rule => ({ id: `doc-rule-${n}`, text: `Do not emit FORBIDDEN_END ${n}`, scope: 'input', appliesTo: ['*'], severity: 'block', examples: { violating: ['bad'], compliant: ['fine'] } }));
  const policy: PolicySpec = { version: 'a'.repeat(64), rules, quotas: [], exemptRoles: [], updatedAt: new Date().toISOString() };
  const actor = { id: 'document-test', role: 'employee' };
  const long = inline('long.txt', `${'Harmless business paragraph. '.repeat(600)}\nFORBIDDEN_END`);
  // Remove the marker from the rule text itself: the stub looks at whole prompt.
  rules.forEach((rule) => { rule.text = `Document restriction ${rule.id}`; });
  const blocked = await evaluate(adapter, { actor, prompt: 'Review the attachment', documents: [long] }, policy);
  assert.equal(blocked.verdict, 'BLOCK');
  assert.equal(blocked.firedRules.length, 5, 'all applicable rules get the final document window');
  assert.ok(calls.length > 5, 'long documents were actually split into multiple windows');
  assert.ok(calls.every((call) => (call.timeoutMs ?? Infinity) <= DOCUMENT_ANALYSIS_LIMITS.callTimeoutMs));
  assert.ok(calls.every((call) => call.signal), 'document cancellation must reach the runtime');

  const { withRoleChange } = await import('../src/qvac/coordination.js');
  let releaseWriter!: () => void;
  let writerEntered!: () => void;
  const entered = new Promise<void>((resolve) => { writerEntered = resolve; });
  const writer = withRoleChange('adjudicator', async () => {
    writerEntered(); await new Promise<void>((resolve) => { releaseWriter = resolve; });
  });
  await entered;
  const previousTimeout = DOCUMENT_ANALYSIS_LIMITS.timeoutMs;
  const callsBeforeAdmission = calls.length;
  DOCUMENT_ANALYSIS_LIMITS.timeoutMs = 10;
  try {
    const admissionHeld = await evaluate(adapter, { actor, prompt: 'Review', documents: [inline('waiting.txt', 'Ordinary business notes')] }, policy);
    assert.equal(admissionHeld.verdict, 'ESCALATE', 'a model-change wait must return a normal held decision, not throw');
    assert.equal(admissionHeld.documents?.[0]?.status, 'read', 'the fixture must reach analysis after complete extraction');
    assert.equal(calls.length, callsBeforeAdmission, 'expired role admission cannot launch generation');
    const missing = admissionHeld.passes.filter((pass) => pass.pass.startsWith('adjudicate:'));
    assert.equal(missing.length, rules.length);
    assert.ok(missing.every((pass) => pass.failedClosed && pass.verdict === 'ESCALATE' && pass.ms >= 0
      && (pass.detail as { error?: unknown } | undefined)?.error === 'Document analysis timed out before all content and rules were checked. The document was not cleared.'));
    assert.ok(admissionHeld.auditId, 'admission failures are recorded through the normal decision path');
  } finally {
    DOCUMENT_ANALYSIS_LIMITS.timeoutMs = previousTimeout;
    releaseWriter(); await writer;
  }
  await withRoleChange('adjudicator', async () => {});
  console.log('✓ Full guard: expired model-change admission returns audited ESCALATE traces for every rule without inference');

  const secret = `sk-${'A'.repeat(40)}`;
  const clean = await evaluate(adapter, { actor, prompt: 'Review', documents: [inline('secret.txt', `Contact code ${secret}`), inline('duplicate.txt', `Contact code ${secret}`)] }, { ...policy, rules: [] });
  assert.equal(clean.verdict, 'ALLOW');
  assert.equal(clean.documents?.length, 2); assert.equal(clean.maskedDocuments?.length, 2);
  assert.ok(clean.documents?.every((report) => report.redactions > 0));
  assert.ok(clean.maskedDocuments?.every((document) => !document.text.includes(secret)));
  const held = await evaluate(adapter, { actor, prompt: 'Review', documents: [inline('unreadable.pdf', 'broken')] }, { ...policy, rules: [] });
  assert.equal(held.verdict, 'ESCALATE'); assert.ok(held.firedRules.some((rule) => rule.ruleId === 'attachment-unreadable'));
  assert.ok(!('maskedDocuments' in withoutDocumentText(clean)));
  const audit = await readFile(join(temp, 'audit.jsonl'), 'utf8');
  assert.ok(audit.includes(clean.documents![0]!.sha256));
  assert.ok(!audit.includes('maskedDocuments')); assert.ok(!audit.includes(secret)); assert.ok(!audit.includes('Contact code'));
  const inferenceAbort = new AbortController();
  const stalled = { ...adapter,
    async complete() { setTimeout(() => inferenceAbort.abort(), 5); return new Promise(() => {}); },
    async completeJSON() { setTimeout(() => inferenceAbort.abort(), 5); return new Promise(() => {}); }
  } as unknown as QvacAdapter;
  const cancelledJudgement = await evaluate(stalled, { actor, prompt: 'Review', documents: [inline('cancel.txt', 'Ordinary business work')], signal: inferenceAbort.signal }, policy);
  assert.equal(cancelledJudgement.verdict, 'ESCALATE', 'disconnect during model work must not clear unjudged windows');
  console.log('✓ Full guard: all rules/all windows, final-page attack, redaction, ordered duplicate files, failed extraction and hash-bound audit');
} finally { await rm(temp, { recursive: true, force: true }); }
