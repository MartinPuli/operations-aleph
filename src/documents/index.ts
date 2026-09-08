import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { sanitize } from '../guard/sanitize.js';
import { normalizeUntrusted } from '../guard/isolate.js';
import { runExtraction } from './runner.js';
import { DOCUMENT_FORMATS, DOCUMENT_LIMITS, DocumentInputError } from './types.js';
import type { DocumentBytes, ExtractedDocument, InlineDocument } from './types.js';

export * from './types.js';

/** Validate the complete payload before allocating decoded bytes or starting parsers. */
export function parseDocumentAttachments(value: unknown): InlineDocument[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new DocumentInputError('attachments must be an array of inline files');
  if (value.length > DOCUMENT_LIMITS.files) throw new DocumentInputError(`At most ${DOCUMENT_LIMITS.files} attachments are allowed`, 413);
  let totalBytes = 0;
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new DocumentInputError('Each attachment needs a name and base64 data; paths and URLs are not accepted');
    const file = item as Record<string, unknown>;
    if (Object.keys(file).some((key) => !['name', 'mimeType', 'data'].includes(key))) throw new DocumentInputError('Attachment fields must be name, mimeType and data; paths and URLs are not accepted');
    if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 200) throw new DocumentInputError('Each attachment needs a filename of at most 200 characters');
    if (/[\x00-\x1f\x7f/\\]/.test(file.name)) throw new DocumentInputError('Attachment names must be filenames, not paths');
    if (file.mimeType !== undefined && (typeof file.mimeType !== 'string' || file.mimeType.length > 150)) throw new DocumentInputError('Attachment mimeType must be a string');
    if (typeof file.data !== 'string' || !file.data.length) throw new DocumentInputError('Each attachment needs nonempty base64 data');
    if (file.data.length > Math.ceil(DOCUMENT_LIMITS.fileBytes / 3) * 4) throw new DocumentInputError('An attachment exceeds the 8 MiB limit', 413);
    if (file.data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(file.data)) throw new DocumentInputError('Attachment data must be canonical base64 without a data URL prefix');
    const bytes = file.data.length / 4 * 3 - (file.data.endsWith('==') ? 2 : file.data.endsWith('=') ? 1 : 0);
    if (bytes > DOCUMENT_LIMITS.fileBytes || (totalBytes += bytes) > DOCUMENT_LIMITS.totalBytes) throw new DocumentInputError('Attachments exceed the 16 MiB total limit', 413);
    // Nonzero unused base64 bits are rejected too: one encoding for one document.
    if (Buffer.from(file.data, 'base64').toString('base64') !== file.data) throw new DocumentInputError('Attachment data must be canonical base64');
    return { name: file.name, ...(file.mimeType ? { mimeType: file.mimeType as string } : {}), data: file.data };
  });
}

export function decodeDocuments(input: InlineDocument[]): DocumentBytes[] {
  return parseDocumentAttachments(input).map((file) => {
    const bytes = Buffer.from(file.data, 'base64');
    const name = sanitize(normalizeUntrusted(file.name));
    const extension = file.name.split('.').at(-1)?.toLowerCase();
    const inferred = DOCUMENT_FORMATS.find((format) => format.extension === extension)?.mimeType ?? 'application/octet-stream';
    return {
      name: name.masked, nameRedactions: name.spans.length,
      mimeType: file.mimeType?.split(';')[0]?.trim().toLowerCase() || inferred,
      sha256: createHash('sha256').update(bytes).digest('hex'), bytes
    };
  });
}

export async function extractDocuments(input: InlineDocument[], options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<ExtractedDocument[]> {
  const decoded = decodeDocuments(input);
  if (!decoded.length) return [];
  return runExtraction(decoded, options);
}

export function documentCapabilities() {
  const require = createRequire(import.meta.url);
  let available = false;
  try {
    available = ['eng', 'spa'].every((lang) => existsSync(require.resolve(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`)));
  } catch { /* Missing packaged assets means OCR must hold, never download. */ }
  return { limits: DOCUMENT_LIMITS, formats: DOCUMENT_FORMATS, ocr: { languages: ['eng', 'spa'], offline: true, available } };
}

/** No extracted document text in API replies, SSE, review stores, or audit history. */
export function withoutDocumentText<T extends object>(decision: T): Omit<T, 'maskedDocuments'> {
  const { maskedDocuments: _transient, ...publicDecision } = decision as T & { maskedDocuments?: unknown };
  return publicDecision;
}
