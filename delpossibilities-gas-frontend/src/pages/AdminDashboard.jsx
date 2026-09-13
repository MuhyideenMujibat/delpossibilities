import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Wallet, Clock, Truck, PackageSearch, BarChart3, MessageCircle, X, Droplets, ArrowRight, ShoppingBag } from 'lucide-react'
import { apiFetch, formatNaira, formatDate, filterOrders, PAID_STATUSES, STATUS_LABELS, whatsappUrl } from '../api'
import StatusBadge from '../StatusBadge'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import OrderFilters, { EMPTY_FILTERS } from '../components/OrderFilters'
import AdminOrderDrawer from '../components/AdminOrderDrawer'
import PaginationControls from '../components/PaginationControls'
import ConfirmDialog from '../components/ConfirmDialog'
import { paginate } from '../pagination'

const POLL_INTERVAL_MS = 30000

const NEXT_STATUS = {
  approved: 'picked_up',
  picked_up: 'delivered',
}

const NEXT_STATUS_LABEL = {
  approved: 'Picked Up',
  picked_up: 'Delivered',
}

function sortByCreatedAtDesc(orders) {
  return [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

function orderSearchText(order) {
  return order.user?.name || ''
}

function ActionButton({ nextStatus, currentStatus, updating, onClick, fullWidth }) {
  if (!nextStatus) return null

  return (
    <button onClick={onClick} disabled={updating} className={`btn-primary whitespace-nowrap ${fullWidth ? 'w-full' : ''}`}>
      {updating ? 'Updating…' : NEXT_STATUS_LABEL[currentStatus]}
    </button>
  )
}

function AdminDashboard({ token, canViewRefills = false }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkConfirm, setBulkConfirm] = useState(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [pendingRefillCount, setPendingRefillCount] = useState(0)
  const [pendingShopOrderCount, setPendingShopOrderCount] = useState(0)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await apiFetch('/orders', { token })

        if (!response.ok) {
          setError('Could not load orders.')
          return
        }

        const data = await response.json()
        const list = Array.isArray(data) ? data : data.orders || data.data || []
        setOrders(sortByCreatedAtDesc(list))
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

  // Refills are a separate table/page (see AdminRefills) — payment already
  // happened for a subscriber, so they don't belong mixed into this
  // payment-gated order queue. This just keeps a pending count visible here
  // so it can't get missed by only checking the Refills page.
  useEffect(() => {
    if (!canViewRefills) {
      setPendingRefillCount(0)
      return undefined
    }

    let cancelled = false

    const fetchPendingRefillCount = async () => {
      try {
        const response = await apiFetch('/admin/refills?status=pending', { token })
        if (!response.ok || cancelled) return
        const data = await response.json()
        if (!cancelled) setPendingRefillCount(Array.isArray(data) ? data.length : 0)
      } catch {
        // Silent — this is a secondary indicator, not core dashboard data.
      }
    }

    fetchPendingRefillCount()

    const intervalId = setInterval(fetchPendingRefillCount, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [token, canViewRefills])

  // Same reasoning as pendingRefillCount above — standalone shop orders
  // (not bundled with a gas order/refill) live on their own page too.
  useEffect(() => {
    let cancelled = false

    const fetchPendingShopOrderCount = async () => {
      try {
        const response = await apiFetch('/admin/product-orders?status=approved', { token })
        if (!response.ok || cancelled) return
        const data = await response.json()
        const standaloneCount = (Array.isArray(data) ? data : []).filter((po) => !po.order && !po.refill).length
        if (!cancelled) setPendingShopOrderCount(standaloneCount)
      } catch {
        // Silent — this is a secondary indicator, not core dashboard data.
      }
    }

    fetchPendingShopOrderCount()

    const intervalId = setInterval(fetchPendingShopOrderCount, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [token])

  const requestStatusUpdate = (orderId, nextStatus) => setConfirmTarget({ orderId, nextStatus })

  const handleStatusUpdate = async (orderId, nextStatus) => {
    // Guards against a double confirm/double network call updating the same
    // order twice in flight.
    if (updatingId === orderId) return

    setConfirmTarget(null)
    setUpdatingId(orderId)
    setError('')

    try {
      const response = await apiFetch(`/orders/${orderId}/status`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      })

      if (!response.ok) {
        setError('Could not update the order status.')
        return
      }

      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order))
      )
    } catch {
      setError('Could not reach the server.')
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleSelected = (orderId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const requestBulkStatusUpdate = (nextStatus, orderIds) => setBulkConfirm({ nextStatus, orderIds })

  const handleBulkStatusUpdate = async () => {
    if (!bulkConfirm) return
    const { nextStatus, orderIds } = bulkConfirm

    setBulkUpdating(true)
    setError('')

    const results = await Promise.all(
      orderIds.map(async (orderId) => {
        try {
          const response = await apiFetch(`/orders/${orderId}/status`, {
            method: 'PATCH',
            token,
            body: { status: nextStatus },
          })
          return { orderId, ok: response.ok }
        } catch {
          return { orderId, ok: false }
        }
      })
    )

    const succeededIds = results.filter((r) => r.ok).map((r) => r.orderId)
    const failedCount = results.length - succeededIds.length

    if (succeededIds.length > 0) {
      setOrders((prev) =>
        prev.map((order) => (succeededIds.includes(order.id) ? { ...order, status: nextStatus } : order))
      )
    }

    if (failedCount > 0) {
      setError(`${failedCount} order${failedCount === 1 ? '' : 's'} couldn't be updated. Try again for those.`)
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      succeededIds.forEach((id) => next.delete(id))
      return next
    })
    setBulkConfirm(null)
    setBulkUpdating(false)
  }

  const stats = useMemo(() => {
    const revenue = orders
      .filter((order) => PAID_STATUSES.includes(order.status))
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
    const awaitingApproval = orders.filter((order) => order.status === 'pending').length
    const inProgress = orders.filter((order) => order.status === 'approved' || order.status === 'picked_up').length

    return { total: orders.length, revenue, awaitingApproval, inProgress }
  }, [orders])

  const filteredOrders = useMemo(() => filterOrders(orders, filters, orderSearchText), [orders, filters])
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const visibleOrders = useMemo(() => paginate(filteredOrders, Math.min(page, pageCount), pageSize), [filteredOrders, page, pageCount, pageSize])

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null

  const rows = visibleOrders.map((order) => ({
    order,
    nextStatus: NEXT_STATUS[order.status],
    createdLabel: formatDate(order.created_at),
  }))

  // Only orders that actually have a next status (approved/picked_up) can
  // be bulk-advanced — pending (nothing to advance to yet) and delivered
  // (already done) are excluded from selection.
  const selectableRows = rows.filter((row) => row.nextStatus)
  const allSelectableOnPageSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selectedIds.has(row.order.id))

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelectableOnPageSelected) {
        selectableRows.forEach((row) => next.delete(row.order.id))
      } else {
        selectableRows.forEach((row) => next.add(row.order.id))
      }
      return next
    })
  }

  // Selected orders may span two different next-statuses (some "approved"
  // waiting for pickup, some "picked_up" waiting for delivery) — group them
  // so the bulk bar can offer one action per group rather than assuming
  // they're all the same.
  const bulkGroups = useMemo(() => {
    const groups = {}
    orders.forEach((order) => {
      if (!selectedIds.has(order.id)) return
      const next = NEXT_STATUS[order.status]
      if (!next) return
      groups[next] = groups[next] || []
      groups[next].push(order.id)
    })
    return groups
  }, [orders, selectedIds])

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Manage incoming gas refill orders across campus."
        icon={LayoutDashboard}
        action={
          <Link to="/admin/reports" className="btn-outline">
            <BarChart3 className="h-4 w-4" strokeWidth={2} />
            View Reports
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Orders" value={stats.total} icon={LayoutDashboard} tone="navy" />
        <StatCard label="Revenue" value={formatNaira(stats.revenue)} icon={Wallet} tone="teal" hint="Paid orders only" />
        <StatCard label="Awaiting Approval" value={stats.awaitingApproval} icon={Clock} tone="amber" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Truck} tone="accent" hint="Approved or picked up" />
      </div>

      {canViewRefills && pendingRefillCount > 0 && (
        <Link
          to="/admin/subscriptions?tab=refills"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 transition-colors hover:bg-amber-100"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <Droplets className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            {pendingRefillCount} subscription refill{pendingRefillCount === 1 ? '' : 's'} pending — not shown here, only on the Refills page.
          </span>
          <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold">
            Go to Refills
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </Link>
      )}

      {pendingShopOrderCount > 0 && (
        <Link
          to="/admin?tab=shop-orders"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 transition-colors hover:bg-amber-100"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <ShoppingBag className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            {pendingShopOrderCount} shop order{pendingShopOrderCount === 1 ? '' : 's'} paid and awaiting fulfillment — not shown here, only on the Shop Orders page.
          </span>
          <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold">
            Go to Shop Orders
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </Link>
      )}

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && orders.length === 0 && !error && (
        <EmptyState icon={PackageSearch} title="No orders yet" description="Orders placed by students will show up here." />
      )}

      {!loading && orders.length > 0 && (
        <>
          <OrderFilters
            filters={filters}
            onChange={setFilters}
            searchPlaceholder="Search by student…"
            resultCount={filteredOrders.length}
            totalCount={orders.length}
            showHostelFilter
          />

          {rows.length === 0 && (
            <EmptyState icon={PackageSearch} title="No orders match your filters" description="Try clearing a filter to see more results." />
          )}

          {selectedIds.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3">
              <span className="text-sm font-medium text-brand-navy">{selectedIds.size} selected</span>
              {Object.entries(bulkGroups).map(([nextStatus, orderIds]) => (
                <button
                  key={nextStatus}
                  onClick={() => requestBulkStatusUpdate(nextStatus, orderIds)}
                  className="btn-primary whitespace-nowrap"
                >
                  Mark {orderIds.length} as {nextStatus === 'picked_up' ? 'Picked Up' : 'Delivered'}
                </button>
              ))}
              <button onClick={() => setSelectedIds(new Set())} className="btn-ghost ml-auto">
                <X className="h-3.5 w-3.5" strokeWidth={2} />
                Clear
              </button>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="table-card hidden md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th-cell w-10">
                        {selectableRows.length > 0 && (
                          <input
                            type="checkbox"
                            checked={allSelectableOnPageSelected}
                            onChange={toggleSelectAllOnPage}
                            aria-label="Select all orders on this page that can be advanced"
                            className="h-4 w-4 accent-brand-teal"
                          />
                        )}
                      </th>
                      <th className="th-cell">Student</th>
                      <th className="th-cell">Hostel</th>
                      <th className="th-cell">Kg</th>
                      <th className="th-cell">Total</th>
                      <th className="th-cell">Status</th>
                      <th className="th-cell">Created</th>
                      <th className="th-cell"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(({ order, nextStatus, createdLabel }) => (
                      <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} className="cursor-pointer hover:bg-slate-50/70">
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {nextStatus && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(order.id)}
                              onChange={() => toggleSelected(order.id)}
                              aria-label={`Select order #${order.id}`}
                              className="h-4 w-4 accent-brand-teal"
                            />
                          )}
                        </td>
                        <td className="max-w-[150px] px-4 py-3 font-medium text-brand-navy">
                          <span className="block truncate">{order.user?.name}</span>
                          {(order.product_order || order.attached_product_order) && (
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-accent">
                              <ShoppingBag className="h-3 w-3" strokeWidth={2} />
                              {order.product_order ? '+ Shop' : '+ Shop (paid)'}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">
                          {order.location_type === 'off_campus' && (
                            <span className="mr-1 rounded-full bg-brand-ember/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ember">
                              Off-campus
                            </span>
                          )}
                          {order.hostel_address}
                        </td>
                        <td className="figure px-4 py-3 text-slate-600">{order.kg}</td>
                        <td className="figure px-4 py-3 font-medium text-brand-navy">{formatNaira(order.total_amount)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{createdLabel}</td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {whatsappUrl(order.user?.phone) && (
                              <a
                                href={whatsappUrl(order.user?.phone, `Hello ${order.user?.name || ''}, this is D'EL-Possibilities about your gas refill order #${order.id}.`)}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-outline px-3"
                              >
                                <MessageCircle className="h-4 w-4" strokeWidth={2} />
                              </a>
                            )}
                            <ActionButton
                              nextStatus={nextStatus}
                              currentStatus={order.status}
                              updating={updatingId === order.id}
                              onClick={() => requestStatusUpdate(order.id, nextStatus)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {rows.map(({ order, nextStatus, createdLabel }) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className="cursor-pointer rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-brand-navy">{order.user?.name}</p>
                        <p className="truncate text-sm text-slate-500">{order.hostel_address}</p>
                      </div>
                      <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                      <span className="figure">{order.kg} kg · {formatNaira(order.total_amount)}</span>
                      <span className="text-xs text-slate-400">{createdLabel}</span>
                    </div>

                    {(order.product_order || order.attached_product_order) && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-2 py-0.5 text-[10px] font-semibold text-brand-accent">
                        <ShoppingBag className="h-3 w-3" strokeWidth={2} />
                        {order.product_order ? 'Shop order bundled' : 'Paid shop order attached'}
                      </span>
                    )}

                    {(whatsappUrl(order.user?.phone) || nextStatus) && (
                      <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {whatsappUrl(order.user?.phone) && (
                          <a
                            href={whatsappUrl(order.user?.phone, `Hello ${order.user?.name || ''}, this is D'EL-Possibilities about your gas refill order #${order.id}.`)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-outline flex-1"
                          >
                            <MessageCircle className="h-4 w-4" strokeWidth={2} />
                            WhatsApp
                          </a>
                        )}
                        <ActionButton
                          nextStatus={nextStatus}
                          currentStatus={order.status}
                          updating={updatingId === order.id}
                          onClick={() => requestStatusUpdate(order.id, nextStatus)}
                          fullWidth={!whatsappUrl(order.user?.phone)}
                        />
                      </div>
                    )}
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

      <AdminOrderDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrderId(null)}
        nextStatus={selectedOrder ? NEXT_STATUS[selectedOrder.status] : undefined}
        updating={selectedOrder ? updatingId === selectedOrder.id : false}
        onAdvance={() => selectedOrder && requestStatusUpdate(selectedOrder.id, NEXT_STATUS[selectedOrder.status])}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget ? `Mark as ${NEXT_STATUS_LABEL[orders.find((o) => o.id === confirmTarget.orderId)?.status]}?` : ''}
        message="This updates the order status and notifies where relevant — make sure this matches what actually happened."
        confirmLabel="Confirm"
        busy={confirmTarget ? updatingId === confirmTarget.orderId : false}
        onConfirm={() => confirmTarget && handleStatusUpdate(confirmTarget.orderId, confirmTarget.nextStatus)}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={!!bulkConfirm}
        title={
          bulkConfirm
            ? `Mark ${bulkConfirm.orderIds.length} order${bulkConfirm.orderIds.length === 1 ? '' : 's'} as ${bulkConfirm.nextStatus === 'picked_up' ? 'Picked Up' : 'Delivered'}?`
            : ''
        }
        message="This updates all selected orders at once — make sure this matches what actually happened for every one of them."
        confirmLabel="Confirm"
        busy={bulkUpdating}
        onConfirm={handleBulkStatusUpdate}
        onCancel={() => setBulkConfirm(null)}
      />
    </div>
  )
}

export default AdminDashboard
