import { useState, useEffect } from 'react'
import { apiFetch, resolveImageUrl, STATUS_LABELS } from '../api'
import StatusBadge from '../StatusBadge'

function redirectToPayment(authorizationUrl) {
  window.location.href = authorizationUrl
}

function CylinderThumbnail({ src }) {
  if (src) {
    return <img src={src} alt="Cylinder" className="h-40 w-full object-cover" />
  }

  return (
    <div className="flex h-40 w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
      No image
    </div>
  )
}

function MyOrders({ token }) {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [payingId, setPayingId] = useState(null)

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

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-2xl font-semibold text-brand-navy">My Orders</h2>

      {error && <p className="alert-error mb-6">{error}</p>}

      {orders.length === 0 && !error && (
        <div className="card text-center text-slate-500">No orders yet.</div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => {
          const imageSrc = resolveImageUrl(order.cylinder_image_url)

          return (
            <div key={order.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-md">
              <CylinderThumbnail src={imageSrc} />

              <div className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-brand-navy">{order.kg} kg</span>
                  <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                </div>

                <p className="text-sm text-slate-500">{order.hostel_address}</p>
                <p className="text-sm font-medium text-slate-700">Total: {order.total_amount}</p>

                {order.status === 'pending' && (
                  <button
                    onClick={() => handlePayNow(order.id)}
                    disabled={payingId === order.id}
                    className="btn-primary mt-2"
                  >
                    {payingId === order.id ? 'Redirecting…' : 'Pay Now'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MyOrders
