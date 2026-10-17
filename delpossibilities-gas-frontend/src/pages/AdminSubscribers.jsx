import { useState, useEffect, useMemo } from 'react'
import { CalendarCheck, Search, Users, Flame, Wallet, AlarmClock, X, MessageCircle, Phone, UserPlus, Trash2 } from 'lucide-react'
import { apiFetch, formatNaira, formatDate, whatsappUrl } from '../api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../StatusBadge'
import PaginationControls from '../components/PaginationControls'
import AddSubscriberModal from '../components/AddSubscriberModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { paginate } from '../pagination'

// A subscription can be cancelled from the admin side only while it's still
// awaiting payment (the student abandoned checkout, nothing was ever
// charged), or when it was granted manually by an admin in the first place
// (see AdminSubscriberController::store — a sponsored slot, goodwill
// gesture, etc., identifiable by carrying a SubscriptionPayment with
// method 'manual'). A genuinely paid, real subscription can't be cancelled
// this way — mirrors the backend's own guard in SubscriberController::cancel.
function isCancellable(subscriber) {
  if (subscriber.status === 'cancelled') return false
  if (subscriber.status === 'pending') return true
  return (subscriber.payments || []).some((payment) => payment.method === 'manual')
}

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }
const PACKAGE_LABELS = { session: 'Session', semester: 'Semester' }

// WhatsApp + call shortcuts for reaching a subscriber. Falls back to the
// delivery recipient's phone when the account itself has none on file.
function ContactLinks({ subscriber }) {
  const phone = subscriber.user?.phone || subscriber.recipient_phone
  if (!phone) return <span className="text-slate-400">—</span>

  const wa = whatsappUrl(phone)

  return (
    <span className="inline-flex items-center gap-1.5">
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-md bg-brand-teal/10 px-2 py-1 text-xs font-medium text-brand-teal hover:bg-brand-teal/20"
        >
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
          Message
        </a>
      )}
      <a
        href={`tel:${phone}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
      >
        <Phone className="h-3.5 w-3.5" strokeWidth={2} />
        {phone}
      </a>
    </span>
  )
}
const STATUS_LABELS = { pending: 'Pending Payment', active: 'Active', expired: 'Expired', cancelled: 'Cancelled' }

const EMPTY_FILTERS = { search: '', packageType: 'all', tier: 'all', status: 'all', expiry: 'all' }

function filterSubscribers(subscribers, filters) {
  const term = filters.search.trim().toLowerCase()
  const now = Date.now()

  return subscribers.filter((subscriber) => {
    if (filters.packageType !== 'all' && subscriber.plan?.package_type !== filters.packageType) return false
    if (filters.tier !== 'all' && subscriber.plan?.tier !== filters.tier) return false
    if (filters.status !== 'all' && subscriber.status !== filters.status) return false

    if (filters.expiry !== 'all') {
      const endsAt = subscriber.ends_at ? new Date(subscriber.ends_at).getTime() : null

      if (filters.expiry === 'expired') {
        if (subscriber.status !== 'expired' && !(subscriber.status === 'active' && endsAt && endsAt < now)) return false
      } else {
        const days = filters.expiry === '7' ? 7 : 30
        if (!(subscriber.status === 'active' && endsAt && endsAt >= now && endsAt <= now + days * 24 * 60 * 60 * 1000)) {
          return false
        }
      }
    }

    if (term) {
      const haystack = `${subscriber.customer_id} ${subscriber.user?.name || ''}`.toLowerCase()
      if (!haystack.includes(term)) return false
    }

    return true
  })
}

function AdminSubscribers({ token }) {
  const [subscribers, setSubscribers] = useState([])
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [subscribersRes, reportsRes] = await Promise.all([
          apiFetch('/admin/subscribers', { token }),
          apiFetch('/admin/subscription-reports', { token }),
        ])

        if (!subscribersRes.ok) {
          setError('Could not load subscribers.')
          return
        }

        const subscribersData = await subscribersRes.json()
        setSubscribers(Array.isArray(subscribersData) ? subscribersData : [])

        if (reportsRes.ok) {
          setReports(await reportsRes.json())
        }
        setError('')
      } catch {
        setError('Check your internet connection.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  const set = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  // The stat cards (Active, Revenue, Expiring) and the tier/package
  // breakdowns come from server-side reports, not from the rows in state —
  // so after any change that moves them (cancelling or manually adding a
  // subscriber) they have to be re-fetched, or they stay stale until reload.
  const refreshReports = async () => {
    try {
      const response = await apiFetch('/admin/subscription-reports', { token })
      if (response.ok) setReports(await response.json())
    } catch {
      // Keep showing the last known figures; the next load corrects them.
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    setError('')

    try {
      const response = await apiFetch(`/admin/subscribers/${cancelTarget.id}/cancel`, { method: 'PATCH', token })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message || 'Could not cancel this subscription.')
        return
      }

      const updated = await response.json()
      setSubscribers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      setCancelTarget(null)
      refreshReports()
    } catch {
      setError('Check your internet connection.')
    } finally {
      setCancelling(false)
    }
  }

  const filteredSubscribers = useMemo(() => filterSubscribers(subscribers, filters), [subscribers, filters])
  const pageCount = Math.max(1, Math.ceil(filteredSubscribers.length / pageSize))
  const visibleSubscribers = useMemo(
    () => paginate(filteredSubscribers, Math.min(page, pageCount), pageSize),
    [filteredSubscribers, page, pageCount, pageSize]
  )

  // Excludes a cancelled row (see isCancellable/handleCancel above) — a
  // voided subscription (abandoned pending checkout, or a manual grant
  // undone) shouldn't keep counting toward how many subscriptions this
  // platform has actually served.
  const totalSubscribers = useMemo(
    () => subscribers.filter((subscriber) => subscriber.status !== 'cancelled').length,
    [subscribers]
  )
  const totalActive = useMemo(
    () => Object.values(reports?.active_by_tier || {}).reduce((sum, count) => sum + Number(count), 0),
    [reports]
  )
  const totalRevenue = useMemo(
    () => Object.values(reports?.revenue_by_package || {}).reduce((sum, amount) => sum + Number(amount), 0),
    [reports]
  )
  const expiringSoonCount = reports?.expiring_soon?.length || 0

  const isFilterActive =
    filters.search || filters.packageType !== 'all' || filters.tier !== 'all' || filters.status !== 'all' || filters.expiry !== 'all'

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Subscribers"
        subtitle="Every session/semester subscriber, with plan, status, and expiry at a glance."
        icon={CalendarCheck}
        action={
          <button onClick={() => setAddModalOpen(true)} className="btn-primary">
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Add Subscriber
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Subscribers" value={totalSubscribers} icon={Users} tone="navy" />
        <StatCard label="Active" value={totalActive} icon={Flame} tone="teal" />
        <StatCard label="Total Revenue" value={formatNaira(totalRevenue)} icon={Wallet} tone="accent" />
        <StatCard label="Expiring in 30 Days" value={expiringSoonCount} icon={AlarmClock} tone="amber" />
      </div>

      {reports && (
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="panel-card p-5 pt-7">
            <h3 className="mb-4 font-heading text-sm font-bold text-brand-navy">Active by tier</h3>
            <div className="flex flex-col gap-3">
              {Object.keys(TIER_LABELS).map((tier) => {
                const count = Number(reports.active_by_tier?.[tier] || 0)
                const max = Math.max(1, ...Object.values(reports.active_by_tier || {}).map(Number))
                return (
                  <div key={tier}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{TIER_LABELS[tier]}</span>
                      <span className="figure font-medium text-brand-navy">{count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-teal" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel-card p-5 pt-7">
            <h3 className="mb-4 font-heading text-sm font-bold text-brand-navy">Revenue by package</h3>
            <div className="flex flex-col gap-3">
              {Object.keys(PACKAGE_LABELS).map((packageType) => {
                const amount = Number(reports.revenue_by_package?.[packageType] || 0)
                return (
                  <div key={packageType} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{PACKAGE_LABELS[packageType]}</span>
                    <span className="figure font-medium text-brand-navy">{formatNaira(amount)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {error && <p className="alert-error mb-6">{error}</p>}


      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && subscribers.length === 0 && !error && (
        <EmptyState icon={CalendarCheck} title="No subscribers yet" description="Students who subscribe to a session or semester plan will show up here." />
      )}

      {!loading && subscribers.length > 0 && (
        <>
          <div className="filter-bar">
            <div className="relative flex-1 sm:min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => set({ search: e.target.value })}
                placeholder="Search by customer ID or student…"
                className="filter-field pl-9"
              />
            </div>

            <select value={filters.packageType} onChange={(e) => set({ packageType: e.target.value })} className="filter-field sm:w-40">
              <option value="all">All packages</option>
              {Object.entries(PACKAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select value={filters.tier} onChange={(e) => set({ tier: e.target.value })} className="filter-field sm:w-36">
              <option value="all">All tiers</option>
              {Object.entries(TIER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select value={filters.status} onChange={(e) => set({ status: e.target.value })} className="filter-field sm:w-44">
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select value={filters.expiry} onChange={(e) => set({ expiry: e.target.value })} className="filter-field sm:w-44">
              <option value="all">Any expiry</option>
              <option value="7">Expiring in 7 days</option>
              <option value="30">Expiring in 30 days</option>
              <option value="expired">Already expired</option>
            </select>

            {isFilterActive && (
              <button onClick={() => set(EMPTY_FILTERS)} className="btn-ghost">
                <X className="h-3.5 w-3.5" strokeWidth={2} />
                Clear
              </button>
            )}

            <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
              Showing {filteredSubscribers.length} of {subscribers.length}
            </span>
          </div>

          {visibleSubscribers.length === 0 && (
            <EmptyState icon={Search} title="No subscribers match your filters" description="Try clearing a filter to see more results." />
          )}

          {visibleSubscribers.length > 0 && (
            <>
              <div className="table-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th-cell">Customer ID</th>
                      <th className="th-cell">Student</th>
                      <th className="th-cell">Contact</th>
                      <th className="th-cell">Plan</th>
                      <th className="th-cell">Locked Price</th>
                      <th className="th-cell">Status</th>
                      <th className="th-cell">Ends</th>
                      <th className="th-cell"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleSubscribers.map((subscriber) => (
                      <tr key={subscriber.id}>
                        <td className="figure px-4 py-3 font-medium text-brand-navy">{subscriber.customer_id}</td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">{subscriber.user?.name || '—'}</td>
                        <td className="px-4 py-3"><ContactLinks subscriber={subscriber} /></td>
                        <td className="px-4 py-3 text-slate-600">
                          {TIER_LABELS[subscriber.plan?.tier] || subscriber.plan?.tier} · {PACKAGE_LABELS[subscriber.plan?.package_type] || subscriber.plan?.package_type}
                        </td>
                        <td
                          className="figure px-4 py-3 text-brand-navy"
                          title={
                            Number(subscriber.referral_discount_amount) > 0
                              ? `Plan price ${formatNaira(subscriber.locked_price)}, minus ${formatNaira(subscriber.referral_discount_amount)} referral discount`
                              : undefined
                          }
                        >
                          {formatNaira(subscriber.total_amount ?? subscriber.locked_price)}
                          {Number(subscriber.referral_discount_amount) > 0 && (
                            <span className="ml-1 text-xs font-medium text-brand-teal">(discounted)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={subscriber.status} label={STATUS_LABELS[subscriber.status] || subscriber.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                          {subscriber.ends_at ? formatDate(subscriber.ends_at) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isCancellable(subscriber) && (
                            <button
                              onClick={() => setCancelTarget(subscriber)}
                              aria-label="Cancel subscription"
                              className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {visibleSubscribers.map((subscriber) => (
                  <div key={subscriber.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="figure truncate font-medium text-brand-navy">{subscriber.customer_id}</p>
                        <p className="truncate text-xs text-slate-400">{subscriber.user?.name || '—'}</p>
                      </div>
                      <StatusBadge status={subscriber.status} label={STATUS_LABELS[subscriber.status] || subscriber.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                      <span>
                        {TIER_LABELS[subscriber.plan?.tier] || subscriber.plan?.tier} · {PACKAGE_LABELS[subscriber.plan?.package_type] || subscriber.plan?.package_type}
                      </span>
                      <span className="figure">
                        {formatNaira(subscriber.total_amount ?? subscriber.locked_price)}
                        {Number(subscriber.referral_discount_amount) > 0 && (
                          <span className="ml-1 text-xs font-medium text-brand-teal">(discounted)</span>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {subscriber.ends_at ? `Ends ${formatDate(subscriber.ends_at)}` : 'No end date yet'}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <ContactLinks subscriber={subscriber} />
                      {isCancellable(subscriber) && (
                        <button
                          onClick={() => setCancelTarget(subscriber)}
                          aria-label="Cancel subscription"
                          className="btn-ghost flex-shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <PaginationControls
                page={Math.min(page, pageCount)}
                pageSize={pageSize}
                total={filteredSubscribers.length}
                onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
                onPageSizeChange={(next) => {
                  setPageSize(next)
                  setPage(1)
                }}
              />
            </>
          )}
        </>
      )}

      <AddSubscriberModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        token={token}
        subscribers={subscribers}
        onCreated={(subscriber) => {
          setSubscribers((prev) => [subscriber, ...prev])
          refreshReports()
        }}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        title={cancelTarget ? `Cancel ${cancelTarget.customer_id}'s subscription?` : ''}
        message={
          cancelTarget?.status === 'pending'
            ? "This subscription hasn't been paid for yet — cancelling just clears it so the student can start a fresh one."
            : 'This was added manually — cancelling ends it immediately and the student loses any remaining kg on it.'
        }
        confirmLabel="Cancel Subscription"
        tone="danger"
        busy={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}

export default AdminSubscribers
