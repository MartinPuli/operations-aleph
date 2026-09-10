const STORAGE_KEY = "kool.attribution.v1"
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const CLICK_ID = /^[a-zA-Z0-9_-]{1,128}$/

function context(options) {
  let storage = options.storage
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage
    } catch {
      storage = null
    }
  }
  return { storage, now: options.now ?? Date.now() }
}

/** Read a click ID saved by captureAttribution; storage failures are harmless. */
export function getAttribution(options = {}) {
  const { storage, now } = context(options)
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null")
    if (
      !saved ||
      typeof saved.clickId !== "string" ||
      !CLICK_ID.test(saved.clickId) ||
      !Number.isFinite(saved.savedAt) ||
      saved.savedAt > now ||
      now - saved.savedAt >= MAX_AGE_MS
    ) {
      storage?.removeItem(STORAGE_KEY)
      return null
    }
    return saved.clickId
  } catch {
    return null
  }
}

/** Save the latest kool_cid, without storing the URL or any other query field. */
export function captureAttribution(options = {}) {
  const { storage, now } = context(options)
  const url = options.url ?? globalThis.location?.href
  if (url) {
    try {
      const clickId = new URL(url).searchParams.get("kool_cid")
      if (clickId && CLICK_ID.test(clickId)) {
        try {
          storage?.setItem(STORAGE_KEY, JSON.stringify({ clickId, savedAt: now }))
        } catch {
          /* Storage may be disabled. */
        }
        return clickId
      }
    } catch {
      /* Invalid URLs do not discard existing attribution. */
    }
  }
  return getAttribution({ storage, now })
}

export function clearAttribution(options = {}) {
  try {
    context(options).storage?.removeItem(STORAGE_KEY)
  } catch {
    /* No-op if storage is blocked. */
  }
}
