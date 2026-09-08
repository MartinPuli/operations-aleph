/**
 * Translate the wire format once, before either judging or forwarding it.
 *
 * The old proxy selected only string content for the guard and forwarded the
 * original array untouched. A client could therefore hide even ordinary text
 * in a content part. This representation keeps one index for each attachment:
 * an allowed request can only be rebuilt from the extraction actually judged.
 */
import { createHash } from 'node:crypto';
import { parseDocumentAttachments, type InlineDocument } from '../documents/index.js';
import { normalizeUntrusted } from '../guard/isolate.js';
import { sanitize } from '../guard/sanitize.js';

type TextPart = { text: string };
type DocumentPart = { document: number };
type Message = {
  role: string;
  parts: (TextPart | DocumentPart)[];
  fields: Record<string, unknown>;
};

export class ChatInputError extends Error {
  readonly status = 400;
}

export type ParsedConversation = {
  messages: Message[];
  prompt: string;
  documents: InlineDocument[];
  options: Record<string, unknown> & { model?: string; stream?: boolean };
};

const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/;
function identifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !IDENTIFIER.test(value) || sanitize(value).masked !== value) throw new ChatInputError(`${label} must be a plain protocol identifier of at most 64 characters.`);
  return value;
}
function callId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) throw new ChatInputError('Tool call IDs must be plain protocol identifiers.');
  // IDs join calls to responses, but their original spelling carries no model
  // instruction. A deterministic local alias keeps the join without forwarding
  // a credential someone placed in an otherwise opaque ID.
  return `warden_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}
function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new ChatInputError(`${label} contains an unsupported field. It was not forwarded.`);
}
function cleanStructured(value: unknown, depth = 0): unknown {
  if (depth > 24) throw new ChatInputError('Tool or response configuration is nested too deeply.');
  if (typeof value === 'string') return sanitize(normalizeUntrusted(value)).masked;
  if (Array.isArray(value)) return value.map((v) => cleanStructured(v, depth + 1));
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, v]) => [sanitize(normalizeUntrusted(key)).masked, cleanStructured(v, depth + 1)] as const);
    if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new ChatInputError('Configuration keys collide after normalization.');
    return Object.fromEntries(entries);
  }
  return value;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChatInputError('Expected a message or content part object.');
  }
  return value as Record<string, unknown>;
}

function inlineFile(value: unknown, fallbackName: string): unknown {
  const file = object(value);
  const data = file.file_data ?? file.data;
  if (typeof data !== 'string') {
    throw new ChatInputError('Send the file bytes inline. Stored file IDs and remote file URLs cannot be inspected.');
  }
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(data);
  return {
    name: file.filename ?? file.name ?? fallbackName,
    mimeType: match?.[1] ?? file.mimeType ?? file.mime_type,
    data: match?.[2] ?? data
  };
}

export function parseConversation(body: unknown): ParsedConversation {
  const raw = object(body);
  if (!Array.isArray(raw.messages) || raw.messages.length === 0 || raw.messages.length > 200) {
    throw new ChatInputError('Send between 1 and 200 messages.');
  }
  const documents: unknown[] = [];
  const texts: string[] = [];
  let chars = 0;
  const textPart = (value: unknown): TextPart => {
    if (typeof value !== 'string') throw new ChatInputError('Text content must be a string.');
    chars += value.length;
    if (chars > 120_000) throw new ChatInputError('Conversation text exceeds 120,000 characters.');
    texts.push(value);
    return { text: value };
  };
  const screened = (value: unknown): unknown => {
    textPart(JSON.stringify(value));
    return cleanStructured(value);
  };
  function functionDefinition(value: unknown): Record<string, unknown> {
    const fn = object(value);
    onlyKeys(fn, ['name', 'description', 'parameters', 'strict'], 'Function definition');
    identifier(fn.name, 'Function name');
    if (fn.description !== undefined && typeof fn.description !== 'string') throw new ChatInputError('Function descriptions must be text.');
    if (fn.parameters !== undefined) object(fn.parameters);
    if (fn.strict !== undefined && typeof fn.strict !== 'boolean') throw new ChatInputError('Function strict must be a boolean.');
    return screened(fn) as Record<string, unknown>;
  }
  function functionCall(value: unknown): Record<string, unknown> {
    const fn = object(value);
    onlyKeys(fn, ['name', 'arguments'], 'Function call');
    identifier(fn.name, 'Function name');
    if (typeof fn.arguments !== 'string' || fn.arguments.length > 120_000) throw new ChatInputError('Function arguments must be a bounded JSON string.');
    let args: unknown;
    try { args = JSON.parse(fn.arguments); } catch { throw new ChatInputError('Function arguments must contain readable JSON.'); }
    // Decode the argument JSON before judging it. Otherwise escaped Unicode
    // could be hidden in the string seen by the guard and decoded in the
    // structured arguments sent to the upstream.
    textPart(JSON.stringify({ name: fn.name, arguments: args }));
    return { name: fn.name, arguments: JSON.stringify(cleanStructured(args)) };
  }
  const documentPart = (value: unknown): DocumentPart => {
    const index = documents.length;
    documents.push(value);
    return { document: index };
  };
  const messages = raw.messages.map((value): Message => {
    const m = object(value);
    onlyKeys(m, ['role', 'content', 'name', 'tool_call_id', 'tool_calls', 'function_call'], 'Message');
    if (m.role === 'tool' && m.tool_call_id === undefined) throw new ChatInputError('Tool messages need a tool_call_id.');
    if (m.tool_call_id !== undefined && m.role !== 'tool') throw new ChatInputError('Only tool messages may carry a tool_call_id.');
    if (m.role === 'function' && m.name === undefined) throw new ChatInputError('Function messages need a function name.');
    if (!['system', 'developer', 'user', 'assistant', 'tool', 'function'].includes(String(m.role))) {
      throw new ChatInputError('Unknown message role.');
    }
    const parts: (TextPart | DocumentPart)[] = [];
    if (typeof m.content === 'string') parts.push(textPart(m.content));
    else if (Array.isArray(m.content)) {
      if (m.content.length > 100) throw new ChatInputError('A message has too many content parts.');
      for (const value of m.content) {
        const p = object(value);
        if (p.type === 'text' || p.type === 'input_text') parts.push(textPart(p.text));
        else if (p.type === 'file' || p.type === 'input_file') {
          parts.push(documentPart(inlineFile(p.file ?? p, 'document')));
        } else if (p.type === 'image_url' || p.type === 'input_image') {
          const image = typeof p.image_url === 'string' ? p.image_url : object(p.image_url).url;
          if (typeof image !== 'string' || !image.startsWith('data:')) {
            throw new ChatInputError('Send image bytes as a data URL. Remote image URLs cannot be inspected.');
          }
          const mime = /^data:([^;,]+);base64,/.exec(image)?.[1];
          const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[mime ?? ''];
          parts.push(documentPart(inlineFile({ data: image, name: `image-${documents.length + 1}.${extension ?? 'image'}` }, 'image')));
        } else {
          throw new ChatInputError(`Unsupported content part: ${String(p.type ?? 'missing type').slice(0, 60)}. It was not forwarded.`);
        }
      }
    } else if (m.content !== null && m.content !== undefined) {
      throw new ChatInputError('Message content must be text or a list of supported content parts.');
    } else if (m.role !== 'assistant' || (!Array.isArray(m.tool_calls) && m.function_call === undefined)) {
      throw new ChatInputError('This message has no readable content.');
    }

    // Only protocol fields survive. A second attachment-bearing field must not
    // smuggle the original bytes past the normalized content used by the guard.
    const fields: Record<string, unknown> = {};
    if (m.name !== undefined) { fields.name = identifier(m.name, 'Message name'); textPart(m.name); }
    if (m.tool_call_id !== undefined) fields.tool_call_id = callId(m.tool_call_id);
    if (m.tool_calls !== undefined) {
      if (m.role !== 'assistant' || !Array.isArray(m.tool_calls) || !m.tool_calls.length || m.tool_calls.length > 64) throw new ChatInputError('Assistant tool_calls must contain between 1 and 64 calls.');
      fields.tool_calls = m.tool_calls.map((value) => {
        const call = object(value);
        onlyKeys(call, ['id', 'type', 'function'], 'Tool call');
        if (call.type !== 'function') throw new ChatInputError('Only function tool calls are supported.');
        return { id: callId(call.id), type: 'function', function: functionCall(call.function) };
      });
    }
    if (m.function_call !== undefined) {
      if (m.role !== 'assistant') throw new ChatInputError('Only assistant messages may carry a function call.');
      fields.function_call = functionCall(m.function_call);
    }
    return { role: String(m.role), parts, fields };
  });
  if (raw.attachments !== undefined) {
    const appended = parseDocumentAttachments(raw.attachments);
    const lastUser = messages.findLast((m) => m.role === 'user');
    if (!lastUser) throw new ChatInputError('Top-level attachments require a user message.');
    for (const file of appended) lastUser.parts.push(documentPart(file));
  }
  const options: ParsedConversation['options'] = {};
  // No rest-spread from the request reaches the upstream. Every option is
  // either a bounded generation control or content that joins the guard's
  // prompt and is normalized/masked before forwarding.
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'messages' || key === 'attachments') continue;
    if (['stream', 'parallel_tool_calls', 'logprobs', 'store'].includes(key)) {
      if (typeof value !== 'boolean') throw new ChatInputError(`${key} must be a boolean.`);
      options[key] = value;
    } else if (['temperature', 'top_p', 'n', 'max_tokens', 'max_completion_tokens', 'seed', 'frequency_penalty', 'presence_penalty', 'top_logprobs'].includes(key)) {
      const bounds: Record<string, [number, number, boolean]> = { temperature: [0, 2, false], top_p: [0, 1, false], n: [1, 8, true],
        max_tokens: [1, 131072, true], max_completion_tokens: [1, 131072, true], seed: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true],
        frequency_penalty: [-2, 2, false], presence_penalty: [-2, 2, false], top_logprobs: [0, 20, true] };
      const [min, max, integer] = bounds[key]!;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new ChatInputError(`Invalid ${key} generation setting.`);
      options[key] = value;
    } else if (key === 'model') {
      if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/.test(value) || sanitize(value).masked !== value) throw new ChatInputError('Use a plain model identifier of at most 200 characters.');
      options.model = value;
    } else if (key === 'tools' || key === 'functions') {
      if (!Array.isArray(value) || value.length > 64) throw new ChatInputError(`${key} must contain at most 64 function definitions.`);
      options[key] = value.map((entry) => {
        if (key === 'functions') return functionDefinition(entry);
        const tool = object(entry);
        onlyKeys(tool, ['type', 'function'], 'Tool definition');
        if (tool.type !== 'function') throw new ChatInputError('Only function tools are supported on this endpoint.');
        return { type: 'function', function: functionDefinition(tool.function) };
      });
    } else if (key === 'tool_choice' || key === 'function_call') {
      if (typeof value === 'string') {
        if (!['auto', 'none', ...(key === 'tool_choice' ? ['required'] : [])].includes(value)) throw new ChatInputError(`Unsupported ${key} setting.`);
        options[key] = value;
      } else {
        const choice = object(value);
        onlyKeys(choice, key === 'tool_choice' ? ['type', 'function'] : ['name'], key);
        if (key === 'tool_choice' && choice.type !== 'function') throw new ChatInputError('Only function tool selection is supported.');
        const fn = key === 'tool_choice' ? object(choice.function) : choice;
        onlyKeys(fn, ['name'], key); identifier(fn.name, 'Function name');
        options[key] = screened(choice);
      }
    } else if (key === 'response_format') {
      const format = object(value);
      if (format.type === 'json_schema') {
        onlyKeys(format, ['type', 'json_schema'], key);
        const schema = object(format.json_schema);
        onlyKeys(schema, ['name', 'description', 'schema', 'strict'], 'Response schema');
        identifier(schema.name, 'Response schema name'); object(schema.schema);
        if (schema.description !== undefined && typeof schema.description !== 'string') throw new ChatInputError('Response schema description must be text.');
        if (schema.strict !== undefined && typeof schema.strict !== 'boolean') throw new ChatInputError('Response schema strict must be a boolean.');
      } else if (format.type === 'json_object' || format.type === 'text') onlyKeys(format, ['type'], key);
      else throw new ChatInputError('Unsupported response format.');
      options[key] = screened(format);
    } else if (key === 'stop') {
      if (!(typeof value === 'string' && value.length <= 1024) && !(Array.isArray(value) && value.length <= 4 && value.every((v) => typeof v === 'string' && v.length <= 1024))) throw new ChatInputError('Stop sequences must contain at most four short strings.');
      options[key] = screened(value);
    } else if (key === 'stream_options') {
      const stream = object(value); onlyKeys(stream, ['include_usage', 'include_obfuscation'], key);
      if (Object.values(stream).some((v) => typeof v !== 'boolean')) throw new ChatInputError('Stream options must be booleans.');
      options[key] = stream;
    } else if (key === 'logit_bias') {
      const bias = object(value);
      if (Object.keys(bias).length > 1024 || Object.entries(bias).some(([token, weight]) => !/^\d{1,10}$/.test(token) || typeof weight !== 'number' || weight < -100 || weight > 100)) throw new ChatInputError('Invalid token bias settings.');
      options[key] = bias;
    } else if (['reasoning_effort', 'verbosity', 'service_tier'].includes(key)) {
      const accepted: Record<string, string[]> = { reasoning_effort: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'], verbosity: ['low', 'medium', 'high'], service_tier: ['auto', 'default', 'flex', 'priority'] };
      if (typeof value !== 'string' || !accepted[key]!.includes(value)) throw new ChatInputError(`Unsupported ${key} setting.`);
      options[key] = value;
    } else {
      throw new ChatInputError(`Unsupported request field: ${key.slice(0, 60)}. It was not forwarded.`);
    }
  }
  return { messages, prompt: texts.join('\n\n'), documents: parseDocumentAttachments(documents), options };
}

/** A positional match is required; a missing extraction is never an empty file. */
export function forwardedMessages(
  conversation: ParsedConversation,
  extracted: readonly { name: string; sha256: string; text: string }[]
): Record<string, unknown>[] {
  if (extracted.length !== conversation.documents.length) {
    throw new ChatInputError('Some attachments were not fully inspected. Nothing was forwarded.');
  }
  if (extracted.some((file, i) => file.sha256 !== createHash('sha256').update(Buffer.from(conversation.documents[i]!.data, 'base64')).digest('hex'))) {
    throw new ChatInputError('The extracted documents do not match the attached files. Nothing was forwarded.');
  }
  return conversation.messages.map((m) => ({
    ...m.fields,
    role: m.role,
    content: m.parts.length ? m.parts.map((part) => {
      if ('text' in part) return sanitize(normalizeUntrusted(part.text)).masked;
      const file = extracted[part.document]!;
      const name = sanitize(normalizeUntrusted(file.name)).masked.replace(/[\r\n]/g, ' ');
      return `\n--- Document: ${name} ---\n${file.text}\n--- End document ---\n`;
    }).join('\n') : null
  }));
}
