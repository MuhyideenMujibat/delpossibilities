import { useState, useEffect, useMemo, Fragment } from 'react'
import { Droplets, Clock, Truck, CheckCircle2, XCircle, ShoppingBag, ImageOff, ChevronDown } from 'lucide-react'
import { apiFetch, formatDate, formatNaira, resolveImageUrl } from '../api'
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

// Snapshotted at request time; server falls back to the subscriber's
// profile photo for refills that predate the column.
function CylinderThumb({ refill }) {
  const src = resolveImageUrl(refill.cylinder_image_url)
  if (!src) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
        <ImageOff className="h-4 w-4" strokeWidth={1.8} />
      </span>
    )
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      <img src={src} alt="Cylinder" className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200 hover:ring-brand-teal" />
    </a>
  )
}

// The Eazy Market / Gas Services cart riding on this same delivery trip —
// a toggle: click to expand/collapse the full item breakdown below the row.
function ShopBadge({ productOrder, expanded, onToggle }) {
  if (!productOrder) return null
  const count = productOrder.items?.length || 0
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle?.()
      }}
      aria-expanded={!!expanded}
      className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-2 py-0.5 text-[10px] font-semibold text-brand-accent transition-colors hover:bg-brand-accent/25"
    >
      <ShoppingBag className="h-3 w-3" strokeWidth={2} />
      {expanded ? 'Hide' : 'View'} shop ({count})
      <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} strokeWidth={2} />
    </button>
  )
}

// The full shop-order breakdown for a refill that has a cart attached —
// every line item (qty × unit price), the subtotal / delivery / total, and
// whether that cart has actually been paid for (a subscriber can bundle an
// unpaid cart into the refill request and then abandon the Paystack step;
// the refill still shows here, flagged unpaid).
function ShopAttachment({ productOrder, label = 'Shop order on this delivery' }) {
  if (!productOrder) return null
  const unpaid = productOrder.status === 'pending'
  const items = productOrder.items || []
  const referralCredit = Number(productOrder.referral_credit_applied || 0)
  return (
    <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-accent">
        <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} />
        {label}
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
            unpaid ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
          }`}
        >
          {unpaid ? 'Awaiting payment' : productOrder.paid_at ? `Paid · ${formatDate(productOrder.paid_at)}` : 'Paid'}
        </span>
        <span className="ml-auto normal-case text-slate-400">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <table className="w-full text-xs text-slate-600">
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="py-0.5 pr-2">
                <span className="font-medium text-slate-700">{item.product_name}</span>
                {item.variant_label ? <span className="text-slate-400"> · {item.variant_label}</span> : ''}
                {item.group ? (
                  <span className="ml-1 rounded bg-slate-100 px-1 py-px text-[9px] uppercase text-slate-400">
                    {item.group === 'eazy_market' ? 'Eazy Market' : 'Gas Services'}
                  </span>
                ) : null}
              </td>
              <td className="whitespace-nowrap py-0.5 px-2 text-right text-slate-400">
                {item.quantity} × {formatNaira(item.unit_price)}
              </td>
              <td className="figure whitespace-nowrap py-0.5 pl-2 text-right text-slate-600">
                {formatNaira(item.line_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex flex-col gap-0.5 border-t border-brand-accent/20 pt-1.5 text-xs">
        <div className="flex items-center justify-between text-slate-500">
          <span>Subtotal</span>
          <span className="figure">{formatNaira(productOrder.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-500">
          <span>Delivery fee</span>
          <span className="figure">{formatNaira(productOrder.delivery_fee)}</span>
        </div>
        {referralCredit > 0 && (
          <div className="flex items-center justify-between text-brand-teal">
            <span>Referral credit</span>
            <span className="figure">&minus;{formatNaira(referralCredit)}</span>
          </div>
        )}
        <div className="flex items-center justify-between font-semibold text-slate-700">
          <span>Cart total</span>
          <span className="figure">{formatNaira(productOrder.total_amount)}</span>
        </div>
      </div>

      {productOrder.hostel_address && (
        <p className="mt-1.5 text-[11px] text-slate-400">Deliver to: {productOrder.hostel_address}</p>
      )}
    </div>
  )
}

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
  // Refill ids whose attached shop-order breakdown is expanded (click the
  // "View shop" badge on a row to toggle).
  const [expandedShop, setExpandedShop] = useState(() => new Set())

  const toggleShop = (id) =>
    setExpandedShop((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
        <>
        <div className="table-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="th-cell">Cylinder</th>
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
                  <Fragment key={refill.id}>
                  <tr>
                    <td className="px-4 py-3"><CylinderThumb refill={refill} /></td>
                    <td className="figure px-4 py-3 font-medium text-brand-navy">{refill.subscriber?.customer_id}</td>
                    <td className="max-w-[180px] px-4 py-3 text-slate-600">
                      <span className="block truncate">{refill.recipient_name || refill.subscriber?.user?.name || '—'}</span>
                      {refill.recipient_name && (
                        <span className="text-[10px] font-semibold text-brand-ember">
                          Kept by original subscriber
                          {refill.recipient_phone ? ` · ${refill.recipient_phone}` : ''}
                        </span>
                      )}
                      {(refill.product_order || refill.attached_product_order) && (
                        <ShopBadge
                          productOrder={refill.product_order || refill.attached_product_order}
                          expanded={expandedShop.has(refill.id)}
                          onToggle={() => toggleShop(refill.id)}
                        />
                      )}
                    </td>
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
                  {(refill.product_order || refill.attached_product_order) && expandedShop.has(refill.id) && (
                    <tr className="bg-brand-accent/[0.03]">
                      <td colSpan={11} className="px-4 pb-3">
                        <div className="flex flex-col gap-2">
                          <ShopAttachment productOrder={refill.product_order} label="Shop order bundled with this refill" />
                          <ShopAttachment productOrder={refill.attached_product_order} label="Paid shop order attached to this refill" />
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* table-card is desktop-only — phone view of the same rows. */}
        <div className="flex flex-col gap-3 md:hidden">
          {visibleRefills.map((refill) => {
            const nextStatus = NEXT_STATUS[refill.status]
            const updating = updatingId === refill.id
            return (
              <div key={refill.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <CylinderThumb refill={refill} />
                  <div className="min-w-0 flex-1">
                    <p className="figure truncate font-medium text-brand-navy">{refill.subscriber?.customer_id}</p>
                    <p className="truncate text-xs text-slate-400">
                      {refill.recipient_name || refill.subscriber?.user?.name || '—'}
                      {refill.recipient_name ? ' · kept by original subscriber' : ''}
                    </p>
                  </div>
                  <RefillStatusBadge status={refill.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>{TIER_LABELS[refill.subscriber?.plan?.tier] || refill.subscriber?.plan?.tier}</span>
                  <span className="figure">
                    {refill.kg_requested ? `${refill.kg_requested} kg` : '—'} req
                    {refill.kg_delivered ? ` · ${refill.kg_delivered} kg del` : ''}
                  </span>
                  {(refill.product_order || refill.attached_product_order) && (
                    <ShopBadge
                      productOrder={refill.product_order || refill.attached_product_order}
                      expanded={expandedShop.has(refill.id)}
                      onToggle={() => toggleShop(refill.id)}
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">Requested {formatDate(refill.requested_at)}</p>
                {(refill.product_order || refill.attached_product_order) && expandedShop.has(refill.id) && (
                  <div className="mt-3 flex flex-col gap-2">
                    <ShopAttachment productOrder={refill.product_order} label="Shop order bundled with this refill" />
                    <ShopAttachment productOrder={refill.attached_product_order} label="Paid shop order attached to this refill" />
                  </div>
                )}
                {(refill.status === 'pending' || refill.status === 'approved' || refill.status === 'picked_up') && (
                  <div className="mt-3 flex gap-2">
                    {refill.status === 'pending' && (
                      <button
                        onClick={() => setActionTarget({ refill, action: 'cancel' })}
                        disabled={updating}
                        className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
                      >
                        Cancel
                      </button>
                    )}
                    {nextStatus && (
                      <button
                        onClick={() => setActionTarget({ refill, action: 'advance' })}
                        disabled={updating}
                        className="btn-primary !py-1.5"
                      >
                        {updating ? 'Updating…' : NEXT_STATUS_LABEL[refill.status]}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        </>
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
