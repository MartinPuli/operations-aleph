/**
 * The OpenAI-compatible front door.
 *
 * Tools that let you set a base URL — Cursor, Open WebUI, any script using the
 * OpenAI SDK — point here and get policy enforcement without a line of code
 * changing on their side. This is the secondary path; the hook (src/hook/cli.ts)
 * is what covers tools authenticated by subscription, where no base URL exists
 * to redirect.
 *
 * Identity arrives as an API key, because that is the one credential field
 * every client already has. Per-employee Warden keys also mean the company's
 * real upstream credential never leaves this machine: an employee cannot go
 * around the gateway, because they have nothing to go around it with.
 */
import type { Request, Response } from 'express';
import { evaluate } from '../guard/pipeline.js';
import { screenOutput, screensOutput } from '../guard/output.js';
import type { Actor, Decision } from '../guard/types.js';
import { actorForCredential } from '../policy/people.js';
import { loadPolicy, rulesForActor } from '../policy/store.js';
import { adapter } from '../qvac/index.js';
import { ChatInputError, forwardedMessages, parseConversation } from './content.js';

/** The local model that answers allowed prompts. Cloud is out by track rules. */
const UPSTREAM = process.env['WARDEN_UPSTREAM'] ?? 'http://localhost:11434';
const UPSTREAM_KEY = process.env['WARDEN_UPSTREAM_KEY'] ?? 'not-needed-locally';
const UPSTREAM_MODEL = process.env['WARDEN_UPSTREAM_MODEL'] ?? 'warden';

/**
 * `baseline` puts the rules in the model's system prompt and turns the guard
 * off — what a team ships without this project. The red-team harness runs both
 * modes over the same corpus, and the gap between them is the result we report.
 */
const MODE = process.env['WARDEN_MODE'] === 'baseline' ? 'baseline' : 'warden';

/**
 * Resolve the caller — the API key, and nothing else.
 *
 * There used to be a header fallback here for the web console's person
 * switcher. It is gone: two ways to say who you are means the weaker one is the
 * one that gets used, and the weaker one was a header any client could set. The
 * console now sends the selected person's key, which has the useful side effect
 * of exercising the same path an employee's tool does.
 */
function resolveActor(req: Request): Actor | null {
  const employee = actorForCredential(req.header('authorization'));
  return employee ? { id: employee.id, role: employee.role } : null;
}

/** Rules folded into a system prompt — the baseline everyone else ships. */
function baselineSystemPrompt(actor: Actor): string {
  // Every rule, both sides: this is a system prompt governing a whole
  // conversation, not one direction of it, and the baseline is what a team
  // ships when they have no gateway — they would paste all of them.
  const rules = rulesForActor(loadPolicy(), actor, 'any')
    .map((r) => `- ${r.text}`)
    .join('\n');
  return `You are a company assistant. Follow these rules at all times:\n${rules}`;
}

export async function handleChatCompletion(
  req: Request,
  res: Response,
  emit: (decision: unknown) => void
): Promise<void> {
  const controller = new AbortController();
  const abort = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', abort);
  if (res.destroyed) controller.abort();
  try {
    if (!controller.signal.aborted) await handleConnectedChatCompletion(req, res, emit, controller.signal);
  } catch (err) {
    // A disconnected client has nowhere to receive an error. Fetch body reads
    // also reject on abort, including while an output is being held to screen.
    if (!controller.signal.aborted && !res.destroyed) throw err;
  } finally {
    res.off('close', abort);
  }
}

async function handleConnectedChatCompletion(
  req: Request,
  res: Response,
  emit: (decision: unknown) => void,
  signal: AbortSignal
): Promise<void> {
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({
      error: { code: 'invalid_api_key', message: 'Unknown Warden API key. Ask your administrator for one.' }
    });
    return;
  }

  const body = req.body as {
    messages?: unknown[];
    stream?: boolean;
    model?: string;
    attachments?: unknown;
  };
  let conversation;
  try {
    conversation = parseConversation(body);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    res.status(status).json({ error: { code: 'unreadable_content', message: err instanceof Error ? err.message : 'The request could not be inspected.' } });
    return;
  }
  let outbound: unknown[];

  if (MODE === 'warden') {
    const decision: Decision = await evaluate(adapter(), {
      actor, prompt: conversation.prompt, documents: conversation.documents, signal
    }, loadPolicy());
    emit(decision);
    if (signal.aborted || res.destroyed) return;

    if (decision.verdict === 'BLOCK') {
      const quotaHit = decision.quota && decision.quota.limit > 0 && decision.quota.used >= decision.quota.limit;
      res.status(quotaHit ? 429 : 403).json({
        error: {
          code: quotaHit ? 'quota_exceeded' : 'policy_block',
          message: decision.explanation,
          rule: decision.firedRules[0]?.ruleText,
          auditId: decision.auditId,
          ...(quotaHit ? { used: decision.quota?.used, limit: decision.quota?.limit } : {})
        }
      });
      return;
    }

    if (decision.verdict === 'ESCALATE') {
      res.status(202).json({
        escalationId: decision.auditId,
        message: decision.explanation,
        rule: decision.firedRules[0]?.ruleText
      });
      return;
    }

    // Only an explicit ALLOW is forwarded. Falling through on "not BLOCK and
    // not ESCALATE" would make any unexpected verdict value fail open, and the
    // one invariant of this design is that nothing fails in that direction.
    if (decision.verdict !== 'ALLOW') {
      res.status(202).json({ escalationId: decision.auditId, message: decision.explanation });
      return;
    }

    try {
      outbound = forwardedMessages(conversation, decision.maskedDocuments ?? []);
    } catch (err) {
      if (!(err instanceof ChatInputError)) throw err;
      res.status(422).json({ error: { code: 'incomplete_inspection', message: err.message } });
      return;
    }
  } else {
    // Baseline is a benchmark control, with no document inspection. Explicitly
    // reject attachments there instead of mislabelling raw file forwarding as
    // supported document handling.
    if (conversation.documents.length) {
      res.status(400).json({ error: { code: 'baseline_text_only', message: 'Document inspection requires Warden mode.' } });
      return;
    }
    outbound = [{ role: 'system', content: baselineSystemPrompt(actor) }, ...(body.messages ?? [])];
  }

  const payload = { ...conversation.options, messages: outbound, model: conversation.options.model ?? UPSTREAM_MODEL };
  if (signal.aborted || res.destroyed) return;

  /**
   * Screening the answer costs the stream, so it is bought only when the policy
   * asks for it.
   *
   * There is no version of this that streams. Tokens leave as they arrive, and
   * a rule that fires on the last sentence cannot recall the first — so an
   * answer that is going to be judged has to be complete before anyone reads
   * it. A policy with no output-scoped rules never pays that, and relays token
   * by token exactly as before.
   */
  if (MODE === 'warden' && screensOutput(loadPolicy(), actor)) {
    await forwardScreened(res, payload, actor, emit, signal);
    return;
  }

  await forward(res, payload, signal);
}

/**
 * Relay, but hold the answer until it has been judged.
 *
 * The upstream call is made non-streaming whatever the client asked for,
 * because a screened answer has to exist in full before it can be screened. A
 * client that wanted a stream still gets one — the approved answer is emitted
 * as a single chunk followed by `[DONE]`, which is a valid, if short, stream.
 */
async function forwardScreened(
  res: Response,
  payload: { messages: unknown[]; model: string; stream?: boolean },
  actor: Actor,
  emit: (decision: unknown) => void,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted || res.destroyed) return;
  const wantsStream = payload.stream === true;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(`${UPSTREAM}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${UPSTREAM_KEY}` },
      body: JSON.stringify({ ...payload, stream: false }),
      signal
    });
  } catch (err) {
    if (signal.aborted || res.destroyed) return;
    res.status(502).json({
      error: {
        code: 'upstream_unreachable',
        message:
          `Could not reach the model at ${UPSTREAM}. ` +
          `Start it with: pnpm dlx @qvac/cli serve openai  (${err instanceof Error ? err.message : err})`
      }
    });
    return;
  }

  const raw = await upstream.text();
  if (signal.aborted || res.destroyed) return;
  if (!upstream.ok) {
    // Upstream's own error, passed through untouched. Judging it would be
    // judging a failure message as if the model had said it.
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    res.send(raw);
    return;
  }

  let parsed: { choices: { index?: unknown; message: unknown; finish_reason?: unknown; logprobs?: unknown }[]; usage?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
    if (!Array.isArray(parsed.choices) || !parsed.choices.length || parsed.choices.length > 8) throw new Error('invalid choices');
  } catch {
    res.status(502).json({ error: { code: 'upstream_unparseable', message: 'The model returned an unreadable answer. Nothing was forwarded.' } });
    return;
  }

  const choices: { index: number; message: Record<string, unknown>; finish_reason: string | null }[] = [];
  let auditId = '';
  for (const [index, choice] of parsed.choices.entries()) {
    let conversation;
    try {
      if (!choice || typeof choice !== 'object' || Object.keys(choice).some((key) => !['index', 'message', 'finish_reason', 'logprobs'].includes(key))) throw new Error('unsupported choice fields');
      if (choice.logprobs !== undefined && choice.logprobs !== null) throw new Error('token log probabilities cannot be screened');
      if (choice.index !== undefined && choice.index !== index) throw new Error('invalid choice index');
      const message = choice.message as { role?: unknown; refusal?: unknown; [key: string]: unknown };
      if (!message || message.role !== 'assistant') throw new Error('invalid assistant response');
      // A refusal is text too. Put it into readable content before inspecting
      // it instead of preserving a second unscreened output field.
      const { refusal, ...fields } = message;
      if (refusal !== undefined && refusal !== null) {
        if (typeof refusal !== 'string') throw new Error('invalid refusal');
        if (fields.content === null || fields.content === undefined) fields.content = refusal;
        else if (typeof fields.content === 'string') fields.content += `\n${refusal}`;
        else throw new Error('unsupported refusal content');
      }
      conversation = parseConversation({ messages: [fields] });
      if (conversation.documents.length) throw new Error('attachment output cannot be screened');
      if (choice.finish_reason !== undefined && choice.finish_reason !== null && !['stop', 'length', 'tool_calls', 'function_call', 'content_filter'].includes(String(choice.finish_reason))) throw new Error('unsupported finish reason');
    } catch {
      res.status(502).json({ error: { code: 'unsupported_output', message: 'The model returned output that could not be completely inspected. Nothing was forwarded.' } });
      return;
    }

    // Every returned alternative is a distinct answer. Screening one and then
    // returning the entire provider object would expose the unchecked choices
    // and any instructions placed in function-call arguments.
    const decision = await screenOutput(adapter(), { actor, text: conversation.prompt, policy: loadPolicy() });
    emit(decision);
    if (signal.aborted || res.destroyed) return;
    auditId = decision.auditId;
    if (decision.verdict !== 'ALLOW') {
      res.status(decision.verdict === 'BLOCK' ? 403 : 202).json({ error: {
        code: decision.verdict === 'BLOCK' ? 'policy_block_output' : 'policy_escalate_output',
        message: decision.explanation, rule: decision.firedRules[0]?.ruleText, auditId: decision.auditId, side: 'output'
      } });
      return;
    }
    choices.push({ index, message: forwardedMessages(conversation, [])[0]!, finish_reason: choice.finish_reason === undefined ? 'stop' : choice.finish_reason as string | null });
  }

  // Rebuild the response from inspected messages and bounded protocol values.
  // Arbitrary provider extension fields cannot carry another unchecked answer.
  const safe = { id: `chatcmpl-${auditId}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: payload.model, choices,
    ...(safeUsage(parsed.usage) ? { usage: safeUsage(parsed.usage) } : {}) };
  if (!wantsStream) {
    res.status(200).json(safe);
    return;
  }

  res.status(200).setHeader('content-type', 'text/event-stream');
  const chunk = { ...safe, object: 'chat.completion.chunk', choices: choices.map((choice) => ({ index: choice.index,
    delta: { ...choice.message, ...(Array.isArray(choice.message.tool_calls) ? { tool_calls: choice.message.tool_calls.map((call, i) => ({ index: i, ...call })) } : {}) },
    finish_reason: choice.finish_reason })) };
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}


/** Usage counters are useful metadata, never arbitrary provider text. */
function safeUsage(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    const count = raw[key];
    if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) out[key] = count;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Relay to the upstream model, streaming straight through.
 *
 * Real clients stream, so buffering the whole response would make the gateway
 * feel broken even when it is working.
 */
async function forward(res: Response, payload: unknown, signal: AbortSignal): Promise<void> {
  if (signal.aborted || res.destroyed) return;
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(`${UPSTREAM}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${UPSTREAM_KEY}` },
      body: JSON.stringify(payload),
      signal
    });
  } catch (err) {
    if (signal.aborted || res.destroyed) return;
    res.status(502).json({
      error: {
        code: 'upstream_unreachable',
        message:
          `Could not reach the model at ${UPSTREAM}. ` +
          `Start it with: pnpm dlx @qvac/cli serve openai  (${err instanceof Error ? err.message : err})`
      }
    });
    return;
  }

  if (signal.aborted || res.destroyed) return;
  res.status(upstream.status);
  const contentType = upstream.headers.get('content-type');
  if (contentType) res.setHeader('content-type', contentType);

  if (!upstream.body) {
    res.end();
    return;
  }

  // Headers are already out, so a mid-stream failure cannot become a status
  // code — but it must still end the response rather than park the client on a
  // connection nobody will ever close. The request's abort signal also stops
  // the upstream read when the client walks away.
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || signal.aborted || res.destroyed) break;
      res.write(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
    if (!signal.aborted && !res.destroyed) res.end();
  }
}
