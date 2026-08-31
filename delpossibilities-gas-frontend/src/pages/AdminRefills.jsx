import { useState, useEffect, useMemo } from 'react'
import { Droplets, Clock, Truck, CheckCircle2, XCircle } from 'lucide-react'
import { apiFetch, formatDate } from '../api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

const POLL_INTERVAL_MS = 30000

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }

// Same pending -> approved -> picked_up -> delivered pipeline as regular
// orders (see AdminDashboard's NEXT_STATUS) — cancel stays available as a
// separate action from `pending` only, since a refill has no payment gate
// forcing every request through the pipeline.
const NEXT_STATUS = {
  pending: 'approved',
  approved: 'picked_up',
  picked_up: 'delivered',
}

const NEXT_STATUS_LABEL = {
  pending: 'Approve',
  approved: 'Picked Up',
  picked_up: 'Delivered',
}

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_STYLES = {
  pending: { badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  approved: { badge: 'bg-brand-teal/10 text-brand-teal', dot: 'bg-brand-teal' },
  picked_up: { badge: 'bg-brand-accent/15 text-brand-accent', dot: 'bg-brand-accent' },
  delivered: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  cancelled: { badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
}

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

function RefillStatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function AdminRefills({ token }) {
  const [refills, setRefills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusTab, setStatusTab] = useState('pending')
  const [updatingId, setUpdatingId] = useState(null)
  // { refill, action: 'advance' | 'cancel' } — 'advance' always targets
  // NEXT_STATUS[refill.status], resolved at confirm time.
  const [actionTarget, setActionTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchRefills = async () => {
    try {
      const response = await apiFetch('/admin/refills?status=all', { token })

      if (!response.ok) {
        setError('Could not load refills.')
        return
      }

      const data = await response.json()
      setRefills(Array.isArray(data) ? data : [])
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRefills()

    const intervalId = setInterval(fetchRefills, POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const visibleRefills = useMemo(() => {
    const list = statusTab === 'all' ? refills : refills.filter((r) => r.status === statusTab)
    return [...list].sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))
  }, [refills, statusTab])

  const stats = useMemo(() => {
    const pending = refills.filter((r) => r.status === 'pending').length
    const inProgress = refills.filter((r) => r.status === 'approved' || r.status === 'picked_up').length
    const delivered = refills.filter((r) => r.status === 'delivered').length
    const cancelled = refills.filter((r) => r.status === 'cancelled').length
    return { pending, inProgress, delivered, cancelled }
  }, [refills])

  const applyUpdate = async (refill, nextStatus) => {
    if (updatingId === refill.id) return

    setActionTarget(null)
    setUpdatingId(refill.id)
    setSubmitting(true)
    setError('')

    try {
      const response = await apiFetch(`/admin/refills/${refill.id}`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      })

      if (!response.ok) {
        setError('Could not update this refill.')
        return
      }

      // The update response's `subscriber` only carries whatever relations the
      // controller happened to lazy-load while computing defaults (plan, not
      // user) — merge onto the existing row instead of replacing it outright
      // so the student name doesn't disappear from the table after this.
      const updated = await response.json()
      setRefills((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, ...updated, subscriber: { ...r.subscriber, ...updated.subscriber } } : r))
      )
    } catch {
      setError('Could not reach the server.')
    } finally {
      setUpdatingId(null)
      setSubmitting(false)
    }
  }

  const handleConfirmAction = () => {
    if (!actionTarget) return
    const { refill, action } = actionTarget
    applyUpdate(refill, action === 'cancel' ? 'cancelled' : NEXT_STATUS[refill.status])
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Refills" subtitle="Refill requests from active subscribers, ready to be scheduled and delivered." icon={Droplets} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={stats.pending} icon={Clock} tone="amber" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Truck} tone="accent" hint="Approved or picked up" />
        <StatCard label="Delivered" value={stats.delivered} icon={CheckCircle2} tone="teal" />
        <StatCard label="Cancelled" value={stats.cancelled} icon={XCircle} tone="navy" />
      </div>

      <div className="mb-6 inline-flex flex-wrap rounded-lg bg-brand-bg p-1" role="radiogroup" aria-label="Refill status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="radio"
            aria-checked={statusTab === tab.value}
            onClick={() => setStatusTab(tab.value)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              statusTab === tab.value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && visibleRefills.length === 0 && !error && (
        <EmptyState icon={Droplets} title="Nothing here" description="No refill requests match this status right now." />
      )}

      {!loading && visibleRefills.length > 0 && (
        <div className="table-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="th-cell">Customer ID</th>
                <th className="th-cell">Student</th>
                <th className="th-cell">Plan</th>
                <th className="th-cell">Requested</th>
                <th className="th-cell">Delivered</th>
                <th className="th-cell">Kg Requested</th>
                <th className="th-cell">Kg Delivered</th>
                <th className="th-cell">Kg Remaining</th>
                <th className="th-cell">Status</th>
                <th className="th-cell"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRefills.map((refill) => {
                const nextStatus = NEXT_STATUS[refill.status]
                const updating = updatingId === refill.id

                return (
                  <tr key={refill.id}>
                    <td className="figure px-4 py-3 font-medium text-brand-navy">{refill.subscriber?.customer_id}</td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">{refill.subscriber?.user?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{TIER_LABELS[refill.subscriber?.plan?.tier] || refill.subscriber?.plan?.tier}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(refill.requested_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {refill.delivered_at ? formatDate(refill.delivered_at) : '—'}
                    </td>
                    <td className="figure px-4 py-3 text-slate-600">{refill.kg_requested ? `${refill.kg_requested} kg` : '—'}</td>
                    <td className="figure px-4 py-3 text-slate-600">{refill.kg_delivered ? `${refill.kg_delivered} kg` : '—'}</td>
                    <td className="figure px-4 py-3 text-slate-600">
                      {refill.subscriber?.remaining_kg !== undefined ? `${refill.subscriber.remaining_kg} kg` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <RefillStatusBadge status={refill.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {refill.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setActionTarget({ refill, action: 'cancel' })}
                            disabled={updating}
                            className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
                          >
                            Cancel
                          </button>
                          <button onClick={() => setActionTarget({ refill, action: 'advance' })} disabled={updating} className="btn-primary !py-1.5">
                            {updating ? 'Updating…' : NEXT_STATUS_LABEL[refill.status]}
                          </button>
                        </div>
                      )}
                      {(refill.status === 'approved' || refill.status === 'picked_up') && nextStatus && (
                        <button onClick={() => setActionTarget({ refill, action: 'advance' })} disabled={updating} className="btn-primary !py-1.5">
                          {updating ? 'Updating…' : NEXT_STATUS_LABEL[refill.status]}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!actionTarget}
        title={
          actionTarget?.action === 'advance'
            ? `Mark ${actionTarget.refill.subscriber?.customer_id}'s refill as ${NEXT_STATUS_LABEL[actionTarget.refill.status]}?`
            : actionTarget
              ? `Cancel ${actionTarget.refill.subscriber?.customer_id}'s refill request?`
              : ''
        }
        message={
          actionTarget?.action === 'advance' && NEXT_STATUS[actionTarget.refill.status] === 'delivered'
            ? `Delivers ${actionTarget.refill.kg_requested || ''} kg, free — deducted from ${actionTarget.refill.subscriber?.remaining_kg ?? '?'} kg remaining on their subscription.`
            : actionTarget?.action === 'advance'
              ? 'This updates the refill status — make sure this matches what actually happened.'
              : 'This refill request will be cancelled — the student can request another one anytime.'
        }
        confirmLabel={actionTarget?.action === 'advance' ? 'Confirm' : 'Cancel Request'}
        tone={actionTarget?.action === 'cancel' ? 'danger' : 'default'}
        busy={submitting}
        onConfirm={handleConfirmAction}
        onCancel={() => setActionTarget(null)}
      />
    </div>
  )
}

export default AdminRefills
