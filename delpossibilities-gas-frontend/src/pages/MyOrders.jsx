import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Package, Wallet, Clock, PackageSearch, PlusCircle } from 'lucide-react'
import { apiFetch, formatNaira, formatDate, filterOrders, PAID_STATUSES, STATUS_LABELS } from '../api'
import StatusBadge from '../StatusBadge'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import OrderFilters, { EMPTY_FILTERS } from '../components/OrderFilters'
import PaginationControls from '../components/PaginationControls'
import { paginate } from '../pagination'

function redirectToPayment(authorizationUrl) {
  window.location.href = authorizationUrl
}

function MyOrders({ token }) {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingId, setPayingId] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  useEffect(() => {
    const fetchOrders = async () => {
      setError('')

      try {
        const response = await apiFetch('/my-orders', { token })

        if (!response.ok) {
          setError('Could not load your orders.')
          return
        }

        const data = await response.json()
        setOrders(Array.isArray(data) ? data : data.orders || data.data || [])
      } catch {
        setError('Could not reach the server.')
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [token])

  const handlePayNow = async (orderId) => {
    setPayingId(orderId)
    setError('')

    try {
      const response = await apiFetch(`/orders/${orderId}/pay`, {
        method: 'POST',
        token,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.authorization_url) {
        setError(data?.message || 'Could not start payment.')
        setPayingId(null)
        return
      }

      redirectToPayment(data.authorization_url)
    } catch {
      setError('Could not reach the server.')
      setPayingId(null)
    }
  }

  const stats = useMemo(() => {
    const totalSpent = orders
      .filter((order) => PAID_STATUSES.includes(order.status))
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
    const pendingCount = orders.filter((order) => order.status === 'pending').length

    return { totalOrders: orders.length, totalSpent, pendingCount }
  }, [orders])

  const filteredOrders = useMemo(() => filterOrders(orders, filters), [orders, filters])
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const visibleOrders = useMemo(() => paginate(filteredOrders, Math.min(page, pageCount), pageSize), [filteredOrders, page, pageCount, pageSize])

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="My Orders"
        subtitle="Track your gas refill orders and payments."
        icon={Package}
        action={
          <Link to="/create-order" className="btn-primary">
            <PlusCircle className="h-4 w-4" strokeWidth={2} />
            New Order
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Orders" value={stats.totalOrders} icon={Package} tone="navy" />
        <StatCard label="Total Spent" value={formatNaira(stats.totalSpent)} icon={Wallet} tone="teal" hint="Across paid orders" />
        <StatCard label="Awaiting Payment" value={stats.pendingCount} icon={Clock} tone="amber" />
      </div>

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && orders.length === 0 && !error && (
        <EmptyState
          icon={PackageSearch}
          title="No orders yet"
          description="Create your first gas refill order to see it here."
          action={
            <Link to="/create-order" className="btn-primary mt-2">
              <PlusCircle className="h-4 w-4" strokeWidth={2} />
              Create Order
            </Link>
          }
        />
      )}

      {!loading && orders.length > 0 && (
        <>
          <OrderFilters
            filters={filters}
            onChange={setFilters}
            searchPlaceholder="Search by hostel address…"
            resultCount={filteredOrders.length}
            totalCount={orders.length}
          />

          {filteredOrders.length === 0 && (
            <EmptyState icon={PackageSearch} title="No orders match your filters" description="Try clearing a filter to see more results." />
          )}

          {/* Table view — no cylinder photo here on purpose. Loading every
              order's image just to list it was the slow part; the photo
              only loads on the order detail page when a student opens it. */}
          <div className="table-card hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th-cell">Kg</th>
                  <th className="th-cell">Hostel</th>
                  <th className="th-cell">Total</th>
                  <th className="th-cell">Status</th>
                  <th className="th-cell">Created</th>
                  <th className="th-cell"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOrders.map((order) => (
                  <tr key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className="cursor-pointer hover:bg-slate-50/70">
                    <td className="figure px-4 py-3 font-medium text-brand-navy">{order.kg} kg</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-600">{order.hostel_address}</td>
                    <td className="px-4 py-3">
                      <span className="figure font-medium text-brand-navy">{formatNaira(order.total_amount)}</span>
                      {order.loyalty_discount_applied && (
                        <span className="ml-1.5 inline-block rounded-full bg-brand-teal/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-teal">Loyalty</span>
                      )}
                      {(order.product_order || order.attached_product_order) && (
                        <span className="ml-1.5 inline-block rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-accent">+ Shop</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handlePayNow(order.id)}
                          disabled={payingId === order.id}
                          className="btn-primary whitespace-nowrap"
                        >
                          {payingId === order.id ? 'Redirecting…' : 'Pay Now'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {visibleOrders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="figure text-base font-semibold text-brand-navy">{order.kg} kg</span>
                  <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{order.hostel_address}</p>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="figure font-medium">{formatNaira(order.total_amount)}</span>
                    {order.loyalty_discount_applied && (
                      <span className="inline-block rounded-full bg-brand-teal/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-teal">Loyalty</span>
                    )}
                    {(order.product_order || order.attached_product_order) && (
                      <span className="inline-block rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-accent">+ Shop</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(order.created_at)}</span>
                </div>

                {order.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      handlePayNow(order.id)
                    }}
                    disabled={payingId === order.id}
                    className="btn-primary mt-3 w-full"
                  >
                    {payingId === order.id ? 'Redirecting…' : 'Pay Now'}
                  </button>
                )}
              </Link>
            ))}
          </div>

          <PaginationControls
            page={Math.min(page, pageCount)}
            pageSize={pageSize}
            total={filteredOrders.length}
            onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
            onPageSizeChange={(next) => {
              setPageSize(next)
              setPage(1)
            }}
          />
        </>
      )}
    </div>
  )
}

export default MyOrders
