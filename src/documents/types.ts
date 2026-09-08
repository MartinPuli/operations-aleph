/** Public attachments contain bytes, never paths or URLs on the gateway. */
export type InlineDocument = { name: string; mimeType?: string; data: string };

export const DOCUMENT_LIMITS = Object.freeze({
  files: 5,
  fileBytes: 8 * 1024 * 1024,
  totalBytes: 16 * 1024 * 1024,
  pages: 20,
  totalChars: 120_000,
  timeoutMs: 45_000,
  imagePixels: 12_000_000,
  archiveBytes: 32 * 1024 * 1024,
  archiveEntries: 512,
  concurrentWorkers: 2
});

export const DOCUMENT_FORMATS = [
  { extension: 'pdf', mimeType: 'application/pdf' },
  { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { extension: 'txt', mimeType: 'text/plain' },
  { extension: 'md', mimeType: 'text/markdown' },
  { extension: 'csv', mimeType: 'text/csv' },
  { extension: 'png', mimeType: 'image/png' },
  { extension: 'jpg', mimeType: 'image/jpeg' },
  { extension: 'jpeg', mimeType: 'image/jpeg' },
  { extension: 'webp', mimeType: 'image/webp' },
  { extension: 'bmp', mimeType: 'image/bmp' }
] as const;

export type DocumentMethod = 'text' | 'pdf' | 'docx' | 'ocr' | 'mixed';
export type DocumentReport = {
  /** Sanitized display name. Never used as a filesystem path. */
  name: string;
  mimeType: string;
  /** SHA-256 of the original complete bytes, bound into the audit record. */
  sha256: string;
  bytes: number;
  status: 'read' | 'unreadable';
  pages: number;
  chars: number;
  method: DocumentMethod;
  redactions: number;
  reason?: string;
};

/** Transient, sanitized extracted text, solely for forwarding to the protected model. */
export type MaskedDocument = { name: string; sha256: string; text: string };
export type ExtractedDocument = { report: DocumentReport; text: string };
export type DocumentBytes = { name: string; nameRedactions: number; mimeType: string; sha256: string; bytes: Buffer };

export class DocumentInputError extends Error {
  constructor(message: string, readonly status: 400 | 413 = 400) {
    super(message);
    this.name = 'DocumentInputError';
  }
}

/** Errors are stable public reasons. Parser stack traces never enter an audit log. */
export class DocumentReadError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'DocumentReadError'; }
}
