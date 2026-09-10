import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../integrations/kool/package.json', import.meta.url));
const destination = new URL('../landing/assets/kool/', import.meta.url);
await mkdir(destination, { recursive: true });
// Publish only the official attribution helper, never the server client or config.
await copyFile(require.resolve('@joinkool/sdk/browser'), new URL('browser.mjs', destination));
console.log('Kool browser attribution helper prepared.');
