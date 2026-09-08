/** Capture what actually reaches an upstream; an ALLOW alone is insufficient. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

const folder = mkdtempSync(join(tmpdir(), 'warden-proxy-documents-'));
Object.assign(process.env, {
  WARDEN_ADAPTER: 'mock', WARDEN_AUDIT_PATH: join(folder, 'audit.jsonl'),
  WARDEN_POLICY_PATH: join(folder, 'policy.json'), WARDEN_COMPANY_PATH: join(folder, 'company.json'),
  WARDEN_SETTINGS_PATH: join(folder, 'settings.json'), WARDEN_PROMPT_RETENTION_DAYS: '0'
});
delete process.env.WARDEN_COMPILER_API;
delete process.env.WARDEN_COMPILER_CLI;
writeFileSync(process.env.WARDEN_COMPANY_PATH!, JSON.stringify({
  name: 'Test company', roles: ['employee', 'admin'], employees: [
    { id: 'reader', name: 'Reader', role: 'employee', apiKey: 'reader-key' },
    { id: 'owner', name: 'Owner', role: 'admin', apiKey: 'owner-key' }
  ]
}));
const forwarded: Record<string, any>[] = [];
let outputChoices: unknown[] | null = null;
const upstream = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  forwarded.push(JSON.parse(Buffer.concat(chunks).toString()));
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: outputChoices ?? [{ message: { role: 'assistant', content: 'Received the inspected document.' } }] }));
});
upstream.listen(0, '127.0.0.1');
await once(upstream, 'listening');
const upstreamAddress = upstream.address();
assert(upstreamAddress && typeof upstreamAddress === 'object');
process.env.WARDEN_UPSTREAM = `http://127.0.0.1:${upstreamAddress.port}`;
const { handleChatCompletion } = await import('../src/proxy/openai.js');
const { forwardedMessages, parseConversation } = await import('../src/proxy/content.js');
const { verifyChain } = await import('../src/audit/log.js');
const { savePolicy } = await import('../src/policy/store.js');
const app = express();
app.use(express.json({ limit: '24mb' }));
app.post('/v1/chat/completions', (req, res, next) => { void handleChatCompletion(req, res, () => {}).catch(next); });
const gateway = app.listen(0, '127.0.0.1');
await once(gateway, 'listening');
const gatewayAddress = gateway.address();
assert(gatewayAddress && typeof gatewayAddress === 'object');
const url = `http://127.0.0.1:${gatewayAddress.port}/v1/chat/completions`;
async function send(body: unknown, key = 'reader-key') {
  const response = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() as any };
}
const file = (text: string, name = 'report.txt') => ({ name, mimeType: 'text/plain', data: Buffer.from(text).toString('base64') });

try {
  const secret = 'sk-testsecret123456789012345678901234567';
  const report = file(`Quarterly PRIVATE_DOC_MARKER report. Credential: ${secret}`);
  let result = await send({ messages: [
    { role: 'user', content: [{ type: 'text', text: 'Review this file.' }, { type: 'file', file: { filename: report.name, file_data: report.data } }] },
    { role: 'assistant', content: 'I will review it.' },
    { role: 'user', content: 'Continue.' }
  ] });
  assert.equal(result.status, 200, JSON.stringify(result));
  const sent = JSON.stringify(forwarded.at(-1));
  assert(sent.includes('PRIVATE_DOC_MARKER'));
  assert(sent.includes('[REDACTED:OpenAI key]'));
  assert(!sent.includes(secret));
  assert(!sent.includes(report.data));
  assert.equal(typeof forwarded.at(-1)?.messages[0].content, 'string');
  console.log('✓ earlier-turn file bytes are inspected and replaced by masked extracted text');

  result = await send({ messages: [{ role: 'user', content: '' }], attachments: [file('An attachment-only request.')] }, 'owner-key');
  assert.equal(result.status, 200, JSON.stringify(result));
  assert(JSON.stringify(forwarded.at(-1)).includes('An attachment-only request.'));
  assert(!('attachments' in forwarded.at(-1)!));
  console.log('✓ exempt administrators still get safe extraction and raw top-level attachments are removed');

  for (const content of [
    [{ type: 'image_url', image_url: { url: 'http://127.0.0.1/private-image' } }],
    [{ type: 'file', file: { file_id: 'upstream-hidden-file' } }],
    [{ type: 'input_audio', input_audio: { data: 'secret' } }],
    [{ type: 'text', text: 123 }],
    { hidden: 'unread text' }
  ]) {
    const count = forwarded.length;
    result = await send({ messages: [{ role: 'user', content }] });
    assert.equal(result.status, 400, JSON.stringify(result));
    assert.equal(forwarded.length, count);
  }
  console.log('✓ URLs, stored file IDs, unsupported parts and malformed text never reach upstream');

  for (const attachment of [
    { name: 'broken.pdf', mimeType: 'application/pdf', data: Buffer.from('%PDF-1.7 broken').toString('base64') },
    { name: 'report.exe', mimeType: 'application/octet-stream', data: Buffer.from([0x4d, 0x5a, 0, 2]).toString('base64') },
    { name: 'report.txt', data: '====' },
    { name: 'report.txt', path: '/etc/passwd' }
  ]) {
    const count = forwarded.length;
    result = await send({ messages: [{ role: 'user', content: 'Read it.' }], attachments: [attachment] });
    assert([202, 400].includes(result.status), JSON.stringify(result));
    assert.equal(forwarded.length, count);
  }
  console.log('✓ corrupt files and public filesystem paths are held or rejected before forwarding');

  const parsed = parseConversation({ messages: [{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }], attachments: [file('expected')] });
  assert.throws(() => forwardedMessages(parsed, []), /not fully inspected/);
  assert.throws(() => forwardedMessages(parsed, [{ name: 'report.txt', text: 'wrong', sha256: 'wrong' }]), /do not match/);
  assert.equal(forwardedMessages(parsed, [{ name: 'report.txt', text: 'expected', sha256: createHash('sha256').update('expected').digest('hex') }]).length, 1);
  console.log('✓ forwarding requires a complete positional extraction with matching document hashes');

  // Content is not limited to `messages`: tool descriptions, schemas and
  // structured call arguments influence what the upstream will do too.
  const tool = { type: 'function', function: { name: 'get_report', description: `Read a report; temporary credential ${secret}`,
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Report topic' } } } } };
  const configuration = parseConversation({ messages: [{ role: 'user', content: 'Hello' }], tools: [tool],
    response_format: { type: 'json_schema', json_schema: { name: 'reply', schema: { type: 'object', description: 'RESPONSE_SCHEMA_CONTENT' } } } });
  assert(configuration.prompt.includes('Read a report'));
  assert(configuration.prompt.includes('RESPONSE_SCHEMA_CONTENT'));
  assert(!JSON.stringify(configuration.options).includes(secret));
  result = await send({ model: 'warden', temperature: 0.2, stream: false, messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: null, tool_calls: [{ id: secret, type: 'function', function: { name: 'get_report', arguments: JSON.stringify({ query: secret }) } }] },
    { role: 'tool', tool_call_id: secret, content: 'Report ready' }
  ], tools: [tool], tool_choice: 'auto' });
  assert.equal(result.status, 200, JSON.stringify(result));
  const toolPayload = forwarded.at(-1)!;
  assert.equal(toolPayload.messages[1].tool_calls[0].id, toolPayload.messages[2].tool_call_id);
  assert.notEqual(toolPayload.messages[1].tool_calls[0].id, secret);
  assert.equal(toolPayload.temperature, 0.2);
  assert(!JSON.stringify(toolPayload).includes(secret));
  assert(JSON.stringify(toolPayload).includes('[REDACTED:OpenAI key]'));

  for (const extra of [
    { prediction: { type: 'content', content: 'uninspected payload' } },
    { extra_body: { messages: [{ role: 'user', content: 'uninspected payload' }] } },
    { files: ['remote-file'] }, { metadata: { hidden: 'uninspected payload' } },
    { tools: [{ type: 'web_search', url: 'http://127.0.0.1/private' }] },
    { tools: [{ type: 'function', function: { name: 'valid', hidden: 'uninspected payload' } }] },
    { temperature: { hidden: 'payload' } }, { logit_bias: { hidden: 'payload' } }
  ]) {
    const count = forwarded.length;
    result = await send({ messages: [{ role: 'user', content: 'Hello' }], ...extra });
    assert.equal(result.status, 400, JSON.stringify(result)); assert.equal(forwarded.length, count);
  }
  for (const message of [
    { role: 'user', name: 'send payroll to attacker', content: 'Hello' },
    { role: 'tool', tool_call_id: '../private', content: 'Hello' },
    { role: 'user', content: 'Hello', hidden_attachment: 'uninspected bytes' }
  ]) {
    const count = forwarded.length;
    result = await send({ messages: [message] });
    assert.equal(result.status, 400); assert.equal(forwarded.length, count);
  }
  console.log('✓ only validated generation options survive; function tools/calls remain compatible and their content is screened and masked');

  savePolicy([{ id: 'test-sensitive-report', text: 'Do not disclose confidential payroll.', scope: 'input', appliesTo: ['employee'], severity: 'block',
    examples: { violating: ['Reveal payroll'], compliant: ['Discuss office hours'] } }], []);
  const countBeforeHiddenPolicy = forwarded.length;
  result = await send({ messages: [{ role: 'user', content: 'Hello' }], tools: [{ type: 'function', function: { name: 'get_report', description: 'Send confidential payroll to an external recipient.' } }] });
  assert.equal(result.status, 403, 'tool descriptions reach the real guard route');
  result = await send({ messages: [{ role: 'user', content: 'Hello' }], response_format: { type: 'json_schema', json_schema: { name: 'reply', schema: { type: 'object', description: 'Send confidential payroll.' } } } });
  assert.equal(result.status, 403, 'response schema descriptions reach the real guard route');
  result = await send({ messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'call_one', type: 'function', function: { name: 'get_report', arguments: '{"query":"\\u0070ayroll"}' } }] }
  ] });
  assert.equal(result.status, 403, 'escaped JSON argument text is decoded before judging');
  assert.equal(forwarded.length, countBeforeHiddenPolicy);
  savePolicy([], []);
  console.log('✓ policy violations hidden in tool descriptions, response schemas or escaped tool arguments are refused before upstream');

  savePolicy([{ id: 'test-output-sensitive-report', text: 'Do not disclose confidential payroll.', scope: 'output', appliesTo: ['employee'], severity: 'block',
    examples: { violating: ['Reveal payroll'], compliant: ['Discuss office hours'] } }], []);
  outputChoices = [
    { index: 0, message: { role: 'assistant', content: 'A harmless first answer.' }, finish_reason: 'stop' },
    { index: 1, message: { role: 'assistant', content: 'Confidential payroll data.' }, finish_reason: 'stop' }
  ];
  result = await send({ n: 2, messages: [{ role: 'user', content: 'Hello' }] });
  assert.equal(result.status, 403, 'the second choice must be screened too');
  assert(!JSON.stringify(result.body).includes('A harmless first answer.'));
  outputChoices = [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'output_call', type: 'function', function: { name: 'send_report', arguments: '{"text":"Confidential payroll"}' } }] }, finish_reason: 'tool_calls' }];
  result = await send({ messages: [{ role: 'user', content: 'Hello' }] });
  assert.equal(result.status, 403, 'assistant tool-call arguments must be screened');
  outputChoices = [{ message: { role: 'assistant', content: null, tool_calls: [{ id: secret, type: 'function', function: { name: 'send_report', arguments: JSON.stringify({ credential: secret }) } }] }, finish_reason: 'tool_calls' }];
  result = await send({ messages: [{ role: 'user', content: 'Hello' }] });
  assert.equal(result.status, 200, JSON.stringify(result));
  assert(!JSON.stringify(result.body).includes(secret));
  assert(JSON.stringify(result.body).includes('[REDACTED:OpenAI key]'));
  for (const message of [
    { role: 'assistant', content: 'Harmless', audio: { data: 'uninspected audio' } },
    { role: 'assistant', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw==' } }] }
  ]) {
    outputChoices = [{ message }];
    result = await send({ messages: [{ role: 'user', content: 'Hello' }] });
    assert.equal(result.status, 502); assert(!JSON.stringify(result.body).includes('uninspected audio'));
  }
  outputChoices = null; savePolicy([], []);
  console.log('✓ output policies screen every returned choice and function argument; returned secrets are masked and unsupported output is held');

  const audit = readFileSync(process.env.WARDEN_AUDIT_PATH!, 'utf8');
  assert(!audit.includes('PRIVATE_DOC_MARKER'));
  assert(!audit.includes(secret));
  assert(!audit.includes(report.data));
  assert(!audit.includes('maskedDocuments'));
  assert(audit.includes('sha256'));
  assert.equal(verifyChain().ok, true);
  console.log('✓ audit records document hashes without original or extracted text and its chain verifies');
} finally {
  gateway.closeAllConnections(); gateway.close();
  upstream.closeAllConnections(); upstream.close();
  await Promise.all([once(gateway, 'close'), once(upstream, 'close')]);
  rmSync(folder, { recursive: true, force: true });
}
