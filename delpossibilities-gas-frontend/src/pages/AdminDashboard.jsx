import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Wallet, Clock, Truck, PackageSearch, BarChart3, MessageCircle, X, Droplets, ArrowRight, ShoppingBag, Trash2 } from 'lucide-react'
import { apiFetch, formatNaira, formatDate, filterOrders, PAID_STATUSES, STATUS_LABELS, whatsappUrl } from '../api'
import StatusBadge from '../StatusBadge'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import OrderFilters, { EMPTY_FILTERS } from '../components/OrderFilters'
import AdminOrderDrawer from '../components/AdminOrderDrawer'
import AdminRefillDrawer from '../components/AdminRefillDrawer'
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

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// Quick date-range presets for the cards + list below — 'daily' is just
// today (also the page's default), 'weekly'/'monthly' are the trailing
// 7/30 days inclusive of today. Mirrors the Daily/7-days/30-days split on
// the Reports page, just under the names this page asked for.
const RANGE_PRESETS = [
  { key: 'daily', label: 'Daily', from: () => todayIso(), to: () => todayIso() },
  { key: 'weekly', label: 'Weekly', from: () => daysAgoIso(6), to: () => todayIso() },
  { key: 'monthly', label: 'Monthly', from: () => daysAgoIso(29), to: () => todayIso() },
]

// A refill's own pipeline (see AdminRefills.jsx) — different from a gas
// order's: a refill has no payment gate, so 'pending' advances via an
// explicit admin Approve rather than a webhook, and it can be Cancelled
// from there too (a gas order can't — the student just never pays it, or
// an admin deletes it, see OrderController::destroy).
const REFILL_NEXT_STATUS = {
  pending: 'approved',
  approved: 'picked_up',
  picked_up: 'delivered',
}

const REFILL_NEXT_STATUS_LABEL = {
  pending: 'Approve',
  approved: 'Picked Up',
  picked_up: 'Delivered',
}

// Reshapes a Refill into the same flat fields the order table/cards already
// render, so one combined list can show both kinds of rows together (see
// combinedRows below) — a refill has no payment/hostel concept of its own,
// so those columns just read as "Free (subscription)" / blank for it.
function normalizeRefill(refill) {
  return {
    kind: 'refill',
    raw: refill,
    rowKey: `refill-${refill.id}`,
    status: refill.status,
    dateValue: refill.requested_at,
    kg: refill.kg_delivered ?? refill.kg_requested,
    userName: refill.recipient_name || refill.subscriber?.user?.name || '—',
    userPhone: refill.recipient_phone || refill.subscriber?.user?.phone,
    productOrder: refill.product_order,
    attachedProductOrder: refill.attached_product_order,
  }
}

function normalizeOrder(order) {
  return {
    kind: 'order',
    raw: order,
    rowKey: order.id,
    status: order.status,
    dateValue: order.paid_at || order.created_at,
    kg: order.kg,
    userName: order.user?.name || '—',
    userPhone: order.user?.phone,
    productOrder: order.product_order,
    attachedProductOrder: order.attached_product_order,
  }
}

// Mirrors filterOrders' date-range check (api.js) closely enough to reuse
// for a refill's requested_at, without dragging in the hostel/location_type
// matching that function also does (a refill has neither).
function withinDateRange(dateValue, from, to) {
  const date = dateValue ? new Date(dateValue) : null
  if (from && (!date || date < new Date(from))) return false
  if (to) {
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)
    if (!date || date > toDate) return false
  }
  return true
}

// label defaults to the gas-order label map, but a refill row (see
// REFILL_NEXT_STATUS_LABEL) passes its own — this button is shared between
// both kinds now that refills render in the same combined list.
function ActionButton({ nextStatus, currentStatus, updating, onClick, fullWidth, label }) {
  if (!nextStatus) return null

  return (
    <button onClick={onClick} disabled={updating} className={`btn-primary whitespace-nowrap ${fullWidth ? 'w-full' : ''}`}>
      {updating ? 'Updating…' : (label || NEXT_STATUS_LABEL[currentStatus])}
    </button>
  )
}

function AdminDashboard({ token, canViewRefills = false }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  // Defaults to today so the admin lands on what's new right now, not
  // buried under every order ever placed — the existing date-range inputs
  // (see OrderFilters) already let them widen or change this, and the
  // Daily/Weekly/Monthly buttons below (see RANGE_PRESETS) offer quick jumps.
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, from: todayIso(), to: todayIso() }))
  // Tracks which quick preset (if any) produced the current from/to, purely
  // for highlighting the right button — set to null the moment the admin
  // edits the date fields directly via OrderFilters, so no button is left
  // looking "active" for a range it no longer matches.
  const [activePreset, setActivePreset] = useState('daily')
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [selectedRefillId, setSelectedRefillId] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkConfirm, setBulkConfirm] = useState(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [refills, setRefills] = useState([])
  const [refillActionTarget, setRefillActionTarget] = useState(null)
  const [refillUpdatingId, setRefillUpdatingId] = useState(null)
  const [refillBusy, setRefillBusy] = useState(false)
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
        setError('Check your internet connection.')
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()

    const intervalId = setInterval(fetchOrders, POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [token])

  // Refills now show as real rows in the combined list below (see
  // combinedRows), fully actionable — same endpoint AdminRefills.jsx uses.
  // Gated on canViewRefills (manage_subscriptions) same as that page.
  useEffect(() => {
    if (!canViewRefills) {
      setRefills([])
      return undefined
    }

    let cancelled = false

    const fetchRefills = async () => {
      try {
        const response = await apiFetch('/admin/refills?status=all', { token })
        if (!response.ok || cancelled) return
        const data = await response.json()
        if (!cancelled) setRefills(Array.isArray(data) ? data : [])
      } catch {
        // Silent — this page's core data is orders; refills are additive.
      }
    }

    fetchRefills()

    const intervalId = setInterval(fetchRefills, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [token, canViewRefills])

  // Standalone shop orders (not bundled with a gas order/refill) still live
  // only on their own page — just a pending count here, unlike refills.
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
      setError('Check your internet connection.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Soft-deletes an order still awaiting payment (see OrderController::destroy)
  // — the student can still see and pay for it; if they do, it reappears
  // here automatically (the backend restores it). Only ever offered on a
  // 'pending' order; the backend rejects anything else anyway.
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')

    try {
      const response = await apiFetch(`/orders/${deleteTarget.id}`, { method: 'DELETE', token })

      if (!response.ok) {
        setError('Could not delete this order.')
        return
      }

      setOrders((prev) => prev.filter((o) => o.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setError('Check your internet connection.')
    } finally {
      setDeleting(false)
    }
  }

  // Mirrors AdminRefills.jsx's applyUpdate exactly — same endpoint, same
  // status transitions — so acting on a refill row here behaves identically
  // to acting on it from the dedicated Refills page.
  const handleRefillAction = async () => {
    if (!refillActionTarget) return
    const { refill, nextStatus } = refillActionTarget

    setRefillUpdatingId(refill.id)
    setRefillBusy(true)
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

      const updated = await response.json()
      setRefills((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, ...updated, subscriber: { ...r.subscriber, ...updated.subscriber } } : r))
      )
      setRefillActionTarget(null)
    } catch {
      setError('Check your internet connection.')
    } finally {
      setRefillUpdatingId(null)
      setRefillBusy(false)
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

  // Filters by paid_at, not created_at — "today's orders" should mean
  // orders that became real (got paid) today, not ones merely started
  // today. An order created back in September but paid just now belongs
  // under today, same reasoning AdminPayments.jsx already applies. A
  // still-pending order (no paid_at yet) falls back to created_at (see
  // filterOrders in api.js), so it's still findable by when it was opened.
  const filteredOrders = useMemo(() => filterOrders(orders, filters, orderSearchText, 'paid_at'), [orders, filters])

  // Same date range + search + status filter as the orders above, just
  // matched against requested_at instead of paid_at/created_at (a refill
  // has no payment step, see normalizeRefill/withinDateRange above).
  const filteredRefills = useMemo(() => {
    const term = filters.search.trim().toLowerCase()

    return refills.filter((refill) => {
      if (filters.status !== 'all' && refill.status !== filters.status) return false
      if (!withinDateRange(refill.requested_at, filters.from, filters.to)) return false

      if (term) {
        const name = (refill.recipient_name || refill.subscriber?.user?.name || '').toLowerCase()
        if (!name.includes(term)) return false
      }

      return true
    })
  }, [refills, filters])

  // Driven by filteredOrders, not the raw orders list — the cards and the
  // list below are meant to always agree on the same date range (see
  // RANGE_PRESETS / the filter bar), rather than the cards quietly staying
  // all-time while only the list respects the admin's chosen range. Stays
  // order-only, deliberately — a refill isn't revenue (already paid for via
  // the subscription), so folding it into "Total Orders"/"Revenue" would
  // misrepresent both numbers. Only the list below gets the merged rows.
  const stats = useMemo(() => {
    const revenue = filteredOrders
      .filter((order) => PAID_STATUSES.includes(order.status))
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
    const awaitingApproval = filteredOrders.filter((order) => order.status === 'pending').length
    const inProgress = filteredOrders.filter((order) => order.status === 'approved' || order.status === 'picked_up').length

    return { total: filteredOrders.length, revenue, awaitingApproval, inProgress }
  }, [filteredOrders])

  // Orders and today's refills, merged into one list sorted by date —
  // "the main order list" the admin actually looks at for what's happening
  // today, instead of having to also check the separate Refills page.
  const combinedItems = useMemo(() => {
    const combined = [
      ...filteredOrders.map(normalizeOrder),
      ...filteredRefills.map(normalizeRefill),
    ]
    return combined.sort((a, b) => new Date(b.dateValue || 0) - new Date(a.dateValue || 0))
  }, [filteredOrders, filteredRefills])

  const pageCount = Math.max(1, Math.ceil(combinedItems.length / pageSize))
  const visibleItems = useMemo(
    () => paginate(combinedItems, Math.min(page, pageCount), pageSize),
    [combinedItems, page, pageCount, pageSize]
  )

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null
  const selectedRefill = refills.find((refill) => refill.id === selectedRefillId) || null

  const rows = visibleItems.map((item) => ({
    item,
    nextStatus: item.kind === 'order' ? NEXT_STATUS[item.status] : REFILL_NEXT_STATUS[item.status],
    nextStatusLabel: item.kind === 'order' ? NEXT_STATUS_LABEL[item.status] : REFILL_NEXT_STATUS_LABEL[item.status],
    dateLabel: formatDate(item.dateValue),
  }))

  // Only ORDER rows that have a next status (approved/picked_up) can be
  // bulk-advanced — refills aren't included in bulk-select (see
  // AdminRefills.jsx, which has no bulk action either; not inventing a new
  // capability nobody has today), and pending (nothing to advance to yet)
  // and delivered (already done) orders are excluded too.
  const selectableRows = rows.filter((row) => row.item.kind === 'order' && row.nextStatus)
  const allSelectableOnPageSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selectedIds.has(row.item.raw.id))

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelectableOnPageSelected) {
        selectableRows.forEach((row) => next.delete(row.item.raw.id))
      } else {
        selectableRows.forEach((row) => next.add(row.item.raw.id))
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

      {!loading && orders.length === 0 && refills.length === 0 && !error && (
        <EmptyState icon={PackageSearch} title="No orders yet" description="Orders placed by students will show up here." />
      )}

      {!loading && (orders.length > 0 || refills.length > 0) && (
        <>
          <div className="filter-bar">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, from: preset.from(), to: preset.to() }))
                  setActivePreset(preset.key)
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activePreset === preset.key ? 'bg-brand-teal text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <OrderFilters
            filters={filters}
            onChange={(next) => {
              setFilters(next)
              setActivePreset(null)
            }}
            searchPlaceholder="Search by student…"
            resultCount={combinedItems.length}
            totalCount={orders.length + refills.length}
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
                    {rows.map(({ item, nextStatus, nextStatusLabel, dateLabel }) => {
                      const isOrder = item.kind === 'order'
                      const raw = item.raw
                      const phone = item.userPhone
                      const chatUrl = whatsappUrl(phone, `Hello ${item.userName}, this is D'EL-Possibilities about your ${isOrder ? 'gas refill order' : 'subscription refill'} #${raw.id}.`)

                      return (
                        <tr
                          key={item.rowKey}
                          onClick={() => (isOrder ? setSelectedOrderId(raw.id) : setSelectedRefillId(raw.id))}
                          className="cursor-pointer hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {isOrder && nextStatus && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(raw.id)}
                                onChange={() => toggleSelected(raw.id)}
                                aria-label={`Select order #${raw.id}`}
                                className="h-4 w-4 accent-brand-teal"
                              />
                            )}
                          </td>
                          <td className="max-w-[150px] px-4 py-3 font-medium text-brand-navy">
                            <span className="block truncate">{item.userName}</span>
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              {!isOrder && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-teal">
                                  <Droplets className="h-3 w-3" strokeWidth={2} />
                                  Refill
                                </span>
                              )}
                              {(item.productOrder || item.attachedProductOrder) && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-accent">
                                  <ShoppingBag className="h-3 w-3" strokeWidth={2} />
                                  {item.productOrder ? '+ Shop' : '+ Shop (paid)'}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">
                            {isOrder ? (
                              <>
                                {raw.location_type === 'off_campus' && (
                                  <span className="mr-1 rounded-full bg-brand-ember/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ember">
                                    Off-campus
                                  </span>
                                )}
                                {raw.hostel_address}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="figure px-4 py-3 text-slate-600">{item.kg}</td>
                          <td className="figure px-4 py-3 font-medium text-brand-navy">
                            {isOrder ? formatNaira(raw.total_amount) : 'Free'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              status={item.status}
                              label={item.status === 'cancelled' ? 'Cancelled' : STATUS_LABELS[item.status] || item.status}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{dateLabel}</td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {chatUrl && (
                                <a href={chatUrl} target="_blank" rel="noreferrer" className="btn-outline px-3">
                                  <MessageCircle className="h-4 w-4" strokeWidth={2} />
                                </a>
                              )}
                              {isOrder && item.status === 'pending' && (
                                <button
                                  onClick={() => setDeleteTarget(raw)}
                                  aria-label="Delete order"
                                  className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                                </button>
                              )}
                              {!isOrder && item.status === 'pending' && (
                                <button
                                  onClick={() => setRefillActionTarget({ refill: raw, nextStatus: 'cancelled' })}
                                  className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  Cancel
                                </button>
                              )}
                              <ActionButton
                                nextStatus={nextStatus}
                                currentStatus={item.status}
                                label={nextStatusLabel}
                                updating={isOrder ? updatingId === raw.id : refillUpdatingId === raw.id}
                                onClick={() =>
                                  isOrder
                                    ? requestStatusUpdate(raw.id, nextStatus)
                                    : setRefillActionTarget({ refill: raw, nextStatus })
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {rows.map(({ item, nextStatus, nextStatusLabel, dateLabel }) => {
                  const isOrder = item.kind === 'order'
                  const raw = item.raw
                  const phone = item.userPhone
                  const chatUrl = whatsappUrl(phone, `Hello ${item.userName}, this is D'EL-Possibilities about your ${isOrder ? 'gas refill order' : 'subscription refill'} #${raw.id}.`)

                  return (
                    <div
                      key={item.rowKey}
                      onClick={() => (isOrder ? setSelectedOrderId(raw.id) : setSelectedRefillId(raw.id))}
                      className="cursor-pointer rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate font-medium text-brand-navy">
                            {item.userName}
                            {!isOrder && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-teal">
                                <Droplets className="h-3 w-3" strokeWidth={2} />
                                Refill
                              </span>
                            )}
                          </p>
                          <p className="truncate text-sm text-slate-500">{isOrder ? raw.hostel_address : '—'}</p>
                        </div>
                        <StatusBadge
                          status={item.status}
                          label={item.status === 'cancelled' ? 'Cancelled' : STATUS_LABELS[item.status] || item.status}
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                        <span className="figure">{item.kg} kg · {isOrder ? formatNaira(raw.total_amount) : 'Free'}</span>
                        <span className="text-xs text-slate-400">{dateLabel}</span>
                      </div>

                      {(item.productOrder || item.attachedProductOrder) && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-2 py-0.5 text-[10px] font-semibold text-brand-accent">
                          <ShoppingBag className="h-3 w-3" strokeWidth={2} />
                          {item.productOrder ? 'Shop order bundled' : 'Paid shop order attached'}
                        </span>
                      )}

                      {(chatUrl || nextStatus || item.status === 'pending') && (
                        <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {chatUrl && (
                            <a href={chatUrl} target="_blank" rel="noreferrer" className="btn-outline flex-1">
                              <MessageCircle className="h-4 w-4" strokeWidth={2} />
                              WhatsApp
                            </a>
                          )}
                          {isOrder && item.status === 'pending' && (
                            <button
                              onClick={() => setDeleteTarget(raw)}
                              aria-label="Delete order"
                              className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                            </button>
                          )}
                          {!isOrder && item.status === 'pending' && (
                            <button
                              onClick={() => setRefillActionTarget({ refill: raw, nextStatus: 'cancelled' })}
                              className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
                            >
                              Cancel
                            </button>
                          )}
                          <ActionButton
                            nextStatus={nextStatus}
                            currentStatus={item.status}
                            label={nextStatusLabel}
                            updating={isOrder ? updatingId === raw.id : refillUpdatingId === raw.id}
                            onClick={() =>
                              isOrder
                                ? requestStatusUpdate(raw.id, nextStatus)
                                : setRefillActionTarget({ refill: raw, nextStatus })
                            }
                            fullWidth={!chatUrl}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <PaginationControls
                page={Math.min(page, pageCount)}
                pageSize={pageSize}
                total={combinedItems.length}
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
        onDelete={setDeleteTarget}
      />

      <AdminRefillDrawer
        refill={selectedRefill}
        onClose={() => setSelectedRefillId(null)}
        nextStatus={selectedRefill ? REFILL_NEXT_STATUS[selectedRefill.status] : undefined}
        nextStatusLabel={selectedRefill ? REFILL_NEXT_STATUS_LABEL[selectedRefill.status] : undefined}
        updating={selectedRefill ? refillUpdatingId === selectedRefill.id : false}
        onAdvance={() => selectedRefill && setRefillActionTarget({ refill: selectedRefill, nextStatus: REFILL_NEXT_STATUS[selectedRefill.status] })}
        onCancel={() => selectedRefill && setRefillActionTarget({ refill: selectedRefill, nextStatus: 'cancelled' })}
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

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete this order?` : ''}
        message="The student can still see it and pay for it — it's only hidden from the admin side. If they pay, it reappears here automatically."
        confirmLabel="Delete Order"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!refillActionTarget}
        title={
          refillActionTarget?.nextStatus === 'cancelled'
            ? 'Cancel this refill request?'
            : refillActionTarget
              ? `Mark this refill as ${REFILL_NEXT_STATUS_LABEL[refillActionTarget.refill.status]}?`
              : ''
        }
        message={
          refillActionTarget?.nextStatus === 'cancelled'
            ? 'The student can request another one anytime.'
            : refillActionTarget?.nextStatus === 'delivered'
              ? `Delivers ${refillActionTarget.refill.kg_requested || ''} kg, free — deducted from the subscriber's remaining kg.`
              : 'This updates the refill status — make sure this matches what actually happened.'
        }
        confirmLabel={refillActionTarget?.nextStatus === 'cancelled' ? 'Cancel Request' : 'Confirm'}
        tone={refillActionTarget?.nextStatus === 'cancelled' ? 'danger' : 'default'}
        busy={refillBusy}
        onConfirm={handleRefillAction}
        onCancel={() => setRefillActionTarget(null)}
      />
    </div>
  )
}

export default AdminDashboard
