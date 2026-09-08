import { extractBatch } from './extract.js';
import type { DocumentBytes } from './types.js';

// Extraction accepts bytes only. Its models and PDF assets are packaged locally.
globalThis.fetch = async () => { throw new Error('Document extraction cannot access the network'); };

process.once('message', async (message: { files: DocumentBytes[]; assetDir: string }) => {
  try {
    const documents = await extractBatch(message.files, message.assetDir);
    process.send?.({ documents });
  } catch { process.exitCode = 1; process.disconnect?.(); }
});
