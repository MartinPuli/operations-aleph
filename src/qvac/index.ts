/**
 * Adapter selection. Everything downstream imports `adapter()` and never the
 * concrete classes, so switching to the mock is a matter of one env var.
 */
import { MockQvacAdapter } from './mock.js';
import { LlamaCppAdapter } from './llamacpp.js';
import { RealQvacAdapter } from './real.js';
import { RemoteCompilerAdapter, remoteCompilerConfig } from './remote.js';
import type { CompleteRequest, QvacAdapter } from './types.js';
import type { ZodType } from 'zod';
import { withModelRole } from './coordination.js';
import { CliCompilerAdapter, cliCompilerConfig } from './cli-compiler.js';

let instance: QvacAdapter | null = null;

/**
 * `WARDEN_ADAPTER=mock` runs the whole app with no model present.
 *
 * `llamacpp` runs the same weights under a different engine. It exists so that
 * "would this work better on something other than QVAC" can be answered by a
 * paired run over the same bench cells rather than by argument — see
 * `llamacpp.ts`. It is loaded lazily and its dependency is not in
 * `package.json`, so selecting it is a deliberate act and everyone else pays
 * nothing for its existence.
 */
let localInstance: QvacAdapter | null = null;
let compilerInstance: QvacAdapter | null = null;
let compilerSignature = '';

function compilerAdapter(local: QvacAdapter): QvacAdapter {
  const cli = cliCompilerConfig();
  const remote = cli ? null : remoteCompilerConfig();
  const signature = JSON.stringify([cli, remote]);
  if (!compilerInstance || signature !== compilerSignature) {
    compilerInstance = cli ? new CliCompilerAdapter(local, cli) : remote ? new RemoteCompilerAdapter(local, remote) : local;
    compilerSignature = signature;
  }
  return compilerInstance;
}

/** The routing object stays stable, while each compiler call captures the
 * currently saved connection. Updating it never disposes the local guard. */
export function adapter(): QvacAdapter {
  if (!instance) {
    const choice = process.env['WARDEN_ADAPTER'];
    const local = localInstance = choice === 'mock' ? new MockQvacAdapter() : choice === 'llamacpp' ? new LlamaCppAdapter() : new RealQvacAdapter();
    instance = {
      complete: (req) => withModelRole(req.role, () => (req.role === 'compiler' ? compilerAdapter(local) : local).complete(req)),
      completeJSON: <T>(req: CompleteRequest, schema: ZodType<T>, json: Record<string, unknown>) =>
        withModelRole(req.role, () => (req.role === 'compiler' ? compilerAdapter(local) : local).completeJSON(req, schema, json)),
      embed: (texts) => withModelRole('embedder', () => local.embed(texts)),
      ocr: (path) => withModelRole('ocr', () => local.ocr(path)),
      stats: () => local.stats(),
      dispose: () => local.dispose()
    };
  }
  return instance;
}

export function refreshCompiler(): void { compilerInstance = null; compilerSignature = ''; }

/**
 * Where rule compilation runs, for the console and the measurement records.
 *
 * An administrator ratifying a draft should be able to see whether the model
 * that wrote it was theirs, and a recorded run should say the same. Returns
 * null when compilation is local, which is the default.
 */
export function remoteCompiler(): string | null {
  adapter();
  const a = compilerAdapter(localInstance!);
  if (a instanceof CliCompilerAdapter) return a.describe();
  return a instanceof RemoteCompilerAdapter ? a.describe() : null;
}

export function isMock(): boolean {
  return process.env['WARDEN_ADAPTER'] === 'mock';
}

/**
 * Which engine is answering, as a name rather than a boolean.
 *
 * `isMock()` splits the world into mock and not-mock, which was enough while
 * there was one real runtime and is a trap now that there are two: a bench
 * cache keyed on "real" hands a `llamacpp` run the answers QVAC already gave,
 * and the paired comparison the second runtime exists for reports a perfect
 * tie without running a single generation. Anything caching or recording a
 * result must key on this, not on `isMock()`.
 */
export function adapterName(): 'mock' | 'llamacpp' | 'qvac' {
  const choice = process.env['WARDEN_ADAPTER'];
  return choice === 'mock' ? 'mock' : choice === 'llamacpp' ? 'llamacpp' : 'qvac';
}

export * from './types.js';
