export const API_BASE = 'http://127.0.0.1:8000/api'
export const SERVER_BASE = 'http://127.0.0.1:8000'

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

export const STATUS_LABELS = {
  pending: 'Pending Payment',
  approved: 'Approved – Awaiting Pickup',
  picked_up: 'Picked Up – Refilling',
  delivered: 'Delivered',
}
