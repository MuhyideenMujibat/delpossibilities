import { useState } from 'react'
import { X, Phone, MessageCircle, ShoppingBag, Expand } from 'lucide-react'
import { resolveImageUrl, formatNaira, formatDate, whatsappUrl } from '../api'
import StatusBadge from '../StatusBadge'
import ImageLightbox from './ImageLightbox'

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }

// Mirrors AdminOrderDrawer's shape for a Refill instead of a gas Order —
// opened from a refill row in the combined Gas Orders list (AdminDashboard)
// so admin can preview the cylinder photo full-size (same ImageLightbox,
// same download behavior) and act on it without a separate trip to the
// dedicated Refills page. No OrderTimeline here deliberately — a refill can
// be 'cancelled', which doesn't fit a linear progress strip the way a gas
// order's statuses do.
function AdminRefillDrawer({ refill, onClose, onAdvance, onCancel, updating, nextStatus, nextStatusLabel }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (!refill) return null

  const imageSrc = resolveImageUrl(refill.cylinder_image_url)
  const studentName = refill.recipient_name || refill.subscriber?.user?.name
  const phone = refill.recipient_phone || refill.subscriber?.user?.phone
  const chatUrl = whatsappUrl(phone, `Hello ${studentName || ''}, this is D'EL-Possibilities about your subscription refill #${refill.id}.`)
  const cart = refill.product_order || refill.attached_product_order

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="eyebrow">Refill #{refill.id}</p>
            <h3 className="font-heading text-lg font-bold text-brand-navy">{studentName || '—'}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {imageSrc && (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="group relative mb-5 block w-full overflow-hidden rounded-2xl border border-slate-100"
            >
              <img src={imageSrc} alt="Cylinder" width={640} height={192} loading="lazy" decoding="async" className="h-48 w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 text-sm font-medium text-white opacity-0 transition-colors group-hover:bg-black/40 group-hover:opacity-100">
                <Expand className="h-4 w-4" strokeWidth={2} />
                View full image
              </span>
            </button>
          )}

          <div className="mb-5 flex items-center justify-between gap-2">
            <span className="eyebrow">Status</span>
            <div className="flex items-center gap-1.5">
              {cart && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-2 py-0.5 text-[10px] font-semibold text-brand-accent">
                  <ShoppingBag className="h-3 w-3" strokeWidth={2} />
                  {refill.product_order ? 'Shop bundled' : 'Shop attached'}
                </span>
              )}
              <StatusBadge status={refill.status} label={STATUS_LABELS[refill.status] || refill.status} />
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-slate-100 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Subscriber</h4>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="figure font-medium text-brand-navy">{refill.subscriber?.customer_id || '—'}</span>
                {TIER_LABELS[refill.subscriber?.plan?.tier] && (
                  <span className="text-slate-400">· {TIER_LABELS[refill.subscriber.plan.tier]}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
                {chatUrl ? (
                  <a href={chatUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-teal hover:underline">
                    {phone}
                  </a>
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Refill</h4>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Kg requested</span>
                <span className="figure font-medium text-brand-navy">{refill.kg_requested ? `${refill.kg_requested} kg` : '—'}</span>
              </div>
              {refill.kg_delivered && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Kg delivered</span>
                  <span className="figure font-medium text-brand-navy">{refill.kg_delivered} kg</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-slate-500">Requested</span>
                <span className="text-slate-700">{formatDate(refill.requested_at)}</span>
              </div>
              {refill.delivered_at && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Delivered</span>
                  <span className="text-slate-700">{formatDate(refill.delivered_at)}</span>
                </div>
              )}
            </div>
          </div>

          {cart && (
            <div className="mt-6 rounded-xl border border-brand-accent/30 bg-brand-accent/5 p-4">
              <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-accent">
                <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} />
                {refill.product_order ? 'Shop order bundled with this refill' : 'Paid shop order attached to this refill'}
              </h4>
              <div className="flex flex-col gap-1.5 text-sm">
                {cart.items?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">
                      {item.product_name}
                      {item.variant_label ? ` · ${item.variant_label}` : ''}
                      <span className="text-slate-400"> ×{item.quantity}</span>
                    </span>
                    <span className="figure text-slate-500">{formatNaira(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-brand-accent/20 pt-2 text-sm font-medium text-slate-600">
                <span>Cart total</span>
                <span className="figure">{formatNaira(cart.total_amount)}</span>
              </div>
            </div>
          )}
        </div>

        {(chatUrl || nextStatus || refill.status === 'pending') && (
          <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
            {chatUrl && (
              <a href={chatUrl} target="_blank" rel="noreferrer" className="btn-outline flex-1">
                <MessageCircle className="h-4 w-4" strokeWidth={2} />
                WhatsApp
              </a>
            )}
            {refill.status === 'pending' && (
              <button onClick={onCancel} className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600">
                Cancel
              </button>
            )}
            {nextStatus && (
              <button onClick={onAdvance} disabled={updating} className="btn-primary w-full">
                {updating ? 'Updating…' : nextStatusLabel}
              </button>
            )}
          </div>
        )}
      </aside>

      <ImageLightbox src={imageSrc} alt={`Cylinder for refill ${refill.id}`} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </div>
  )
}

export default AdminRefillDrawer
