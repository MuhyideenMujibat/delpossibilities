import { useState, useEffect, useRef } from 'react'
import { Bell, BellRing, BellOff, CheckCheck } from 'lucide-react'
import { apiFetch, formatDate } from './api'

const POLL_INTERVAL_MS = 30000
const ALERTS_STORAGE_KEY = 'notif_alerts_enabled'

// A short two-tone chime via the Web Audio API — no external sound file to
// ship, and it plays even though the tab was just quietly polling in the
// background (unlike <audio>, nothing needs to preload).
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime

    ;[880, 1108.73].forEach((freq, i) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.28)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(now + i * 0.12)
      oscillator.stop(now + i * 0.12 + 0.3)
    })

    setTimeout(() => ctx.close(), 700)
  } catch {
    // Web Audio unsupported/blocked — silently skip, the visual badge still updates.
  }
}

function showBrowserNotification(notification) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

  try {
    new Notification(notification.title, { body: notification.body, tag: `order-notification-${notification.id}` })
  } catch {
    // Some browsers (mobile Chrome) require a service worker for this — skip quietly.
  }
}

function NotificationBell({ token }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(() => localStorage.getItem(ALERTS_STORAGE_KEY) === 'true')
  const menuRef = useRef(null)
  const previousUnreadCount = useRef(null)

  useEffect(() => {
    let cancelled = false

    const fetchNotifications = () => {
      apiFetch('/notifications', { token })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data) return

          const nextUnreadCount = data.unread_count || 0
          const isFirstLoad = previousUnreadCount.current === null

          // Only alert on unread count actually going *up* from what we last
          // saw — not on the first load (which would fire for old unread
          // items every time the page opens) and not on drops from reading.
          if (alertsEnabled && !isFirstLoad && nextUnreadCount > previousUnreadCount.current) {
            playChime()
            const newest = (data.notifications || [])[0]
            if (newest) showBrowserNotification(newest)
          }

          previousUnreadCount.current = nextUnreadCount
          setNotifications(data.notifications || [])
          setUnreadCount(nextUnreadCount)
        })
        .catch(() => {})
    }

    fetchNotifications()
    const intervalId = setInterval(fetchNotifications, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [token, alertsEnabled])

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleAlerts = () => {
    const next = !alertsEnabled
    setAlertsEnabled(next)
    localStorage.setItem(ALERTS_STORAGE_KEY, String(next))

    // Requesting permission needs a user gesture in most browsers, so this
    // only ever happens from this click — never automatically on page load.
    if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const markRead = async (notification) => {
    if (notification.read_at) return

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n))
    )
    setUnreadCount((prev) => {
      const next = Math.max(0, prev - 1)
      previousUnreadCount.current = next
      return next
    })

    try {
      await apiFetch(`/notifications/${notification.id}/read`, { method: 'PATCH', token })
    } catch {
      // Best-effort — the next poll reconciles state if this failed.
    }
  }

  const markAllRead = async () => {
    if (unreadCount === 0) return

    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    setUnreadCount(0)
    previousUnreadCount.current = 0

    try {
      await apiFetch('/notifications/read-all', { method: 'POST', token })
    } catch {
      // Best-effort — the next poll reconciles state if this failed.
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notifications"
        className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-navy"
      >
        <Bell className="h-4.5 w-4.5" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-ember px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-brand-navy">Notifications</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleAlerts}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-navy"
                title={alertsEnabled ? 'Turn off sound & popup alerts' : 'Get a sound and popup when something new arrives'}
              >
                {alertsEnabled ? <BellRing className="h-3.5 w-3.5 text-brand-teal" strokeWidth={2} /> : <BellOff className="h-3.5 w-3.5" strokeWidth={2} />}
                {alertsEnabled ? 'Alerts on' : 'Alerts off'}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  role="menuitem"
                  onClick={() => markRead(notification)}
                  className={`flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 ${
                    notification.read_at ? '' : 'bg-brand-teal/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!notification.read_at && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-teal" />}
                    <span className="text-sm font-medium text-brand-navy">{notification.title}</span>
                  </div>
                  <p className="text-xs text-slate-500">{notification.body}</p>
                  <span className="mt-0.5 text-[11px] text-slate-400">{formatDate(notification.created_at)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
