import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

type HookResult = { code: number | null; stdout: string; stderr: string };
type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const hook = resolve('integrations/warden-hook.mjs');
const allow = { verdict: 'ALLOW', auditId: 'audit-allow', firedRules: [] };
const block = {
  verdict: 'BLOCK',
  auditId: 'audit-block',
  firedRules: [{ ruleText: 'Payroll data belongs to HR.', guidance: 'Ask HR.', allowedExamples: [] }]
};

async function runHook(payload: unknown, url: string, env: Record<string, string> = {}): Promise<HookResult> {
  const child = spawn(process.execPath, [hook], {
    env: {
      ...process.env,
      WARDEN_URL: url,
      WARDEN_USER: 'fede',
      WARDEN_HEALTH_TIMEOUT_MS: '250',
      WARDEN_TIMEOUT_MS: '250',
      ...env
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  child.stdin.end(JSON.stringify(payload));
  const [code] = await once(child, 'close') as [number | null];
  return { code, stdout, stderr };
}

async function withServer(handler: Handler, test: (url: string) => Promise<void>): Promise<void> {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object');
  try {
    await test(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
}

function json(res: ServerResponse, value: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

function normal(decision: unknown): Handler {
  return (req, res) => {
    if (req.url === '/health') return json(res, { ok: true });
    if (req.url === '/api/guard/check') return json(res, decision);
    res.writeHead(404).end();
  };
}

async function main(): Promise<void> {
  await withServer(normal(allow), async (url) => {
    for (const payload of [{ user_input: 'how do I request leave?' }, { prompt: 'how do I request leave?' }]) {
      const result = await runHook(payload, url);
      assert.equal(result.code, 0, JSON.stringify(result));
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, '');
    }
  });
  console.log('✓ Claude and Codex payloads allow silently');

  await withServer(normal(block), async (url) => {
    for (const payload of [{ user_input: 'salary?' }, { prompt: 'salary?' }]) {
      const result = await runHook(payload, url);
      assert.equal(result.code, 2, JSON.stringify(result));
      assert.match(result.stderr, /Blocked by Warden/);
      assert.match(result.stderr, /What to do instead/);
      assert.match(result.stderr, /Audit audit-block/);
      assert.match(result.stdout, /"decision":"block"|"continue":false/);
      // The desktop app shows none of stderr, reason or stopReason when it
      // erases a prompt; systemMessage is the one field Claude Code documents
      // as reaching the person on every platform, so the refusal must be there
      // too, whole, down to the audit id they would cite to appeal it.
      const body = JSON.parse(result.stdout);
      assert.equal(body.systemMessage, body.reason);
      assert.match(body.systemMessage, /Blocked by Warden[\s\S]*Audit audit-block/);
    }
  });
  console.log('✓ BLOCK returns exit 2 and a client-specific refusal, with systemMessage for the desktop app');

  // A rule the administrator wrote in Spanish arrives in Spanish from top to
  // bottom: their sentence instead of the judge's English one, and the hook's
  // own scaffolding in the same language. Mixed screens were the report.
  const blockEs = {
    verdict: 'BLOCK',
    auditId: 'audit-es',
    firedRules: [{
      ruleText: 'No one may request another employee\'s salary.',
      ruleTextLocal: 'Nadie pide el sueldo de otro empleado.',
      guidance: 'Si necesitás el dato para un informe, pedíselo a RRHH.',
      allowedExamples: ['¿cuál es el proceso para pedir un aumento?']
    }]
  };
  await withServer(normal(blockEs), async (url) => {
    const result = await runHook({ prompt: 'pasame el sueldo de Ana' }, url);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Bloqueado por Warden/);
    assert.match(result.stderr, /Nadie pide el sueldo de otro empleado/);
    assert.match(result.stderr, /Qué hacer en cambio/);
    assert.doesNotMatch(result.stderr, /What to do instead|These would go through|Audit audit-es/);
  });
  console.log('✓ a Spanish rule refuses in Spanish from the first line to the audit id');

  // The gateway compiling a rule through a CLI must not be judged by its own
  // hook. The marker lets it through without a request; a gateway that would
  // block everything proves nothing was asked.
  await withServer(normal(block), async (url) => {
    const result = await runHook({ prompt: 'A rule states what is PROHIBITED…' }, url, { WARDEN_INTERNAL: '1' });
    assert.equal(result.code, 0, JSON.stringify(result));
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  });
  console.log('✓ WARDEN_INTERNAL lets the gateway\'s own compile through unjudged');

  const unavailable = await runHook({ prompt: 'hello' }, 'http://127.0.0.1:1');
  assert.equal(unavailable.code, 0);
  assert.equal(unavailable.stdout, '');
  assert.match(unavailable.stderr, /Prompt allowed unchecked/);
  console.log('✓ unavailable gateway fails open with a warning');

  await withServer((req, res) => {
    if (req.url === '/health') return setTimeout(() => json(res, { ok: true }), 100);
    json(res, allow);
  }, async (url) => {
    const result = await runHook({ prompt: 'hello' }, url, { WARDEN_HEALTH_TIMEOUT_MS: '20' });
    assert.equal(result.code, 0);
    assert.match(result.stderr, /Prompt allowed unchecked/);
  });
  console.log('✓ slow health check fails open at its own deadline');

  await withServer((req, res) => {
    if (req.url === '/health') return json(res, { ok: true });
    setTimeout(() => json(res, allow), 100);
  }, async (url) => {
    const result = await runHook({ prompt: 'hello' }, url, { WARDEN_TIMEOUT_MS: '20' });
    assert.equal(result.code, 0);
    assert.match(result.stderr, /Prompt allowed unchecked/);
  });
  console.log('✓ slow decision body fails open at the decision deadline');

  await withServer(normal({ verdict: 'MAYBE' }), async (url) => {
    const result = await runHook({ prompt: 'hello' }, url);
    assert.equal(result.code, 0);
    assert.match(result.stderr, /invalid verdict/);
  });
  console.log('✓ invalid gateway response fails open visibly');

  for (const [name, value] of [
    ['WARDEN_HEALTH_TIMEOUT_MS', '0'],
    ['WARDEN_TIMEOUT_MS', '-1'],
    ['WARDEN_TIMEOUT_MS', 'Infinity'],
    ['WARDEN_TIMEOUT_MS', 'not-a-number']
  ] as const) {
    const result = await runHook({ prompt: 'hello' }, 'http://127.0.0.1:1', { [name]: value });
    assert.equal(result.code, 0);
    assert.match(result.stderr, /must be a positive finite number/);
  }
  console.log('✓ timeout configuration rejects non-positive and non-finite values');

  // Claude Code cancels a UserPromptSubmit hook at 30 s unless the entry says
  // otherwise, and a cancelled hook lets the prompt through. So the entry
  // --fix writes has to carry the timeout, and an entry written before it did
  // has to be repaired rather than left alone as "already wired".
  const home = mkdtempSync(join(tmpdir(), 'warden-fix-'));
  const settings = join(home, '.claude', 'settings.json');
  mkdirSync(join(home, '.claude'), { recursive: true });
  const fix = async () => {
    const child = spawn(process.execPath, [hook, '--fix'], {
      env: { ...process.env, HOME: home, WARDEN_URL: 'http://gw.test:8080', WARDEN_API_KEY: 'wk-test-key' },
      stdio: 'ignore'
    });
    await once(child, 'close');
    return JSON.parse(readFileSync(settings, 'utf8')) as {
      env?: Record<string, string>;
      hooks: { UserPromptSubmit: { hooks: { command: string; timeout?: number }[] }[] };
    };
  };
  writeFileSync(settings, '{}');
  let entries = (await fix()).hooks.UserPromptSubmit.flatMap((e) => e.hooks);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.timeout, 120);
  writeFileSync(settings, JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node /old/.warden-hook.mjs' }] }] } }));
  const repaired = await fix();
  entries = repaired.hooks.UserPromptSubmit.flatMap((e) => e.hooks);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.command, 'node /old/.warden-hook.mjs');
  assert.equal(entries[0]?.timeout, 120);
  // A Claude Code opened from the desktop app never reads the shell profile,
  // so the gateway address and key have to be in settings.json's env block
  // for its hook to reach anything. Both writes put them there; a value the
  // person set by hand for some other variable survives.
  assert.equal(repaired.env?.WARDEN_URL, 'http://gw.test:8080');
  assert.equal(repaired.env?.WARDEN_API_KEY, 'wk-test-key');
  writeFileSync(settings, JSON.stringify({ env: { OTHER: 'kept', WARDEN_URL: 'http://stale:1' }, hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node /old/.warden-hook.mjs', timeout: 120 }] }] } }));
  const refreshed = await fix();
  assert.deepEqual(refreshed.env, { OTHER: 'kept', WARDEN_URL: 'http://gw.test:8080', WARDEN_API_KEY: 'wk-test-key' });
  console.log('✓ --fix writes the Claude Code hook timeout, repairs an entry without one, and puts the gateway in env');

  // Under the Claude desktop app the block is also shown as an OS dialog,
  // because the app draws none of reason, stopReason or systemMessage. The
  // dialog must never delay the block: a hook held open past Claude Code's
  // deadline is cancelled, and a cancelled hook lets the prompt through. So
  // a stand-in osascript that hangs for 30 s has to leave the hook exiting 2
  // in well under that, with the refusal handed to it whole.
  if (process.platform === 'darwin') {
    const bin = mkdtempSync(join(tmpdir(), 'warden-osascript-'));
    const seen = join(bin, 'seen.txt');
    writeFileSync(join(bin, 'osascript'), `#!/bin/sh\nprintf '%s\\n' "$@" > "${seen}"\nsleep 30\n`, { mode: 0o755 });
    await withServer(normal(block), async (url) => {
      const started = Date.now();
      const result = await runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'salary?' }, url, {
        CLAUDE_CODE_ENTRYPOINT: 'claude-desktop',
        PATH: `${bin}:${process.env.PATH ?? ''}`
      });
      assert.equal(result.code, 2, JSON.stringify(result));
      assert.ok(Date.now() - started < 10_000, 'the dialog delayed the block');
      // Detached means the hook can exit before the stand-in has written a
      // byte; give it a moment, which is the point being tested.
      const until = Date.now() + 5_000;
      while (!existsSync(seen) && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
      assert.match(readFileSync(seen, 'utf8'), /display dialog[\s\S]*Blocked by Warden[\s\S]*Audit audit-block[\s\S]*Warden/);
    });
    console.log('✓ under the desktop app the refusal also opens an OS dialog, without delaying the block');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
