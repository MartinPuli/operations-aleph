import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCUMENT_LIMITS } from './types.js';
import type { DocumentBytes, ExtractedDocument } from './types.js';

let activeWorkers = 0;

export function unreadable(files: DocumentBytes[], reason: string): ExtractedDocument[] {
  return files.map((file) => ({ text: '', report: {
    name: file.name, mimeType: file.mimeType, sha256: file.sha256, bytes: file.bytes.length,
    status: 'unreadable', pages: 0, chars: 0, method: 'text', redactions: file.nameRedactions, reason
  } }));
}

/** A process, not a promise timeout: kill ends native parsing and nested OCR threads. */
export async function runExtraction(files: DocumentBytes[], options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<ExtractedDocument[]> {
  if (options.signal?.aborted) return unreadable(files, 'cancelled');
  if (activeWorkers >= DOCUMENT_LIMITS.concurrentWorkers) return unreadable(files, 'document-reader-busy');
  activeWorkers++;
  let assetDir: string | undefined;
  const built = new URL('./worker.js', import.meta.url);
  const compiled = existsSync(built);
  const path = fileURLToPath(compiled ? built : new URL('./worker.ts', import.meta.url));
  try {
    // Only trusted, packaged OCR weights may be copied here. Document bytes stay in IPC.
    assetDir = await mkdtemp(join(tmpdir(), 'warden-document-models-'));
    return await new Promise((resolve) => {
      let answer: ExtractedDocument[] | undefined;
      let reason = 'document-reader-failed';
      let stopped = false;
      const child = fork(path, [], {
        execArgv: ['--max-old-space-size=512', ...(compiled ? [] : ['--import', 'tsx'])],
        serialization: 'advanced',
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        // Employee text and gateway credentials never enter a parser's environment.
        env: { PATH: process.env.PATH, ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), ELECTRON_RUN_AS_NODE: '1' }
      });
      const stop = (why: string) => { stopped = true; reason = why; answer = undefined; child.kill('SIGKILL'); };
      const timer = setTimeout(() => stop('document-reader-timeout'), Math.max(1, Math.min(options.timeoutMs ?? DOCUMENT_LIMITS.timeoutMs, DOCUMENT_LIMITS.timeoutMs)));
      const abort = () => stop('cancelled');
      options.signal?.addEventListener('abort', abort, { once: true });
      child.once('message', (message: unknown) => {
        if (stopped) return;
        if (message && typeof message === 'object' && 'documents' in message && Array.isArray(message.documents)) answer = message.documents as ExtractedDocument[];
        // A completed process should leave no OCR thread alive either.
        child.kill('SIGKILL');
      });
      child.once('error', () => { reason = 'document-reader-unavailable'; });
      child.once('close', () => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        resolve(answer?.length === files.length ? answer : unreadable(files, reason));
      });
      child.send({ files, assetDir }, (error) => { if (error) stop('document-reader-unavailable'); });
      if (options.signal?.aborted) abort();
    });
  } catch { return unreadable(files, 'document-reader-unavailable'); }
  finally {
    activeWorkers--;
    if (assetDir) await rm(assetDir, { recursive: true, force: true }).catch(() => {});
  }
}
