/**
 * The desktop shell reaches the server by name, through a dynamic import of
 * the compiled `src/setup/` modules, and declares what it expects in two
 * types in `desktop/first-run.ts`. Nothing static ties the two together: a
 * function the shell calls can be deleted from `src/` with every typecheck
 * green, and the app then opens with "lib.X is not a function" — which is
 * exactly what v0.1.37 did. This reads the shell's declared contract and
 * checks every member exists on the module it will import.
 *
 * Run: pnpm run test:desktop
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('desktop/first-run.ts', 'utf8');

function members(typeName: string): string[] {
  const block = new RegExp(`type ${typeName} = \\{([^}]*)\\}`).exec(shell)?.[1];
  assert.ok(block, `desktop/first-run.ts no longer declares ${typeName}`);
  return [...block.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]!);
}

const download = await import('../src/setup/download.js');
for (const name of members('DownloadLib')) {
  assert.equal(typeof (download as Record<string, unknown>)[name], 'function', `src/setup/download.ts must export function ${name}: the desktop shell calls it`);
}
const catalog = await import('../src/setup/catalog.js');
for (const name of members('CatalogLib')) {
  assert.ok(name in catalog, `src/setup/catalog.ts must export ${name}: the desktop shell reads it`);
}
console.log(`✓ the desktop shell's contract holds: ${[...members('DownloadLib'), ...members('CatalogLib')].join(', ')}`);
