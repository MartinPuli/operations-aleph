import { createKoolClient } from '@joinkool/sdk/server';

const PRODUCTION_ORIGIN = 'https://warden-theta.vercel.app';
const KOOL_ORIGIN = 'https://app.joinkool.co';
const EVENT = 'landing_download_clicked';
const MAX_BODY_BYTES = 1024;
const UUID_V4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const OPAQUE_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DELIVERY_STATES = new Set(['TEST', 'UNATTRIBUTED', 'ATTRIBUTED']);

class RequestError extends Error {
  constructor(status) { super('Invalid request'); this.status = status; }
}

function header(request, name) {
  const value = request.headers?.[name];
  return typeof value === 'string' ? value : '';
}

function allowedOrigin(request, env) {
  const origin = header(request, 'origin');
  let url;
  try { url = new URL(origin); } catch { return false; }
  // Origin must be a bare origin, and this endpoint never accepts cross-site requests.
  if (url.origin !== origin || url.username || url.password || url.host !== header(request, 'host')) return false;
  const fetchSite = header(request, 'sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;
  if (origin === PRODUCTION_ORIGIN) return true;
  if (env.VERCEL_ENV === 'preview' && typeof env.VERCEL_URL === 'string'
    && /^[a-z0-9][a-z0-9-]*\.vercel\.app$/i.test(env.VERCEL_URL)
    && origin === `https://${env.VERCEL_URL}`) return true;
  return env.VERCEL_ENV !== 'production' && env.NODE_ENV !== 'production'
    && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
}

async function readBody(request) {
  const mediaType = header(request, 'content-type');
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(mediaType)) throw new RequestError(415);
  const encoding = header(request, 'content-encoding');
  if (encoding && encoding !== 'identity') throw new RequestError(415);
  const length = header(request, 'content-length');
  if (length && !/^\d+$/.test(length)) throw new RequestError(400);
  if (length && Number(length) > MAX_BODY_BYTES) throw new RequestError(413);

  let body = request.body;
  if (body === undefined) {
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) throw new RequestError(413);
      chunks.push(buffer);
    }
    body = Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(body) || typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new RequestError(413);
    try { body = JSON.parse(body.toString()); } catch { throw new RequestError(400); }
  } else {
    try {
      if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) throw new RequestError(413);
    } catch (error) {
      if (error instanceof RequestError) throw error;
      throw new RequestError(400);
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(body))) throw new RequestError(400);
  if (Object.keys(body).some(key => !['eventId', 'platform', 'clickId'].includes(key))
    || !Object.hasOwn(body, 'eventId') || !Object.hasOwn(body, 'platform')
    || typeof body.eventId !== 'string' || !UUID_V4.test(body.eventId)
    || !['macos', 'windows'].includes(body.platform)
    || (Object.hasOwn(body, 'clickId') && (typeof body.clickId !== 'string' || !OPAQUE_ID.test(body.clickId)))) {
    throw new RequestError(400);
  }
  return body;
}

function configuration(env) {
  const ingestToken = env.KOOL_INGEST_TOKEN;
  if (env.KOOL_API_URL !== KOOL_ORIGIN || typeof ingestToken !== 'string'
    || !/^[\x21-\x7e]{1,4096}$/.test(ingestToken)) return null;
  return {
    apiUrl: KOOL_ORIGIN,
    ingestToken,
    test: !(env.KOOL_TEST_MODE === 'false' && env.VERCEL_ENV === 'production'),
  };
}

function respond(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}

/** The browser identifies an eligible installer activation; the server owns the
 * event name, allowed platforms, credential and test mode. No user data or free
 * properties are sent to Kool, and SDK retries preserve the opaque operation ID.
 */
export function createDownloadHandler({ env = process.env, fetch = globalThis.fetch } = {}) {
  return async function koolDownload(request, response) {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return respond(response, 405, { ok: false, error: 'Method not allowed' });
    }
    if (!allowedOrigin(request, env)) return respond(response, 403, { ok: false, error: 'Forbidden' });
    let input;
    try { input = await readBody(request); }
    catch (error) {
      const status = error instanceof RequestError ? error.status : 400;
      return respond(response, status, { ok: false, error: 'Invalid request' });
    }
    const config = configuration(env);
    if (!config) return respond(response, 503, { ok: false, error: 'Event service unavailable' });
    try {
      const client = createKoolClient({ apiUrl: config.apiUrl, ingestToken: config.ingestToken, fetch });
      const delivery = await client.track({
        event: EVENT,
        eventId: input.eventId,
        ...(Object.hasOwn(input, 'clickId') ? { clickId: input.clickId } : {}),
        test: config.test,
      });
      if (!OPAQUE_ID.test(delivery.id) || !DELIVERY_STATES.has(delivery.status)
        || typeof delivery.duplicate !== 'boolean') throw new Error('Invalid delivery');
      return respond(response, 200, { ok: true, delivery: {
        id: delivery.id, status: delivery.status, duplicate: delivery.duplicate,
      } });
    } catch {
      return respond(response, 502, { ok: false, error: 'Event delivery failed' });
    }
  };
}
