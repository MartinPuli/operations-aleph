/** Read installation/auth readiness without returning Claude's account data.
 * Only an explicit Test/Apply sends a harmless completion to the CLI. */
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { CliCompilerAdapter, cliEnv, type CliTool } from './cli-compiler.js';
import { MockQvacAdapter } from './mock.js';

export type ClaudeStatus = {
  installed: boolean;
  auth: 'signed-in' | 'signed-out' | 'unknown' | 'unavailable';
  status: 'ready' | 'sign-in-required' | 'install-required' | 'unknown';
  message: string;
  checkedAt: string;
};

/** The optional environment parameter lets a bounded subprocess fixture test
 * absence without hiding or modifying the user's actual Claude installation. */
export function probeClaudeStatus(env: NodeJS.ProcessEnv = cliEnv()): Promise<ClaudeStatus> {
  return new Promise((resolve) => {
    const child = execFile('claude', ['auth', 'status'], { cwd: tmpdir(), env, timeout: 5_000, maxBuffer: 64 * 1024 }, (error, stdout) => {
      const checkedAt = new Date().toISOString();
      if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') {
        return resolve({ installed: false, auth: 'unavailable', status: 'install-required', message: 'Install Claude Code on the computer running Warden, then sign in and test the connection.', checkedAt });
      }
      try {
        const value = JSON.parse(String(stdout)) as { loggedIn?: unknown };
        // Account identifiers, auth methods, emails and subscription details
        // are intentionally ignored. Unknown output is not proof of a login.
        if (value.loggedIn === true && !error) return resolve({ installed: true, auth: 'signed-in', status: 'ready', message: 'Claude Code is signed in. Test the connection before applying it.', checkedAt });
        if (value.loggedIn === false) return resolve({ installed: true, auth: 'signed-out', status: 'sign-in-required', message: 'Run claude auth login on the computer running Warden, then test the connection.', checkedAt });
      } catch { /* Never expose raw command output or JSON parser diagnostics. */ }
      resolve({ installed: true, auth: 'unknown', status: 'unknown', message: 'Claude Code was found, but its sign-in status could not be confirmed. Check claude auth status in a terminal, or test the connection.', checkedAt });
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end();
  });
}

let cached: { key: string; until: number; promise: Promise<ClaudeStatus> } | undefined;
export function claudeStatus(refresh = false): Promise<ClaudeStatus> {
  const env = cliEnv();
  const key = `${env.PATH ?? ''}\n${env.HOME ?? ''}`;
  if (!refresh && cached && cached.key === key && cached.until > Date.now()) return cached.promise;
  const promise = probeClaudeStatus(env);
  cached = { key, until: Date.now() + 10_000, promise };
  return promise;
}

export class CliConnectionError extends Error {
  constructor(message: string, readonly code: 'cli_not_installed' | 'cli_sign_in_required' | 'cli_test_failed' | 'cli_test_timeout') { super(message); }
}

/** The two-attempt structured parser shares the normal compiler adapter. Each
 * attempt has a ten-second deadline, including its safe-mode compatibility
 * retry. No policy, roster, employee prompt or stored prompt template is sent. */
export async function testCliCompiler(tool: CliTool, model: string): Promise<void> {
  if (tool === 'claude') {
    const status = await claudeStatus(true);
    if (!status.installed) throw new CliConnectionError(status.message, 'cli_not_installed');
    if (status.auth === 'signed-out') throw new CliConnectionError(status.message, 'cli_sign_in_required');
  }
  const candidate = new CliCompilerAdapter(new MockQvacAdapter(), { tool, model, timeoutMs: 10_000 });
  try {
    await candidate.completeJSON({ role: 'compiler', system: 'This is a connection check. Reply with exactly {"status":"ready"}.',
      user: 'Return the ready JSON object. Do not use tools or inspect files.', maxTokens: 32, timeoutMs: 10_000 },
    z.object({ status: z.literal('ready') }), { type: 'object', properties: { status: { type: 'string', enum: ['ready'] } }, required: ['status'], additionalProperties: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/ENOENT|not found|not recognized/i.test(message)) throw new CliConnectionError('Install this compiler CLI on the computer running Warden, then test again.', 'cli_not_installed');
    if (/authenticat|not logged|sign.in|log.in|expired.{0,20}(session|token)/i.test(message)) throw new CliConnectionError('Sign in to this compiler CLI on the computer running Warden, then test again.', 'cli_sign_in_required');
    if (/deadline|timed out|timeout|SIGTERM|killed/i.test(message)) throw new CliConnectionError('The compiler connection check timed out. Check the CLI in a terminal and try again.', 'cli_test_timeout');
    throw new CliConnectionError('The CLI did not return the required connection-check response. Check its account, model access and usage limits in a terminal, then try again.', 'cli_test_failed');
  }
}
