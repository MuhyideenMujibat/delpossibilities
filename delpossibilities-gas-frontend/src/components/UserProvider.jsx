import { useEffect, useMemo, useRef, useState } from 'react'
import { UserContext } from '../userContext'
import { apiFetch } from '../api'

// Fetches GET /user once per token (login/logout) and shares it — before
// this, StudentHeader, HeaderUserMenu, Home's greeting strip, CreateOrder,
// and Cart each independently fetched the same /user resource on every
// mount, which visibly queued up behind the dev server on pages that mount
// several of them at once (e.g. "/" or "/cart"). Call refresh() after an
// action that changes the user server-side (a profile edit, a purchase that
// spends referral credit) to pull a fresh copy instead of waiting on the
// next token change.
export function UserProvider({ token, children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(token))
  const requestId = useRef(0)

  const refresh = () => {
    const id = ++requestId.current

    if (!token) {
      setUser(null)
      setLoading(false)
      return Promise.resolve()
    }

    setLoading(true)
    return apiFetch('/user', { token })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (id === requestId.current) setUser(data)
      })
      .catch(() => {})
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const value = useMemo(() => ({ user, loading, refresh }), [user, loading])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
