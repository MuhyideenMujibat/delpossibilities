import { useState, useEffect, useMemo } from 'react'
import { Wallet, Receipt, TrendingUp, CalendarClock, Clock, ReceiptText } from 'lucide-react'
import {
  apiFetch,
  formatNaira,
  formatDate,
  filterOrders,
  PAID_STATUSES,
  STATUS_LABELS,
} from '../api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../StatusBadge'
import OrderFilters, { EMPTY_FILTERS } from '../components/OrderFilters'
import AdminOrderDrawer from '../components/AdminOrderDrawer'
import PaginationControls from '../components/PaginationControls'
import { paginate } from '../pagination'

const POLL_INTERVAL_MS = 30000

function sortByPaidAtDesc(orders) {
  return [...orders].sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))
}

function paymentSearchText(order) {
  return `${order.user?.name || ''} ${order.paystack_reference || ''}`
}

function isSameMonth(date, reference) {
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth()
}

function AdminPayments({ token }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await apiFetch('/orders', { token })

        if (!response.ok) {
          setError('Could not load payments.')
          return
        }

        const data = await response.json()
        const list = Array.isArray(data) ? data : data.orders || data.data || []
        // Every order lives here regardless of payment status — pending
        // (unpaid), approved/picked_up/delivered (paid) — this is the full
        // payment ledger, not just successful payments.
        setOrders(sortByPaidAtDesc(list))
        setError('')
      } catch {
        setError('Could not reach the server.')
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()

    const intervalId = setInterval(fetchOrders, POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [token])

  const stats = useMemo(() => {
    const paid = orders.filter((order) => PAID_STATUSES.includes(order.status))
    const now = new Date()
    const revenue = paid.reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
    const monthRevenue = paid
      .filter((order) => isSameMonth(new Date(order.paid_at || order.created_at), now))
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
    const avgPayment = paid.length ? revenue / paid.length : 0
    const pendingCount = orders.length - paid.length

    return { total: orders.length, paidCount: paid.length, pendingCount, revenue, monthRevenue, avgPayment }
  }, [orders])

  const filteredOrders = useMemo(
    () => filterOrders(orders, filters, paymentSearchText, 'paid_at'),
    [orders, filters]
  )
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const visibleOrders = useMemo(
    () => paginate(filteredOrders, Math.min(page, pageCount), pageSize),
    [filteredOrders, page, pageCount, pageSize]
  )

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Payments"
        subtitle="Every order and its payment status — pending, paid, or otherwise."
        icon={Wallet}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Orders" value={stats.total} icon={Receipt} tone="navy" hint={`${stats.paidCount} paid`} />
        <StatCard label="Pending Payment" value={stats.pendingCount} icon={Clock} tone="amber" />
        <StatCard label="Total Revenue" value={formatNaira(stats.revenue)} icon={Wallet} tone="teal" />
        <StatCard label="This Month" value={formatNaira(stats.monthRevenue)} icon={CalendarClock} tone="accent" />
        <StatCard label="Avg Payment" value={formatNaira(stats.avgPayment)} icon={TrendingUp} tone="navy" />
      </div>

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && orders.length === 0 && !error && (
        <EmptyState icon={ReceiptText} title="No orders yet" description="Orders and their payment status will show up here once students start ordering." />
      )}

      {!loading && orders.length > 0 && (
        <>
          <OrderFilters
            filters={filters}
            onChange={setFilters}
            searchPlaceholder="Search by student or reference…"
            resultCount={filteredOrders.length}
            totalCount={orders.length}
            showHostelFilter
          />

          {visibleOrders.length === 0 && (
            <EmptyState icon={ReceiptText} title="No payments match your filters" description="Try clearing a filter to see more results." />
          )}

          {visibleOrders.length > 0 && (
            <>
              <div className="table-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th-cell">Student</th>
                      <th className="th-cell">Reference</th>
                      <th className="th-cell">Kg</th>
                      <th className="th-cell">Amount</th>
                      <th className="th-cell">Status</th>
                      <th className="th-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleOrders.map((order) => (
                      <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} className="cursor-pointer hover:bg-slate-50/70">
                        <td className="max-w-[160px] truncate px-4 py-3 font-medium text-brand-navy">{order.user?.name}</td>
                        <td className="figure max-w-[160px] truncate px-4 py-3 text-xs text-slate-500">
                          {order.paystack_reference || '—'}
                        </td>
                        <td className="figure px-4 py-3 text-slate-600">{order.kg}</td>
                        <td className="figure px-4 py-3 font-medium text-brand-navy">{formatNaira(order.total_amount)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                          {formatDate(order.paid_at || order.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {visibleOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className="cursor-pointer rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-brand-navy">{order.user?.name}</p>
                        <p className="figure truncate text-xs text-slate-400">{order.paystack_reference || '—'}</p>
                      </div>
                      <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                      <span className="figure">{order.kg} kg · {formatNaira(order.total_amount)}</span>
                      <span className="text-xs text-slate-400">{formatDate(order.paid_at || order.created_at)}</span>
                    </div>
                  </div>
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
        </>
      )}

      <AdminOrderDrawer order={selectedOrder} onClose={() => setSelectedOrderId(null)} />
    </div>
  )
}

export default AdminPayments
