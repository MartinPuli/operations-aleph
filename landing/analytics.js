/** Purposeful, cookieless landing analytics. No automatic DOM capture.
 * Integration: initAnalytics({ enabled, projectToken, apiHost, productionHosts, debug }).
 * Optional second argument injects window/document/capture for isolated fixtures.
 * PostHog configuration: https://posthog.com/docs/libraries/js/config
 * CDN entrypoint materializes window.posthog; init runs only after script load.
 */
const EVENTS = new Set(['$pageview', 'download_clicked', 'download_options_opened', 'release_page_opened',
  'outbound_clicked', 'section_viewed', 'story_step_selected', 'story_replayed', 'tool_selected',
  'video_opened', 'video_started', 'video_progress', 'video_completed']);
const CHAPTERS = new Set(['write', 'hit', 'log', 'spend']);
const PLACEMENTS = new Set(['header', 'hero', 'download', 'footer', 'story', 'other']);
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const SECTIONS = new Set(['hero', 'how', 'spend', 'download', 'footer', ...[...CHAPTERS].map(x => `story_${x}`)]);
const mounted = new WeakMap();
const COOKILESS_ID = '$posthog_cookieless';
const noopController = () => ({ destroy() {}, status: 'disabled' });

export function sanitizeUTMs(search = '') {
  const result = {};
  const query = new URLSearchParams(search);
  for (const key of UTM_KEYS) {
    const value = query.get(key)?.toLowerCase();
    if (value && /^[a-z0-9_-]{1,60}$/.test(value)) result[key] = value;
  }
  return result;
}

function webURL(value, base) {
  try { const url = new URL(value, base); return /^https?:$/.test(url.protocol) ? url : null; }
  catch { return null; }
}

export function analyticsMode(config, location, dnt) {
  const url = webURL(location?.href || String(location));
  if (!url || ['1', 'yes'].includes(String(dnt).toLowerCase())) return { active: false, network: false, isTest: false };
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const token = typeof config.projectToken === 'string' && /^phc_[a-zA-Z0-9_-]{10,200}$/.test(config.projectToken);
  const localTest = local && new URLSearchParams(url.search).get('analytics_test') === '1';
  const production = !local && Array.isArray(config.productionHosts)
    && config.productionHosts.some(host => String(host).toLowerCase() === url.hostname);
  const network = !!(config.enabled && token && (production || localTest));
  const debug = !!config.debug;
  return { active: network || debug, network, isTest: localTest || debug, debug: debug || (localTest && network) };
}

export function classifyLink(href, base, placement = 'other', film = false) {
  const url = webURL(href, base), page = webURL(base);
  const props = { placement: PLACEMENTS.has(placement) ? placement : 'other' };
  if (!url || !page) return null;
  if (film && url.origin === page.origin && url.pathname.endsWith('/assets/launch/launch.mp4')) {
    return { name: 'video_opened', props: { ...props, video: 'launch' } };
  }
  if (url.origin === page.origin && url.pathname === page.pathname && url.hash === '#download') {
    return { name: 'download_options_opened', props };
  }
  if (url.origin !== 'https://github.com' || url.username || url.password) return null;
  const platforms = {
    '/Wardenlabs/warden/releases/latest/download/Warden-arm64.dmg': 'macos',
    '/Wardenlabs/warden/releases/latest/download/Warden-Setup.exe': 'windows',
  };
  if (platforms[url.pathname]) return { name: 'download_clicked', props: { ...props, platform: platforms[url.pathname] } };
  if (/^\/Wardenlabs\/warden\/releases(?:\/latest)?\/?$/.test(url.pathname)) return { name: 'release_page_opened', props };
  const labels = {
    '/Wardenlabs/warden': 'github', '/Wardenlabs/warden/': 'github',
    '/Wardenlabs/warden/blob/main/REPORT.md': 'report',
    '/Wardenlabs/warden/blob/main/BENCHMARKS.md': 'benchmarks',
  };
  return labels[url.pathname] ? { name: 'outbound_clicked', props: { ...props, destination: labels[url.pathname] } } : null;
}

export function isUserClick(event) {
  return event?.isTrusted === true && ((event.type === 'click' && event.button === 0)
    || (event.type === 'auxclick' && event.button === 1));
}

export function mergePlayed(ranges, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const sorted = ranges.filter(x => Array.isArray(x) && x.length === 2 && x.every(Number.isFinite))
    .map(([a, b]) => [Math.max(0, Math.min(duration, a)), Math.max(0, Math.min(duration, b))])
    .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

export function createVideoTracker(capture) {
  let opened = false, started = false, completed = false, played = [];
  const milestones = new Set();
  return {
    open() { opened = true; },
    playing(event) {
      if (!opened || started || event?.isTrusted !== true) return;
      started = true; capture('video_started', { video: 'launch' });
    },
    progress(ranges, duration, ended = false) {
      if (!started || !Number.isFinite(duration) || duration <= 0) return;
      played = mergePlayed([...played, ...ranges], duration);
      const coverage = played.reduce((sum, [a, b]) => sum + b - a, 0) / duration;
      for (const percent of [25, 50, 75, 90]) {
        if (coverage + 1e-9 >= percent / 100 && !milestones.has(percent)) {
          milestones.add(percent); capture('video_progress', { video: 'launch', percent });
        }
      }
      if (ended && coverage + 1e-9 >= .9 && !completed) {
        completed = true; capture('video_completed', { video: 'launch' });
      }
    },
  };
}

function cleanEventProps(name, props = {}) {
  const safe = {};
  if (PLACEMENTS.has(props.placement)) safe.placement = props.placement;
  if (name === 'download_clicked' && ['macos', 'windows'].includes(props.platform)) safe.platform = props.platform;
  if (name === 'outbound_clicked' && ['github', 'report', 'benchmarks'].includes(props.destination)) safe.destination = props.destination;
  if (name === 'section_viewed' && SECTIONS.has(props.section)) safe.section = props.section;
  if (name.startsWith('story_') && CHAPTERS.has(props.chapter)) safe.chapter = props.chapter;
  if (name === 'story_step_selected' && [0, 1, 2].includes(props.step)) safe.step = props.step;
  if (name === 'tool_selected' && ['claude_code', 'codex', 'opencode'].includes(props.tool)) safe.tool = props.tool;
  if (name.startsWith('video_')) safe.video = 'launch';
  if (name === 'video_progress' && [25, 50, 75, 90].includes(props.percent)) safe.percent = props.percent;
  return safe;
}

export function commonProperties(location, referrer, isTest = false, siteVersion = 'warden_story_v1') {
  const url = webURL(location?.href || String(location));
  const referral = webURL(referrer);
  const version = typeof siteVersion === 'string' && /^[a-z0-9_-]{1,60}$/.test(siteVersion) ? siteVersion : 'warden_story_v1';
  return { site_version: version, page_path: '/', is_test: !!isTest,
    ...sanitizeUTMs(url?.search), referrer_domain: referral?.hostname || 'direct' };
}

function safeUserAgent(value) {
  return typeof value === 'string' && /^[\x20-\x7e]{1,512}$/.test(value) ? value : '';
}

function browserMetadata(properties = {}) {
  const allowed = {
    $browser: ['Chrome', 'Chrome iOS', 'Mobile Chrome', 'Safari', 'Mobile Safari', 'Firefox', 'Firefox iOS',
      'Microsoft Edge', 'Edge', 'Opera', 'Opera Mini', 'Samsung Internet', 'Brave', 'IE', 'Other'],
    $os: ['Windows', 'Mac OS X', 'Linux', 'iOS', 'Android', 'Chrome OS', 'Other'],
    $device_type: ['Desktop', 'Mobile', 'Tablet'],
  };
  const result = {};
  for (const [key, values] of Object.entries(allowed)) {
    if (values.includes(properties[key])) result[key] = properties[key];
  }
  return result;
}

/** Rebuild properties; discard URLs, click IDs, text and client-generated identities.
 * Cookieless ingestion requires raw UA + host + request IP. The server hashes
 * these, supplies its own distinct/session IDs, then strips raw UA and IP.
 * Source: PostHog/posthog nodejs/src/ingestion/common/cookieless/cookieless-manager.ts
 */
export function makeBeforeSend(common, location, referrer, token, userAgent = '') {
  const page = webURL(location?.href || String(location)), referral = webURL(referrer);
  const transportUA = safeUserAgent(userAgent);
  return event => {
    if (!event || !EVENTS.has(event.event)) return null;
    const rawUserAgent = transportUA || safeUserAgent(event.properties?.$raw_user_agent);
    return { event: event.event, ...(event.uuid ? { uuid: event.uuid } : {}),
      ...(event.timestamp ? { timestamp: event.timestamp } : {}), properties: {
      ...cleanEventProps(event.event, event.properties), ...browserMetadata(event.properties), ...common,
      token, distinct_id: COOKILESS_ID, $cookieless_mode: true, $process_person_profile: false,
      ...(rawUserAgent ? { $raw_user_agent: rawUserAgent } : {}),
      $current_url: page?.origin || '', $host: page?.hostname || '', $pathname: '/',
      $referrer: referral?.origin || '', $referring_domain: referral?.hostname || '$direct', $lib: 'web',
    } };
  };
}

export function posthogOptions(config, beforeSend, loaded) {
  return {
    api_host: config.apiHost, capture_pageview: false, capture_pageleave: false, autocapture: false,
    capture_dead_clicks: false, rageclick: false, disable_session_recording: true, disable_surveys: true,
    capture_heatmaps: false, capture_performance: false, capture_exceptions: false,
    person_profiles: 'never', cookieless_mode: 'always', respect_dnt: true, disable_persistence: true,
    persistence: 'memory', advanced_disable_flags: true, enable_recording_console_log: false,
    mask_all_text: true, mask_all_element_attributes: true, request_batching: false,
    remote_config_refresh_interval_ms: 0, before_send: beforeSend, loaded,
  };
}

export function createEventQueue(limit = 64) {
  let adapter = null;
  const queue = [];
  const send = event => { try { adapter?.(event.name, event.props); return !!adapter; } catch { return false; } };
  return {
    push(name, props) {
      const event = { name, props };
      if (send(event)) return;
      if (queue.length < limit) queue.push(event);
    },
    attach(next) {
      adapter = next;
      while (queue.length && send(queue[0])) queue.shift();
    },
    pending: () => queue.slice(),
    clear: () => { queue.length = 0; },
  };
}

function placementOf(target) {
  if (target.closest('footer .links')) return 'footer';
  for (const [selector, label] of [['header', 'header'], ['.hero-zone', 'hero'], ['#download', 'download'], ['footer', 'footer'], ['.chapter', 'story']]) {
    if (target.closest(selector)) return label;
  }
  return 'other';
}

/** No automatic initialization, no dependency on the story module, no navigation interception. */
export function initAnalytics(config = {}, environment = {}) {
  const win = environment.window || globalThis.window, doc = environment.document || win?.document;
  if (!win || !doc) return noopController();
  if (mounted.has(doc)) return mounted.get(doc);
  const dnt = win.navigator?.doNotTrack || win.doNotTrack || win.navigator?.msDoNotTrack;
  const mode = analyticsMode(config, win.location, dnt);
  if (!mode.active) return noopController();
  const common = commonProperties(win.location, doc.referrer, mode.isTest, config.siteVersion);
  const beforeSend = makeBeforeSend(common, win.location, doc.referrer, config.projectToken, win.navigator?.userAgent);
  const queue = createEventQueue();
  const cleanup = [], handled = new WeakSet(), viewed = new Set(), timers = new Map(), inView = new Map();
  let destroyed = false, sdkState = mode.network ? 'loading' : 'local', panel = null, sdkTimeout;
  const listen = (element, type, handler, options) => {
    element?.addEventListener(type, handler, options);
    cleanup.push(() => element?.removeEventListener(type, handler, options));
  };
  if (mode.debug) {
    panel = doc.createElement('aside'); panel.id = 'warden-analytics-debug';
    panel.setAttribute('aria-label', 'Analytics test mode');
    panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;max-width:350px;padding:10px 13px;background:#101a20;color:#a2e5c8;border:1px solid #477b6e;border-radius:8px;font:12px/1.45 monospace;pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere';
    panel.textContent = `Analytics test mode · ${sdkState}`;
    doc.body?.append(panel);
  }
  function capture(name, props = {}) {
    if (destroyed || !EVENTS.has(name)) return;
    const safe = { ...cleanEventProps(name, props), ...common };
    if (panel) panel.textContent = `Analytics test mode · ${sdkState}\n${name}\n${JSON.stringify(safe)}`;
    if (environment.capture) { try { environment.capture(name, safe); } catch { /* measurement cannot break the page */ } }
    else if (mode.network) queue.push(name, safe);
  }
  const videoTracker = createVideoTracker(capture);
  const onClick = event => {
    if (!isUserClick(event) || handled.has(event)) return;
    handled.add(event);
    const target = event.target?.closest ? event.target : event.target?.parentElement;
    if (!target) return;
    const story = target.closest('[data-story-step], [data-story-replay]');
    if (story && event.type === 'click') {
      const chapter = story.closest('[data-chapter]')?.dataset.chapter;
      if (!CHAPTERS.has(chapter)) return;
      if (story.hasAttribute('data-story-replay')) capture('story_replayed', { chapter });
      else {
        const step = Number(story.dataset.storyStep);
        if ([0, 1, 2].includes(step)) capture('story_step_selected', { chapter, step });
      }
      return;
    }
    const link = target.closest('a[href]');
    if (!link) return;
    const result = classifyLink(link.href, win.location.href, placementOf(link), link.hasAttribute('data-open-film'));
    if (result) {
      if (result.name === 'video_opened') videoTracker.open();
      capture(result.name, result.props);
    }
  };
  listen(doc, 'click', onClick, true);
  listen(doc, 'auxclick', onClick, true);
  listen(doc, 'change', event => {
    if (event.isTrusted !== true || !event.target?.matches('input[type="radio"][name="tool"]')) return;
    const tool = { 'tool-cc': 'claude_code', 'tool-cx': 'codex', 'tool-oc': 'opencode' }[event.target.id];
    if (tool && event.target.checked) capture('tool_selected', { tool });
  }, true);

  const video = doc.getElementById('launch-video');
  const progress = event => {
    if (event.isTrusted !== true || !video) return;
    const ranges = [];
    try { for (let i = 0; i < Math.min(video.played.length, 100); i++) ranges.push([video.played.start(i), video.played.end(i)]); }
    catch { return; }
    videoTracker.progress(ranges, video.duration, event.type === 'ended');
  };
  listen(video, 'playing', event => videoTracker.playing(event));
  for (const type of ['timeupdate', 'pause', 'ended']) listen(video, type, progress);

  function cancelDwell(target) { win.clearTimeout(timers.get(target)); timers.delete(target); }
  function scheduleDwell(target, label) {
    if (doc.hidden || viewed.has(label) || timers.has(target) || !inView.get(target)) return;
    timers.set(target, win.setTimeout(() => {
      timers.delete(target);
      if (!destroyed && !doc.hidden && inView.get(target) && !viewed.has(label)) {
        viewed.add(label); capture('section_viewed', { section: label }); observer?.unobserve(target);
      }
    }, 800));
  }
  const labels = new Map();
  for (const [selector, label] of [['.hero-zone .copy', 'hero'], ['#how .main', 'how'], ['#spend .main', 'spend'], ['#download .dl', 'download'], ['footer .links', 'footer']]) {
    const target = doc.querySelector(selector); if (target) labels.set(target, label);
  }
  for (const chapter of CHAPTERS) {
    const target = doc.querySelector(`[data-chapter="${chapter}"] .panel`);
    if (target) labels.set(target, `story_${chapter}`);
  }
  const observer = win.IntersectionObserver ? new win.IntersectionObserver(entries => {
    for (const entry of entries) {
      const visible = entry.isIntersecting && entry.intersectionRatio >= .15;
      inView.set(entry.target, visible);
      if (visible) scheduleDwell(entry.target, labels.get(entry.target)); else cancelDwell(entry.target);
    }
  }, { threshold: [.15] }) : null;
  labels.forEach((_, target) => observer?.observe(target));
  listen(doc, 'visibilitychange', () => {
    labels.forEach((label, target) => { if (doc.hidden) cancelDwell(target); else scheduleDwell(target, label); });
  });

  // If navigation beats the SDK download, hand the bounded early queue to the
  // native beacon transport. Never delay a link, and never retry a blocked SDK.
  function unloadQueue() {
    if (!mode.network || sdkState !== 'loading' || !queue.pending().length || !win.navigator?.sendBeacon) return;
    const api = webURL(config.apiHost);
    if (!api || api.protocol !== 'https:') return;
    const batch = queue.pending().map(({ name, props }) => beforeSend({ event: name, properties: props }));
    try {
      const data = new win.Blob([JSON.stringify({ api_key: config.projectToken, batch })], { type: 'text/plain;charset=UTF-8' });
      if (win.navigator.sendBeacon(`${api.origin}/batch/`, data)) queue.clear();
    } catch { /* Browser shutdown or a blocker is not a page error. */ }
  }
  listen(win, 'pagehide', unloadQueue);
  capture('$pageview');

  if (mode.network && !environment.capture) {
    const api = webURL(config.apiHost);
    if (api?.protocol === 'https:') {
      const script = doc.createElement('script'); script.async = true; script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'origin';
      script.src = `${api.origin.replace('.i.posthog.com', '-assets.i.posthog.com')}/static/array.js`;
      const unavailable = () => {
        sdkState = 'unavailable'; queue.clear(); win.clearTimeout(sdkTimeout);
        if (panel) panel.textContent = 'Analytics test mode · SDK unavailable; page unaffected';
      };
      script.onerror = unavailable;
      script.onload = () => {
        if (destroyed || sdkState !== 'loading') return;
        try {
          if (typeof win.posthog?.init !== 'function') { unavailable(); return; }
          win.posthog.init(config.projectToken, posthogOptions({ ...config, apiHost: api.origin }, beforeSend, sdk => {
            if (destroyed) return;
            win.clearTimeout(sdkTimeout); sdkState = 'ready';
            queue.attach((name, props) => sdk.capture(name, props, { send_instantly: true, transport: 'sendBeacon' }));
            if (panel) panel.textContent += '\nSDK ready';
          }));
        } catch { unavailable(); }
      };
      sdkTimeout = win.setTimeout(unavailable, 10000);
      doc.head.append(script);
      cleanup.push(() => { script.onload = null; script.onerror = null; script.remove(); });
    } else { sdkState = 'unavailable'; queue.clear(); }
  }
  const controller = { status: mode.network ? 'enabled' : 'debug', destroy() {
    destroyed = true; observer?.disconnect(); labels.forEach((_, target) => cancelDwell(target));
    cleanup.forEach(fn => fn()); win.clearTimeout(sdkTimeout); queue.clear(); panel?.remove();
  } };
  mounted.set(doc, controller);
  return controller;
}
