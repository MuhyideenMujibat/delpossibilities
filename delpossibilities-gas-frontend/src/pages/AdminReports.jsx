import { useState, useEffect, useMemo } from 'react'
import { BarChart3, Wallet, Package, Scale, Download, MapPin, Flame, Truck } from 'lucide-react'
import { apiFetch, formatNaira, filterOrders, PAID_STATUSES, STATUS_LABELS } from '../api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { EMPTY_FILTERS } from '../components/OrderFilters'

const DAY_MS = 24 * 60 * 60 * 1000

const RANGE_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: null },
]

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days) {
  return isoDate(new Date(Date.now() - days * DAY_MS))
}

function buildDailySeries(orders, days) {
  const buckets = new Map()
  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.set(daysAgo(i), 0)
  }

  orders.forEach((order) => {
    if (!PAID_STATUSES.includes(order.status) || !order.created_at) return
    const key = isoDate(new Date(order.created_at))
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key) + Number(order.total_amount || 0))
    }
  })

  return Array.from(buckets.entries()).map(([date, revenue]) => ({ date, revenue }))
}

function downloadCsv(orders) {
  const header = ['ID', 'Student', 'Hostel', 'Kg', 'Price/Kg', 'Delivery Fee', 'Total', 'Status', 'Created At']
  const rows = orders.map((order) => [
    order.id,
    order.user?.name || '',
    order.hostel_address || '',
    order.kg,
    order.price_per_kg,
    order.delivery_fee || 0,
    order.total_amount,
    STATUS_LABELS[order.status] || order.status,
    order.created_at,
  ])

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `orders-report-${isoDate(new Date())}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function AdminReports({ token }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rangeDays, setRangeDays] = useState(30)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await apiFetch('/orders', { token })

        if (!response.ok) {
          setError('Could not load report data.')
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

  const rangeFilters = useMemo(() => {
    if (!rangeDays) return EMPTY_FILTERS
    return { ...EMPTY_FILTERS, from: daysAgo(rangeDays - 1) }
  }, [rangeDays])

  const rangeOrders = useMemo(() => filterOrders(orders, rangeFilters), [orders, rangeFilters])

  const summary = useMemo(() => {
    const paid = rangeOrders.filter((order) => PAID_STATUSES.includes(order.status))
    const revenue = paid.reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
    const deliveryRevenue = paid.reduce((sum, order) => sum + Number(order.delivery_fee || 0), 0)
    const gasRevenue = revenue - deliveryRevenue
    const kg = paid.reduce((sum, order) => sum + Number(order.kg || 0), 0)
    const avgOrder = paid.length ? revenue / paid.length : 0

    return { totalOrders: rangeOrders.length, revenue, gasRevenue, deliveryRevenue, kg, avgOrder, paidCount: paid.length }
  }, [rangeOrders])

  const statusBreakdown = useMemo(() => {
    const counts = {}
    rangeOrders.forEach((order) => {
      counts[order.status] = (counts[order.status] || 0) + 1
    })
    const max = Math.max(1, ...Object.values(counts))
    return Object.entries(STATUS_LABELS).map(([status, label]) => ({
      status,
      label,
      count: counts[status] || 0,
      pct: Math.round(((counts[status] || 0) / max) * 100),
    }))
  }, [rangeOrders])

  const topHostels = useMemo(() => {
    const totals = {}
    rangeOrders.forEach((order) => {
      const key = order.hostel_address || 'Unknown'
      if (!totals[key]) totals[key] = { hostel: key, orders: 0, revenue: 0 }
      totals[key].orders += 1
      if (PAID_STATUSES.includes(order.status)) {
        totals[key].revenue += Number(order.total_amount || 0)
      }
    })
    return Object.values(totals)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [rangeOrders])

  const series = useMemo(() => buildDailySeries(rangeOrders, Math.min(rangeDays || 30, 30)), [rangeOrders, rangeDays])
  const seriesMax = Math.max(1, ...series.map((point) => point.revenue))

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reports"
        subtitle="Revenue, volume, and delivery insight across all campus orders."
        icon={BarChart3}
        action={
          <button onClick={() => downloadCsv(rangeOrders)} disabled={rangeOrders.length === 0} className="btn-outline">
            <Download className="h-4 w-4" strokeWidth={2} />
            Export CSV
          </button>
        }
      />

      <div className="filter-bar">
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setRangeDays(preset.days)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              rangeDays === preset.days ? 'bg-brand-teal text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
          {rangeOrders.length} order{rangeOrders.length === 1 ? '' : 's'} in range
        </span>
      </div>

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && orders.length === 0 && !error && (
        <EmptyState icon={BarChart3} title="No data yet" description="Reports will populate once students start ordering." />
      )}

      {!loading && orders.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Orders" value={summary.totalOrders} icon={Package} tone="navy" hint={`${summary.paidCount} paid`} />
            <StatCard label="Total Revenue" value={formatNaira(summary.revenue)} icon={Wallet} tone="teal" />
            <StatCard label="Gas Revenue" value={formatNaira(summary.gasRevenue)} icon={Flame} tone="accent" hint="Excludes delivery fees" />
            <StatCard label="Delivery Fees" value={formatNaira(summary.deliveryRevenue)} icon={Truck} tone="amber" />
            <StatCard label="Gas Sold" value={`${summary.kg.toFixed(1)} kg`} icon={Scale} tone="navy" />
            <StatCard label="Avg Order Value" value={formatNaira(summary.avgOrder)} icon={BarChart3} tone="teal" />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="panel-card p-5 pt-7 lg:col-span-2">
              <h3 className="mb-4 font-heading text-sm font-bold text-brand-navy">Daily revenue</h3>
              <div className="flex h-40 gap-1">
                {series.map((point) => (
                  <div key={point.date} className="group relative flex-1">
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-t bg-brand-teal/80 transition-colors group-hover:bg-brand-teal"
                      style={{ height: `${Math.max(4, (point.revenue / seriesMax) * 100)}%` }}
                    />
                    <div className="figure pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-brand-navy px-2 py-1 text-[10px] text-white group-hover:block">
                      {formatNaira(point.revenue)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="eyebrow mt-2 flex justify-between text-[10px]">
                <span>{series[0]?.date}</span>
                <span>{series[series.length - 1]?.date}</span>
              </div>
            </div>

            <div className="panel-card p-5 pt-7">
              <h3 className="mb-4 font-heading text-sm font-bold text-brand-navy">Orders by status</h3>
              <div className="flex flex-col gap-3">
                {statusBreakdown.map((row) => (
                  <div key={row.status}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{row.label}</span>
                      <span className="figure font-medium text-brand-navy">{row.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-teal" style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel-card p-5 pt-7">
            <h3 className="mb-4 font-heading text-sm font-bold text-brand-navy">Top hostels by revenue</h3>
            {topHostels.length === 0 ? (
              <p className="text-sm text-slate-400">No orders in this range.</p>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100">
                {topHostels.map((row, index) => (
                  <div key={row.hostel} className="flex items-center gap-3 py-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-bg text-xs font-semibold text-brand-navy">
                      {index + 1}
                    </span>
                    <MapPin className="h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{row.hostel}</span>
                    <span className="figure whitespace-nowrap text-xs text-slate-400">{row.orders} order{row.orders === 1 ? '' : 's'}</span>
                    <span className="figure whitespace-nowrap text-sm font-medium text-brand-navy">{formatNaira(row.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default AdminReports
