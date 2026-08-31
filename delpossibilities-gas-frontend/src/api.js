export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api'
export const SERVER_BASE = import.meta.env.VITE_SERVER_BASE || 'http://127.0.0.1:8000'

// Matches the backend's Sanctum token expiration (config/sanctum.php) — the
// frontend proactively logs the user out at the same threshold instead of
// waiting for the next API call to 401. 60 days, not a short session, since
// students refill roughly monthly rather than daily.
export const SESSION_DURATION_MS = 60 * 24 * 60 * 60 * 1000

// The Laravel API returns storage URLs as host-relative paths (e.g.
// "/storage/cylinders/..."), which resolve against the Vite dev origin
// instead of the API host when used directly as an <img src>. Absolute
// URLs (e.g. once APP_URL is set correctly) are passed through untouched.
export function resolveImageUrl(url) {
  if (!url) return url
  return url.startsWith('/') ? `${SERVER_BASE}${url}` : url
}

// Wraps fetch for API calls. Always sends Accept: application/json so Laravel
// returns JSON error responses instead of redirecting (its default behavior
// for requests that don't explicitly ask for JSON).
export function apiFetch(path, { method = 'GET', token, body, headers = {} } = {}) {
  const isFormData = body instanceof FormData

  const finalHeaders = {
    Accept: 'application/json',
    ...headers,
  }

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`
  }

  let finalBody = body
  if (body !== undefined && !isFormData) {
    finalHeaders['Content-Type'] = 'application/json'
    finalBody = JSON.stringify(body)
  }

  return fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: finalBody,
  }).then((response) => {
    // A 401 on a request that carried a token means the session (e.g. the
    // 60-day Sanctum token expiry) is no longer valid — tell the app to log
    // out. Requests without a token (login, forgot-password) 401ing is just
    // "wrong credentials" and shouldn't trigger this.
    if (token && response.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return response
  })
}

// Determines the logged-in user's role after login/register. Uses the role
// embedded in the auth response if present, otherwise falls back to GET /api/user.
export async function resolveRole(token, authResponseData) {
  const roleFromAuth = authResponseData?.user?.role || authResponseData?.role
  if (roleFromAuth) return roleFromAuth

  try {
    const response = await apiFetch('/user', { token })
    if (!response.ok) return null
    const data = await response.json()
    return data?.user?.role || data?.role || null
  } catch {
    return null
  }
}

// Mirrors resolveRole — the permission_keys the account holds, embedded on
// every login/register-verify/GET-user response via User::$appends on the
// backend. Super admins hold every key implicitly (see the model accessor).
export async function resolvePermissions(token, authResponseData) {
  const fromAuth = authResponseData?.user?.permission_keys || authResponseData?.permission_keys
  if (fromAuth) return fromAuth

  try {
    const response = await apiFetch('/user', { token })
    if (!response.ok) return []
    const data = await response.json()
    return data?.user?.permission_keys || data?.permission_keys || []
  } catch {
    return []
  }
}

export const STATUS_LABELS = {
  pending: 'Pending Payment',
  approved: 'Approved – Awaiting Pickup',
  picked_up: 'Picked Up – Refilling',
  delivered: 'Delivered',
}

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

// Orders in "pending" status haven't been paid for yet, so they're excluded
// from revenue figures. Paystack's webhook flips status to "approved" once
// payment clears (see PaystackWebhookController).
export const PAID_STATUSES = ['approved', 'picked_up', 'delivered']

export function formatNaira(amount) {
  const value = Number(amount)
  if (Number.isNaN(value)) return '₦0'
  return `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(value)}`
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function whatsappUrl(phone, message = '') {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  const normalized = digits.startsWith('0') ? `234${digits.slice(1)}` : digits
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${normalized}${text}`
}

// Applies the shared search/status/date-range filter set used by the student
// "My Orders" view and the admin dashboard/reports/payments tables.
// `getSearchText` lets each caller decide which order fields are searchable
// (e.g. admin also matches on student name). `dateField` lets the payments
// table filter by when an order was paid rather than when it was created.
export function filterOrders(orders, { search = '', status = 'all', hostel = 'all', from = '', to = '' } = {}, getSearchText, dateField = 'created_at') {
  const term = search.trim().toLowerCase()
  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to) : null
  if (toDate) toDate.setHours(23, 59, 59, 999)

  return orders.filter((order) => {
    if (status !== 'all' && order.status !== status) return false
    if (hostel === 'off_campus' && order.location_type !== 'off_campus') return false
    if (hostel !== 'all' && hostel !== 'off_campus' && order.hostel_address !== hostel) return false

    const dateValue = order[dateField] || order.created_at
    const compareDate = dateValue ? new Date(dateValue) : null
    if (fromDate && (!compareDate || compareDate < fromDate)) return false
    if (toDate && (!compareDate || compareDate > toDate)) return false

    if (term) {
      const haystack = (getSearchText ? getSearchText(order) : order.hostel_address || '').toLowerCase()
      if (!haystack.includes(term)) return false
    }

    return true
  })
}
