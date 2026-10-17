// Tiny localStorage cache for "show the last thing we saw instantly, then
// refresh" screens (order list, profile). Every access is wrapped in
// try/catch — storage can be full, disabled (private mode) or throw — and a
// failure just means "no cache", never a broken page.
//
// Entries are keyed by the tail of the auth token so one account never sees
// another's cached data on a shared device, and clearCachedData() wipes
// everything on logout. Only plain read-only lists belong here — never
// payment, receipt or admin-action data.
const PREFIX = 'cache:v1:'

const scopedKey = (key, token) => `${PREFIX}${key}:${String(token || '').slice(-10)}`

export function readCachedData(key, token) {
  try {
    const raw = localStorage.getItem(scopedKey(key, token))
    if (!raw) return null
    return JSON.parse(raw).data ?? null
  } catch {
    return null
  }
}

export function writeCachedData(key, token, data) {
  try {
    localStorage.setItem(scopedKey(key, token), JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    // Quota exceeded / storage unavailable — skip caching.
  }
}

export function removeCachedData(key, token) {
  try {
    localStorage.removeItem(scopedKey(key, token))
  } catch {
    // ignore
  }
}

export function clearCachedData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}
