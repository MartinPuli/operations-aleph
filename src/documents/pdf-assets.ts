import { join } from 'node:path';

/** PDF.js validates a literal trailing slash, but its Node factory reads paths,
 * not file: URL strings. Keep native paths (including spaces and #) and append
 * the API's slash after joining: Windows join would otherwise replace it. */
export function pdfAssetPaths(packageRoot: string, joinPath = join) {
  const directory = (name: string) => `${joinPath(packageRoot, name)}/`;
  return {
    cMapUrl: directory('cmaps'),
    standardFontDataUrl: directory('standard_fonts'),
    wasmUrl: directory('wasm')
  };
}
