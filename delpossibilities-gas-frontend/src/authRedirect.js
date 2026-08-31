// Where to send someone once they finish logging in / verifying — set right
// before routing a guest to /login from a spot that has its own "come back
// here" destination (e.g. "Log in to invest" on the investment section, or
// "Log In to Order" on the order wizard).
//
// This exists alongside the router's `location.state.from` because the
// /login and /register routes also carry an "already authenticated" guard
// that would otherwise fire its own <Navigate> the instant setToken lands —
// racing, and usually beating, the Login component's own navigate(from).
// Persisting the target here lets BOTH paths agree on the same destination,
// so the guest reliably ends up where they started instead of on "/".
const KEY = 'postAuthRedirect'

export function setPostAuthRedirect(path) {
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // Storage full/unavailable — worst case they land on the default page.
  }
}

// Reads and clears in one step — used by the Login/Register submit handlers,
// which run exactly once per auth attempt, so the key never goes stale.
export function takePostAuthRedirect() {
  try {
    const value = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return value || null
  } catch {
    return null
  }
}

// Reads WITHOUT clearing — for the "already signed in" route guard, which
// renders (and in StrictMode renders twice) and must stay side-effect-free.
// The guard can briefly win the post-login render race against the Login
// component's own navigate(); reading the same target here means both land
// on the same page instead of the guard falling back to "/".
export function peekPostAuthRedirect() {
  try {
    return sessionStorage.getItem(KEY) || null
  } catch {
    return null
  }
}
