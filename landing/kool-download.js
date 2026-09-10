import { captureAttribution, getAttribution } from './assets/kool/browser.mjs';
import { classifyLink, isUserClick } from './analytics.js?v=launch-1';

// Independent from PostHog: only a real installer activation creates an event.
const initialized = new WeakMap();
export function initKoolDownloads(win = window, doc = document) {
  if (initialized.has(doc)) return initialized.get(doc);
  if (['1', 'yes'].includes(String(win.navigator?.doNotTrack || win.doNotTrack).toLowerCase())) return;
  if (!['http:', 'https:'].includes(win.location.protocol)) return;
  let storage;
  try { storage = win.localStorage; } catch { storage = null; }
  const captured = captureAttribution({ url: win.location.href, storage });
  // Keep a current URL reference in memory only when storage could not save it.
  // Never extend an older stored reference's expiry just by loading the landing.
  const fallback = new URL(win.location.href).searchParams.get('kool_cid') === captured
    && getAttribution({ storage }) !== captured ? captured : null;
  const capturedAt = Date.now();
  const seen = new WeakSet();
  const onClick = event => {
    if (!isUserClick(event) || event.defaultPrevented || seen.has(event)) return;
    const link = event.target?.closest?.('a[href]');
    if (!link) return;
    const result = classifyLink(link.href, win.location.href);
    if (result?.name !== 'download_clicked') return;
    seen.add(event);
    try {
      // Snapshot attribution with this result; every SDK retry keeps this ID/body.
      const clickId = (Date.now() - capturedAt < 90 * 24 * 60 * 60 * 1000 ? fallback : null)
        || getAttribution({ storage });
      const body = { eventId: win.crypto.randomUUID(), platform: result.props.platform };
      if (clickId) body.clickId = clickId;
      // A same-origin request survives navigation; cookies and the full URL are omitted.
      void win.fetch('/api/kool-download', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer',
      }).catch(() => {});
    } catch { /* Measurement must never interrupt the native download link. */ }
  };
  doc.addEventListener('click', onClick);
  doc.addEventListener('auxclick', onClick);
  const controller = { destroy() {
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('auxclick', onClick);
    initialized.delete(doc);
  } };
  initialized.set(doc, controller);
  return controller;
}
