import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, PackageSearch, ShoppingCart } from 'lucide-react'
import { apiFetch, formatNaira, formatDate } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../StatusBadge'

const STATUS_LABELS = {
  pending: 'Awaiting Payment',
  approved: 'Paid — Awaiting Fulfillment',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function linkedNote(productOrder) {
  if (productOrder.order) return `Delivered with gas order #${productOrder.order.id}`
  if (productOrder.attaching_order) return `Delivered with gas order #${productOrder.attaching_order.id}`
  if (productOrder.refill) return `Delivered with your subscription refill #${productOrder.refill.id}`
  return null
}

function MyShopOrders({ token }) {
  const [productOrders, setProductOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/my-product-orders', { token })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setProductOrders(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load your shop orders.'))
      .finally(() => setLoading(false))
  }, [token])

  const stats = useMemo(() => {
    const totalSpent = productOrders
      .filter((po) => po.status !== 'pending' && po.status !== 'cancelled')
      .reduce((sum, po) => sum + Number(po.total_amount || 0), 0)
    return { total: productOrders.length, totalSpent }
  }, [productOrders])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My Shop Orders" subtitle="Gas Services and Eazy Market purchases, whether checked out on their own or with a delivery." icon={ShoppingBag} />

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && productOrders.length === 0 && !error && (
        <EmptyState
          icon={PackageSearch}
          title="No shop orders yet"
          description="Browse Gas Services and Eazy Market on the home page to get started."
          action={
            <Link to="/cart" className="btn-primary mt-2">
              <ShoppingCart className="h-4 w-4" strokeWidth={2} />
              View My Cart
            </Link>
          }
        />
      )}

      {!loading && productOrders.length > 0 && (
        <div className="flex flex-col gap-3">
          {productOrders.map((po) => (
            <div key={po.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">
                    {po.items?.length || 0} item{po.items?.length === 1 ? '' : 's'} · {formatDate(po.created_at)}
                  </p>
                  <p className="figure mt-1 text-lg font-bold text-brand-navy">{formatNaira(po.total_amount)}</p>
                </div>
                <StatusBadge status={po.status} label={STATUS_LABELS[po.status] || po.status} />
              </div>

              <ul className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                {po.items?.map((item) => (
                  <li key={item.id} className="flex items-center justify-between">
                    <span>
                      {item.quantity} × {item.product_name}
                      {item.variant_label && <span className="text-slate-400"> ({item.variant_label})</span>}
                    </span>
                    <span className="figure text-slate-500">{formatNaira(item.line_total)}</span>
                  </li>
                ))}
              </ul>

              {linkedNote(po) && (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">{linkedNote(po)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyShopOrders
