import { useState, useEffect, useMemo } from 'react'
import { ShoppingBag, Clock, Truck, CheckCircle2, XCircle } from 'lucide-react'
import { apiFetch, formatNaira, formatDate } from '../api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'

const POLL_INTERVAL_MS = 30000

// Same pending -> approved -> picked_up -> delivered pipeline as orders and
// refills. Note "pending" here means unpaid — this page's actionable queue
// starts at "approved" (paid, awaiting fulfillment), see the default tab.
const NEXT_STATUS = {
  approved: 'picked_up',
  picked_up: 'delivered',
}

const NEXT_STATUS_LABEL = {
  approved: 'Picked Up',
  picked_up: 'Delivered',
}

const STATUS_LABELS = {
  pending: 'Awaiting Payment',
  approved: 'Approved',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_TABS = [
  { value: 'approved', label: 'Approved' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

function linkedNote(po) {
  if (po.order) return `Riding with gas order #${po.order.id} (${po.order.status})`
  if (po.refill) return `Riding with subscription refill #${po.refill.id} (${po.refill.status})`
  return null
}

function AdminShopOrders({ token }) {
  const [productOrders, setProductOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusTab, setStatusTab] = useState('approved')
  const [updatingId, setUpdatingId] = useState(null)
  const [actionTarget, setActionTarget] = useState(null) // { productOrder, action: 'advance' | 'cancel' }
  const [submitting, setSubmitting] = useState(false)

  const fetchProductOrders = async () => {
    try {
      const response = await apiFetch('/admin/product-orders?status=all', { token })

      if (!response.ok) {
        setError('Could not load shop orders.')
        return
      }

      const data = await response.json()
      setProductOrders(Array.isArray(data) ? data : [])
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProductOrders()

    const intervalId = setInterval(fetchProductOrders, POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const visibleOrders = useMemo(() => {
    const list = statusTab === 'all' ? productOrders : productOrders.filter((po) => po.status === statusTab)
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [productOrders, statusTab])

  const stats = useMemo(() => {
    const approved = productOrders.filter((po) => po.status === 'approved').length
    const inProgress = productOrders.filter((po) => po.status === 'picked_up').length
    const delivered = productOrders.filter((po) => po.status === 'delivered').length
    const cancelled = productOrders.filter((po) => po.status === 'cancelled').length
    return { approved, inProgress, delivered, cancelled }
  }, [productOrders])

  const applyUpdate = async (productOrder, nextStatus) => {
    if (updatingId === productOrder.id) return

    setActionTarget(null)
    setUpdatingId(productOrder.id)
    setSubmitting(true)
    setError('')

    try {
      const response = await apiFetch(`/admin/product-orders/${productOrder.id}`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.message || Object.values(data?.errors || {})[0]?.[0] || 'Could not update this shop order.')
        return
      }

      setProductOrders((prev) => prev.map((po) => (po.id === data.id ? { ...po, ...data } : po)))
    } catch {
      setError('Could not reach the server.')
    } finally {
      setUpdatingId(null)
      setSubmitting(false)
    }
  }

  const handleConfirmAction = () => {
    if (!actionTarget) return
    const { productOrder, action } = actionTarget
    applyUpdate(productOrder, action === 'cancel' ? 'cancelled' : NEXT_STATUS[productOrder.status])
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Shop Orders"
        subtitle="Standalone Gas Services and Eazy Market purchases. Orders bundled with a gas refill or subscription follow that delivery instead — manage those from Dashboard or Refills."
        icon={ShoppingBag}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Approved" value={stats.approved} icon={Clock} tone="amber" />
        <StatCard label="Picked Up" value={stats.inProgress} icon={Truck} tone="accent" />
        <StatCard label="Delivered" value={stats.delivered} icon={CheckCircle2} tone="teal" />
        <StatCard label="Cancelled" value={stats.cancelled} icon={XCircle} tone="navy" />
      </div>

      <div className="mb-6 inline-flex flex-wrap rounded-lg bg-brand-bg p-1" role="radiogroup" aria-label="Shop order status">
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

      {!loading && visibleOrders.length === 0 && !error && (
        <EmptyState icon={ShoppingBag} title="Nothing here" description="No shop orders match this status right now." />
      )}

      {!loading && visibleOrders.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleOrders.map((po) => {
            const nextStatus = NEXT_STATUS[po.status]
            const updating = updatingId === po.id
            const linked = !!(po.order || po.refill)

            return (
              <div key={po.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="max-w-[220px] truncate font-medium text-brand-navy">{po.user?.name || '—'}</p>
                    <p className="text-xs text-slate-400">
                      {po.items?.length || 0} item{po.items?.length === 1 ? '' : 's'} · {formatDate(po.created_at)}
                    </p>
                    <p className="figure mt-1 text-sm font-semibold text-brand-navy">{formatNaira(po.total_amount)}</p>
                  </div>
                  <StatusBadge status={po.status} label={STATUS_LABELS[po.status] || po.status} />
                </div>

                <ul className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  {po.items?.map((item) => (
                    <li key={item.id}>
                      {item.quantity} × {item.product_name}
                      {item.variant_label && ` (${item.variant_label})`}
                    </li>
                  ))}
                </ul>

                {linked ? (
                  <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">{linkedNote(po)}</p>
                ) : (
                  nextStatus && (
                    <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => setActionTarget({ productOrder: po, action: 'cancel' })}
                        disabled={updating}
                        className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
                      >
                        Cancel
                      </button>
                      <button onClick={() => setActionTarget({ productOrder: po, action: 'advance' })} disabled={updating} className="btn-primary !py-1.5">
                        {updating ? 'Updating…' : NEXT_STATUS_LABEL[po.status]}
                      </button>
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!actionTarget}
        title={
          actionTarget?.action === 'advance'
            ? `Mark this shop order as ${NEXT_STATUS_LABEL[actionTarget.productOrder.status]}?`
            : actionTarget
              ? 'Cancel this shop order?'
              : ''
        }
        message={
          actionTarget?.action === 'advance'
            ? 'This updates the shop order status — make sure this matches what actually happened.'
            : 'This shop order will be cancelled. Refunding, if needed, is handled outside the app.'
        }
        confirmLabel={actionTarget?.action === 'advance' ? 'Confirm' : 'Cancel Order'}
        tone={actionTarget?.action === 'cancel' ? 'danger' : 'default'}
        busy={submitting}
        onConfirm={handleConfirmAction}
        onCancel={() => setActionTarget(null)}
      />
    </div>
  )
}

export default AdminShopOrders
