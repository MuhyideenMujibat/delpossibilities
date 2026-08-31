import { X, Mail, Phone, MapPin, Home, MessageCircle } from 'lucide-react'
import { resolveImageUrl, formatNaira, formatDate, STATUS_LABELS, whatsappUrl } from '../api'
import StatusBadge from '../StatusBadge'
import OrderTimeline from './OrderTimeline'

const NEXT_STATUS_LABEL = {
  approved: 'Picked Up',
  picked_up: 'Delivered',
}

function AdminOrderDrawer({ order, onClose, onAdvance, updating, nextStatus }) {
  if (!order) return null

  const imageSrc = resolveImageUrl(order.cylinder_image_url)
  const chatUrl = whatsappUrl(order.user?.phone, `Hello ${order.user?.name || ''}, this is D'EL-Possibilities about your gas refill order #${order.id}.`)

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="eyebrow">Order #{order.id}</p>
            <h3 className="font-heading text-lg font-bold text-brand-navy">{order.user?.name}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {imageSrc && (
            <div className="mb-5 overflow-hidden rounded-2xl border border-slate-100">
              <img src={imageSrc} alt="Cylinder" className="h-48 w-full object-cover" />
            </div>
          )}

          <div className="mb-5 flex items-center justify-between">
            <span className="eyebrow">Status</span>
            <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
          </div>

          <OrderTimeline status={order.status} className="mb-6" />

          <div className="mb-6 rounded-xl border border-slate-100 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</h4>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
                {order.user?.email || '—'}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
                {chatUrl ? (
                  <a href={chatUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-teal hover:underline">
                    {order.user?.phone}
                  </a>
                ) : (
                  '—'
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Home className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
                {order.user?.hostel || '—'}
                <span className="text-xs text-slate-400">(profile)</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Order</h4>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Refill size</span>
                <span className="figure font-medium text-brand-navy">{order.kg} kg</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Price per kg</span>
                <span className="figure font-medium text-brand-navy">{formatNaira(order.price_per_kg)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Gas cost</span>
                <span className="figure font-medium text-brand-navy">{formatNaira(order.kg * order.price_per_kg)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Delivery fee</span>
                <span className="figure font-medium text-brand-navy">{formatNaira(order.delivery_fee || 0)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="font-medium text-slate-600">Total</span>
                <span className="figure text-base font-bold text-brand-navy">{formatNaira(order.total_amount)}</span>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.8} />
                  Delivery address
                </span>
                <span className="text-right text-slate-700">
                  {order.location_type === 'off_campus' && (
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-ember">Off-campus</span>
                  )}
                  {order.hostel_address}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-slate-500">Placed</span>
                <span className="text-slate-700">{formatDate(order.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Payment</span>
                <span className="text-slate-700">{order.paystack_reference ? 'Paid via Paystack' : 'Not yet paid'}</span>
              </div>
              {order.paystack_reference && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Reference</span>
                  <span className="figure truncate text-xs text-slate-700">{order.paystack_reference}</span>
                </div>
              )}
              {order.paid_at && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Paid on</span>
                  <span className="text-slate-700">{formatDate(order.paid_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {(chatUrl || nextStatus) && (
          <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
            {chatUrl && (
              <a href={chatUrl} target="_blank" rel="noreferrer" className="btn-outline flex-1">
                <MessageCircle className="h-4 w-4" strokeWidth={2} />
                WhatsApp
              </a>
            )}
            {nextStatus && (
              <button onClick={onAdvance} disabled={updating} className="btn-primary w-full">
                {updating ? 'Updating…' : `Mark ${NEXT_STATUS_LABEL[order.status]}`}
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

export default AdminOrderDrawer
