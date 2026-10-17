import { apiFetch } from './api'
import { readCachedData, writeCachedData } from './offlineCache'

// The public pages used to fire /price, /hostels, /delivery-zones and
// /eazy-market-delivery-tiers one after another — on a slow or single-threaded
// server each waits behind the others. GET /bootstrap returns all of them in
// one request; publicFetch() below hands each caller its slice shaped like a
// normal fetch Response, so existing call sites only swap apiFetch -> publicFetch.
//
// Payment-time data (e.g. /payment-gateways inside usePaymentCheckout) is
// deliberately NOT routed through here — it always asks the server live.
const KEYS = {
  '/price': 'price',
  '/hostels': 'hostels',
  '/delivery-zones': 'delivery_zones',
  '/eazy-market-delivery-tiers': 'eazy_market_tiers',
  '/subscription-plans': 'subscription_plans',
}

const CACHE_KEY = 'public-data'
// Reuse within one visit; a full page load always asks again.
const MEMO_TTL_MS = 60 * 1000

let memo = null
let memoAt = 0
let inflight = null

function loadBootstrap() {
  if (memo && Date.now() - memoAt < MEMO_TTL_MS) return Promise.resolve(memo)
  if (inflight) return inflight

  inflight = apiFetch('/bootstrap')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data) {
        memo = data
        memoAt = Date.now()
        writeCachedData(CACHE_KEY, '', data)
      }
      return data
    })
    .catch(() => null)
    .finally(() => {
      inflight = null
    })

  return inflight
}

// Drop-in for apiFetch() on the paths above; anything else (or a failed
// bootstrap) falls straight through to the individual endpoint.
export async function publicFetch(path, options) {
  const key = KEYS[path]
  if (!key) return fetchAndRemember(path, options)

  const data = await loadBootstrap()
  if (data && data[key] !== undefined) {
    return new Response(JSON.stringify(data[key]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  return apiFetch(path, options)
}

// Paths outside the bootstrap bundle (e.g. the product catalog, which takes a
// ?group= filter) are fetched normally, but the last answer is remembered so
// peekPublicData() can paint it instantly next time.
async function fetchAndRemember(path, options) {
  const response = await apiFetch(path, options)

  if (response.ok && path.startsWith('/products')) {
    response
      .clone()
      .json()
      .then((data) => writeCachedData(`public-get:${path}`, '', data))
      .catch(() => {})
  }

  return response
}

// Last known value, synchronously (memory, then localStorage) — lets a page
// paint its dropdowns/fees immediately while the fresh copy loads. Null if none.
export function peekPublicData(path) {
  const key = KEYS[path]
  if (!key) return readCachedData(`public-get:${path}`, '')
  return (memo ?? readCachedData(CACHE_KEY, ''))?.[key] ?? null
}
