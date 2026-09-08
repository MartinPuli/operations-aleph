/** Runs only inside a disposable parser process. No document-controlled path or URL is opened. */
import { copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { crc32 } from 'node:zlib';
import { imageSize } from 'image-size';
import { SaxesParser } from 'saxes';
import { fromBuffer } from 'yauzl';
import type { Entry, ZipFile } from 'yauzl';
import { DOCUMENT_LIMITS, DocumentReadError } from './types.js';
import type { DocumentBytes, DocumentMethod, ExtractedDocument } from './types.js';

const require = createRequire(import.meta.url);
const textTypes = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/csv']);
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/x-ms-bmp']);
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
type ReadResult = { text: string; pages: number; method: DocumentMethod };

function fail(code: string): never { throw new DocumentReadError(code); }
function boundedText(text: string): string {
  if (text.length > DOCUMENT_LIMITS.totalChars) fail('document-text-limit');
  return text;
}

/** Strict text decoding: replacement characters cannot silently stand in for unread bytes. */
function decodeText(bytes: Buffer): string {
  let text: string;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2));
  else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2));
  else text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) fail('invalid-text-encoding');
  return text;
}

class OfflineOcr {
  private worker?: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
  constructor(private readonly assetDir: string) {}

  async recognize(bytes: Buffer, allowEmpty = false): Promise<string> {
    if (!this.worker) {
      // Tesseract's default downloads languages. Explicit local paths plus no cache
      // mean missing assets throw; neither network nor old user data is a fallback.
      for (const lang of ['eng', 'spa']) {
        const source = require.resolve(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`);
        await copyFile(source, join(this.assetDir, `${lang}.traineddata.gz`));
      }
      const { createWorker, OEM, PSM } = await import('tesseract.js');
      this.worker = await createWorker('eng+spa', OEM.LSTM_ONLY, {
        langPath: this.assetDir,
        workerPath: require.resolve('tesseract.js/src/worker-script/node/index.js'),
        corePath: dirname(createRequire(require.resolve('tesseract.js')).resolve('tesseract.js-core/package.json')),
        cacheMethod: 'none', gzip: true,
        errorHandler: () => { /* The worker promise rejects; parent holds the document. */ }
      });
      await this.worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, user_defined_dpi: '144' });
    }
    const { data } = await this.worker.recognize(bytes, {}, { text: true, blocks: true });
    const text = boundedText(data.text.trim());
    if (!allowEmpty && !text) fail('ocr-empty');
    if (text && (!Number.isFinite(data.confidence) || data.confidence < 35)) fail('ocr-low-confidence');
    return text;
  }

  async close() { await this.worker?.terminate(); }
}

function assertImage(bytes: Buffer): void {
  let dimensions: ReturnType<typeof imageSize>;
  try { dimensions = imageSize(bytes); } catch { fail('invalid-image'); }
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > DOCUMENT_LIMITS.imagePixels) fail('image-pixel-limit');
  if (!['png', 'jpg', 'webp', 'bmp'].includes(dimensions.type ?? '')) fail('unsupported-image-format');
  // Animated inputs must not be reduced to their first frame.
  if (dimensions.type === 'png') {
    let at = 8;
    while (at + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(at);
      if (at + 12 + length > bytes.length) fail('invalid-image');
      if (bytes.toString('ascii', at + 4, at + 8) === 'acTL') fail('animated-image-unsupported');
      at += length + 12;
    }
  }
  if (dimensions.type === 'webp' && bytes.toString('ascii', 12, 16) === 'VP8X' && ((bytes[20] ?? 0) & 2)) fail('animated-image-unsupported');
}

async function readPdf(bytes: Buffer, ocr: OfflineOcr): Promise<ReadResult> {
  if (bytes.subarray(0, 1024).indexOf('%PDF-') < 0) fail('invalid-pdf');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let warned = false;
  const oldLog = console.log;
  const oldWarn = console.warn;
  // Certain malformed PDF objects are skipped with a warning even under
  // stopAtErrors. A recovered/partial parse is not complete screening evidence.
  console.log = (...args: unknown[]) => { if (typeof args[0] === 'string' && args[0].startsWith('Warning:')) warned = true; };
  console.warn = () => { warned = true; };
  const packageRoot = dirname(require.resolve('pdfjs-dist/package.json'));
  const loading = pdfjs.getDocument({
    data: Uint8Array.from(bytes), useWorkerFetch: false,
    disableAutoFetch: true, stopAtErrors: true, enableXfa: false,
    maxImageSize: DOCUMENT_LIMITS.imagePixels,
    cMapUrl: join(packageRoot, 'cmaps/'), cMapPacked: true,
    standardFontDataUrl: join(packageRoot, 'standard_fonts/'),
    wasmUrl: join(packageRoot, 'wasm/'), verbosity: 1
  });
  try {
    const pdf = await loading.promise;
    const operatorChecks = monitorPdfOperatorErrors(pdf);
    if (pdf.numPages > DOCUMENT_LIMITS.pages) fail('document-page-limit');
    if (pdf.isPureXfa) fail('pdf-xfa-unsupported');
    const metadata = await pdf.getMetadata();
    if ((metadata.info as Record<string, unknown>).IsXFAPresent) fail('pdf-xfa-unsupported');
    const layers = await pdf.getOptionalContentConfig();
    if ([...layers].length) fail('pdf-layers-unsupported');
    if (Object.keys(await pdf.getAttachments() ?? {}).length) fail('embedded-document-unsupported');
    if (await pdf.hasJSActions()) fail('active-document-unsupported');
    const chunks: string[] = [];
    const imageTexts = new Map<string, string>();
    let imageCount = 0;
    let renderedPages = 0;
    const imageOps = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageMaskXObject, pdfjs.OPS.paintImageXObjectRepeat,
      pdfjs.OPS.paintImageMaskXObjectRepeat, pdfjs.OPS.paintInlineImageXObjectGroup,
      pdfjs.OPS.paintImageMaskXObjectGroup]);
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent({ disableNormalization: true });
      let text = content.items.map((item) => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join('').trim();
      const annotations = await page.getAnnotations();
      for (const annotation of annotations) {
        if (annotation.file || annotation.actions) fail('active-document-unsupported');
        // Comments and form values are document content too.
        for (const key of ['contents', 'fieldValue', 'url', 'unsafeUrl', 'title'] as const) {
          const value = annotation[key];
          if (typeof value === 'string') text += `\n${value}`;
          else if (Array.isArray(value)) text += `\n${value.filter((v): v is string => typeof v === 'string').join('\n')}`;
        }
        if (annotation.contentsObj?.str) text += `\n${annotation.contentsObj.str}`;
      }
      const operators = await page.getOperatorList();
      await Promise.all(operatorChecks);
      const hasImages = operators.fnArray.some((op) => imageOps.has(op));
      if (hasImages) {
        // Screen source image pixels as well as their appearance on the page.
        // Otherwise a clear native text layer could make page-level OCR look
        // successful while an embedded image was too small, clipped or covered.
        for (let index = 0; index < operators.fnArray.length; index++) {
          const op = operators.fnArray[index]!;
          if (!imageOps.has(op)) continue;
          const args = operators.argsArray[index] as unknown[];
          const key = typeof args[0] === 'string' ? args[0] : `${number}:inline:${index}`;
          if (!imageTexts.has(key)) {
            if (++imageCount > DOCUMENT_LIMITS.pages) fail('document-image-limit');
            let image: unknown = args[0];
            if (typeof image === 'string') {
              const id = image;
              const objects = id.startsWith('g_') ? page.commonObjs : page.objs;
              image = await new Promise((resolve) => objects.get(id, resolve));
            }
            if (op === pdfjs.OPS.paintImageMaskXObjectGroup) fail('pdf-image-format-unsupported');
            imageTexts.set(key, await ocr.recognize(await pdfImagePng(image)));
          }
          text += `\n${imageTexts.get(key)}`;
        }
      }
      // A mixed page is OCR'd even when native text exists. Never infer that a
      // text layer proves there is no payload inside an image on that page.
      if (hasImages || !text.trim()) {
        const viewport = page.getViewport({ scale: 2 });
        if (viewport.width * viewport.height > DOCUMENT_LIMITS.imagePixels) fail('image-pixel-limit');
        const { createCanvas } = await import('@napi-rs/canvas');
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        await page.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise;
        await Promise.all(operatorChecks);
        const recognized = await ocr.recognize(canvas.toBuffer('image/png'));
        text += `\n${recognized}`;
        renderedPages++;
        canvas.width = 1; canvas.height = 1;
      }
      if (!text.trim()) fail('empty-document-page');
      chunks.push(`[Page ${number}]\n${text.trim()}`);
      boundedText(chunks.join('\n\n'));
      page.cleanup();
    }
    if (warned) fail('partial-pdf-unsupported');
    return { text: chunks.join('\n\n'), pages: pdf.numPages, method: renderedPages ? 'mixed' : 'pdf' };
  } catch (error) {
    if (error instanceof DocumentReadError) throw error;
    if (error instanceof Error && error.name === 'PasswordException') fail('encrypted-document');
    fail('invalid-pdf');
  } finally {
    await loading.destroy();
    console.log = oldLog; console.warn = oldWarn;
  }
}

async function pdfImagePng(value: unknown): Promise<Buffer> {
  const image = value as { width?: number; height?: number; kind?: number; data?: Uint8Array | Uint8ClampedArray };
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width * height > DOCUMENT_LIMITS.imagePixels) fail('image-pixel-limit');
  if (!(image.data instanceof Uint8Array) && !(image.data instanceof Uint8ClampedArray)) fail('pdf-image-format-unsupported');
  const source = image.data;
  const pixels = new Uint8ClampedArray(width * height * 4);
  if (image.kind === 3 && source.length === pixels.length) pixels.set(source);
  else if (image.kind === 2 && source.length === width * height * 3) {
    for (let sourceAt = 0, at = 0; at < pixels.length; sourceAt += 3, at += 4) {
      pixels[at] = source[sourceAt]!; pixels[at + 1] = source[sourceAt + 1]!; pixels[at + 2] = source[sourceAt + 2]!; pixels[at + 3] = 255;
    }
  } else if ((image.kind === 1 || image.kind === undefined) && source.length === Math.ceil(width / 8) * height) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const shade = (source[y * Math.ceil(width / 8) + (x >> 3)]! & (128 >> (x % 8))) ? 255 : 0;
      const at = (y * width + x) * 4;
      pixels[at] = pixels[at + 1] = pixels[at + 2] = shade; pixels[at + 3] = 255;
    }
  } else fail('pdf-image-format-unsupported');
  const { createCanvas, ImageData } = await import('@napi-rs/canvas');
  const canvas = createCanvas(width, height);
  canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
  const png = canvas.toBuffer('image/png');
  canvas.width = 1; canvas.height = 1;
  return png;
}

/**
 * PDF.js 6.3.289 `_pumpOperatorList` marks `lastChunk` on a stream error before
 * rejecting its consumer. Both getOperatorList and render can resolve partial
 * output first. Monitor the source stream as well: its rejection is authoritative.
 * This narrow internal adapter is version-pinned and tested with a mixed page
 * whose oversized image otherwise disappears silently. A changed API holds the
 * document until this check has been updated, rather than dropping the check.
 */
function monitorPdfOperatorErrors(pdf: unknown): Promise<void>[] {
  type Handler = { sendWithStream: (name: string, ...args: unknown[]) => ReadableStream<unknown> };
  const handler = (pdf as { _transport?: { messageHandler?: Handler } })._transport?.messageHandler;
  if (!handler || typeof handler.sendWithStream !== 'function') fail('pdf-reader-integrity-unavailable');
  const original = handler.sendWithStream.bind(handler);
  const checks: Promise<void>[] = [];
  handler.sendWithStream = (name, ...args) => {
    const source = original(name, ...args);
    if (name !== 'GetOperatorList') return source;
    const [consumer, monitor] = source.tee();
    const checked = (async () => {
      const reader = monitor.getReader();
      try { while (!(await reader.read()).done) { /* Consume concurrently to observe the original stream's completion. */ } }
      finally { reader.releaseLock(); }
    })();
    checked.catch(() => {});
    checks.push(checked);
    return consumer;
  };
  return checks;
}

/** No XML entity expansion, no network resolution, and no ignored malformed XML. */
function readXml(bytes: Buffer, relationFile: boolean): string {
  const text = decodeText(bytes);
  const parser = new SaxesParser({ xmlns: true });
  const chunks: string[] = [];
  parser.on('doctype', () => fail('xml-doctype-unsupported'));
  parser.on('error', () => fail('invalid-docx-xml'));
  parser.on('text', (value) => { chunks.push(value); });
  parser.on('cdata', (value) => { chunks.push(value); });
  parser.on('opentag', (tag) => {
    if (tag.local === 'altChunk') fail('embedded-document-unsupported');
    const attrs = Object.values(tag.attributes);
    if (relationFile && tag.local === 'Relationship') {
      const attr = (name: string) => attrs.find((value) => value.local === name)?.value;
      const type = attr('Type') ?? '';
      if (/\/(aFChunk|oleObject|package|vbaProject|control)$/.test(type)) fail('embedded-document-unsupported');
      if (attr('TargetMode')?.toLowerCase() === 'external' || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(attr('Target') ?? '')) {
        if (!type.endsWith('/hyperlink')) fail('external-document-content');
        chunks.push(`\n${attr('Target') ?? ''}\n`);
      }
    }
    // Drawing alt text carries instructions just as visible paragraphs do.
    for (const attr of attrs) if (['descr', 'title'].includes(attr.local)) chunks.push(`\n${attr.value}\n`);
    if (['p', 'tr', 'br', 'tab'].includes(tag.local)) chunks.push('\n');
  });
  parser.write(text).close();
  return boundedText(chunks.join(''));
}

async function readArchive(bytes: Buffer): Promise<Map<string, Buffer>> {
  const zip = await new Promise<ZipFile>((resolve, reject) => fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, result) => error ? reject(error) : resolve(result)));
  const files = new Map<string, Buffer>();
  let entries = 0;
  let expectedBytes = 0;
  let actualBytes = 0;
  return new Promise((resolve, reject) => {
    const rejectArchive = (error: unknown) => { zip.close(); reject(error); };
    zip.on('error', rejectArchive);
    zip.on('end', () => resolve(files));
    zip.on('entry', (entry: Entry) => {
      void (async () => {
        if (++entries > DOCUMENT_LIMITS.archiveEntries) fail('archive-entry-limit');
        if (entry.generalPurposeBitFlag & 1) fail('encrypted-document');
        if (files.has(entry.fileName)) fail('ambiguous-archive');
        if ((expectedBytes += entry.uncompressedSize) > DOCUMENT_LIMITS.archiveBytes || entry.uncompressedSize > DOCUMENT_LIMITS.fileBytes) fail('archive-expansion-limit');
        if (entry.fileName.endsWith('/')) { zip.readEntry(); return; }
        if (/(?:^|\/)vbaProject\.bin$|^word\/(?:embeddings|activeX)\//i.test(entry.fileName)) fail('embedded-document-unsupported');
        const stream = await new Promise<import('node:stream').Readable>((res, rej) => zip.openReadStream(entry, (error, result) => error ? rej(error) : res(result)));
        const chunks: Buffer[] = [];
        let fileBytes = 0;
        for await (const chunk of stream) {
          const part = Buffer.from(chunk);
          fileBytes += part.length; actualBytes += part.length;
          if (fileBytes > DOCUMENT_LIMITS.fileBytes || actualBytes > DOCUMENT_LIMITS.archiveBytes) { stream.destroy(); fail('archive-expansion-limit'); }
          chunks.push(part);
        }
        const content = Buffer.concat(chunks);
        if (fileBytes !== entry.uncompressedSize || crc32(content) !== entry.crc32) fail('invalid-docx-archive');
        files.set(entry.fileName, content);
        zip.readEntry();
      })().catch(rejectArchive);
    });
    zip.readEntry();
  });
}

async function readDocx(bytes: Buffer, ocr: OfflineOcr): Promise<ReadResult> {
  const files = await readArchive(bytes);
  if (!files.has('[Content_Types].xml') || !files.has('word/document.xml')) fail('invalid-docx');
  const chunks: string[] = [];
  let images = 0;
  for (const [path, content] of files) {
    if (path.endsWith('.xml') || path.endsWith('.rels')) {
      const text = readXml(content, path.endsWith('.rels'));
      if (text.trim()) chunks.push(text.trim());
    } else if (path.startsWith('word/media/')) {
      if (++images > DOCUMENT_LIMITS.pages) fail('document-page-limit');
      assertImage(content);
      chunks.push(await ocr.recognize(content));
    } else if (!path.startsWith('word/fonts/') && !path.startsWith('docProps/thumbnail.')) {
      // Unknown binary parts may be embedded payloads; never approve them unseen.
      fail('embedded-document-unsupported');
    }
    boundedText(chunks.join('\n\n'));
  }
  const text = chunks.join('\n\n');
  if (!text.trim()) fail('empty-document');
  return { text, pages: 1, method: images ? 'mixed' : 'docx' };
}

async function readDocument(file: DocumentBytes, ocr: OfflineOcr): Promise<ReadResult> {
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if ((extension === 'pdf' && file.mimeType !== 'application/pdf') || (extension === 'docx' && file.mimeType !== DOCX)) fail('document-type-mismatch');
  if (file.bytes.subarray(0, 1024).indexOf('%PDF-') >= 0 && file.mimeType !== 'application/pdf') fail('document-type-mismatch');
  if (file.bytes.length >= 2 && file.bytes.readUInt16LE(0) === 0x4b50 && file.mimeType !== DOCX) fail('document-type-mismatch');
  if (textTypes.has(file.mimeType)) {
    const text = boundedText(decodeText(file.bytes));
    if (!text.trim()) fail('empty-document');
    return { text, pages: 1, method: 'text' };
  }
  if (file.mimeType === 'application/pdf') return readPdf(file.bytes, ocr);
  if (file.mimeType === DOCX) return readDocx(file.bytes, ocr);
  if (imageTypes.has(file.mimeType)) {
    assertImage(file.bytes);
    return { text: await ocr.recognize(file.bytes), pages: 1, method: 'ocr' };
  }
  fail('unsupported-document-format');
}

export async function extractBatch(files: DocumentBytes[], assetDir: string): Promise<ExtractedDocument[]> {
  const ocr = new OfflineOcr(assetDir);
  const results: ExtractedDocument[] = [];
  let chars = 0;
  try {
    for (const file of files) {
      const base = { name: file.name, mimeType: file.mimeType, sha256: file.sha256, bytes: file.bytes.length };
      try {
        const result = await readDocument(file, ocr);
        if ((chars += result.text.length) > DOCUMENT_LIMITS.totalChars) fail('document-text-limit');
        results.push({ text: result.text, report: { ...base, status: 'read', pages: result.pages, chars: result.text.length, method: result.method, redactions: file.nameRedactions } });
      } catch (error) {
        results.push({ text: '', report: { ...base, status: 'unreadable', pages: 0, chars: 0, method: 'text', redactions: file.nameRedactions, reason: error instanceof DocumentReadError ? error.code : 'document-extraction-failed' } });
      }
    }
    return results;
  } finally { await ocr.close(); }
}
