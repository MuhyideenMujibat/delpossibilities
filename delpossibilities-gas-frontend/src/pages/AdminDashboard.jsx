import { useState, useEffect } from 'react'
import { apiFetch, resolveImageUrl, STATUS_LABELS } from '../api'
import StatusBadge from '../StatusBadge'

const POLL_INTERVAL_MS = 30000

const NEXT_STATUS = {
  approved: 'picked_up',
  picked_up: 'delivered',
}

const NEXT_STATUS_LABEL = {
  approved: 'Mark as Picked Up',
  picked_up: 'Mark as Delivered',
}

function sortByCreatedAtDesc(orders) {
  return [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

function Thumbnail({ src, size = 'h-10 w-10' }) {
  if (src) {
    return (
      <img
        src={src}
        alt="Cylinder"
        className={`${size} flex-shrink-0 rounded-lg object-cover`}
      />
    )
  }

  return (
    <div className={`${size} flex flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400`}>
      N/A
    </div>
  )
}

function ActionButton({ nextStatus, currentStatus, updating, onClick, fullWidth }) {
  if (!nextStatus) return null

  return (
    <button onClick={onClick} disabled={updating} className={`btn-primary whitespace-nowrap ${fullWidth ? 'w-full' : ''}`}>
      {updating ? 'Updating…' : NEXT_STATUS_LABEL[currentStatus]}
    </button>
  )
}

function AdminDashboard({ token }) {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

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
      }
    }

    fetchOrders()

    const intervalId = setInterval(fetchOrders, POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [token])

  const handleStatusUpdate = async (orderId, nextStatus) => {
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

  const rows = orders.map((order) => ({
    order,
    imageSrc: resolveImageUrl(order.cylinder_image_url),
    nextStatus: NEXT_STATUS[order.status],
    createdLabel: new Date(order.created_at).toLocaleString(),
  }))

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-2xl font-semibold text-brand-navy">Admin Dashboard</h2>

      {error && <p className="alert-error mb-6">{error}</p>}

      {rows.length === 0 && !error && (
        <div className="card text-center text-slate-500">No orders yet.</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium"></th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Hostel</th>
                  <th className="px-4 py-3 font-medium">Kg</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ order, imageSrc, nextStatus, createdLabel }) => (
                  <tr key={order.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Thumbnail src={imageSrc} />
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 font-medium text-brand-navy">{order.user?.name}</td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">{order.hostel_address}</td>
                    <td className="px-4 py-3 text-slate-600">{order.kg}</td>
                    <td className="px-4 py-3 font-medium text-brand-navy">{order.total_amount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{createdLabel}</td>
                    <td className="px-4 py-3 text-right">
                      <ActionButton
                        nextStatus={nextStatus}
                        currentStatus={order.status}
                        updating={updatingId === order.id}
                        onClick={() => handleStatusUpdate(order.id, nextStatus)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {rows.map(({ order, imageSrc, nextStatus, createdLabel }) => (
              <div key={order.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Thumbnail src={imageSrc} size="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-brand-navy">{order.user?.name}</p>
                    <p className="truncate text-sm text-slate-500">{order.hostel_address}</p>
                  </div>
                  <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                </div>

                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <span>{order.kg} kg · {order.total_amount}</span>
                  <span className="text-xs text-slate-400">{createdLabel}</span>
                </div>

                {nextStatus && (
                  <div className="mt-3">
                    <ActionButton
                      nextStatus={nextStatus}
                      currentStatus={order.status}
                      updating={updatingId === order.id}
                      onClick={() => handleStatusUpdate(order.id, nextStatus)}
                      fullWidth
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default AdminDashboard
