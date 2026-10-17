import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, PackageX, MapPin, Wallet, Pencil } from 'lucide-react'
import ConnectionError from '../components/ConnectionError'
import { SkeletonRows } from '../components/Skeleton'
import { apiFetch, resolveImageUrl, formatNaira, formatDate, STATUS_LABELS } from '../api'
import { useToast } from '../toastContext'
import StatusBadge from '../StatusBadge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import OrderTimeline from '../components/OrderTimeline'
import PaymentGatewayModal from '../components/PaymentGatewayModal'
import { usePaymentCheckout } from '../hooks/usePaymentCheckout'

// One shop cart riding on this refill. Rendered up to twice — once for a
// cart bundled unpaid into this order's charge (order.product_order), once
// for a cart that was paid standalone and is just tagged along for delivery
// (order.attached_product_order). The two are independent, so both can show.
function ShopBundleCard({ productOrder, title }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-base font-bold text-brand-navy">{title}</h3>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            productOrder.status === 'pending'
              ? 'bg-amber-100 text-amber-700'
              : productOrder.status === 'cancelled'
                ? 'bg-slate-100 text-slate-500'
                : 'bg-brand-teal/10 text-brand-teal'
          }`}
        >
          {productOrder.status === 'pending'
            ? 'Not yet paid'
            : productOrder.status === 'cancelled'
              ? 'Cancelled'
              : 'Paid'}
        </span>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        {productOrder.items?.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <span className="text-slate-600">
              {item.quantity} × {item.product_name}
              {item.variant_label ? ` (${item.variant_label})` : ''}
            </span>
            <span className="figure font-medium text-brand-navy">{formatNaira(item.line_total)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <span className="font-medium text-slate-600">Shop total</span>
        <span className="figure text-base font-bold text-brand-navy">{formatNaira(productOrder.total_amount)}</span>
      </div>
    </div>
  )
}

// There's no GET /orders/{id} endpoint for students — only the full
// /my-orders list. Fetching that and finding the match by id avoids adding
// a new authenticated backend route just for this page.
function OrderDetail({ token }) {
  const { id } = useParams()
  const { show } = useToast()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const { startPayment: startGatewayPayment, pickerOpen, pickerBusy, chooseGateway, cancelPicker } = usePaymentCheckout(token)

  // Deliberately NOT served from the offline cache (unlike the order list):
  // this page carries payment state and the Pay button, which must always
  // reflect the server.
  const [offline, setOffline] = useState(false)

  const loadOrders = () => {
    setError('')
    setOffline(false)

    return apiFetch('/my-orders', { token })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('http'))))
      .then((data) => setOrders(Array.isArray(data) ? data : data.orders || data.data || []))
      .catch((err) => {
        if (err instanceof Error && err.message === 'http') setError('Could not load this order.')
        else setOffline(true)
      })
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const order = orders?.find((o) => String(o.id) === id)

  const handlePayNow = async () => {
    setPaying(true)
    try {
      const { ok, data, cancelled } = await startGatewayPayment('order', order.id)

      if (cancelled) {
        setPaying(false)
        return
      }

      if (!ok || !data?.authorization_url) {
        show(data?.message || 'Could not start payment.', { type: 'error' })
        setPaying(false)
        return
      }

      window.location.href = data.authorization_url
    } catch {
      show('Check your internet connection.', { type: 'error' })
      setPaying(false)
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="alert-error">{error}</p>
      </div>
    )
  }

  if (orders === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="skeleton h-72 w-full" />
      </div>
    )
  }

  if (!order && (orders === null || offline) && !error) {
    return (
      <div className="mx-auto max-w-3xl">
        {offline ? <ConnectionError onRetry={loadOrders} /> : <SkeletonRows rows={4} />}
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={PackageX}
          title="Order not found"
          description="This order doesn't exist or isn't yours."
          action={
            <Link to="/orders" className="btn-primary mt-2">
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Back to My Orders
            </Link>
          }
        />
      </div>
    )
  }

  const imageSrc = resolveImageUrl(order.cylinder_image_url)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={`Order #${order.id}`}
        title={`${order.kg} kg refill`}
        subtitle={formatDate(order.created_at)}
        action={
          <Link to="/orders" className="btn-outline">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            All Orders
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="panel-card p-6 pt-8 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <span className="eyebrow">Status</span>
            <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
          </div>
          <OrderTimeline status={order.status} />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-3">
          {imageSrc && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <img src={imageSrc} alt="Cylinder" width={640} height={224} loading="lazy" decoding="async" className="h-56 w-full object-cover" />
            </div>
          )}

          <div className="card">
            <h3 className="mb-4 font-heading text-base font-bold text-brand-navy">Order information</h3>
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


              {order.loyalty_discount_applied && (
                <div className="flex items-center justify-between">
                  <span className="text-brand-teal">Loyalty discount</span>
                  <span className="figure font-medium text-brand-teal">&minus;{formatNaira(order.loyalty_discount_amount)}</span>
                </div>
              )}

              {Number(order.referral_discount_amount) > 0 && (() => {
                // Referral discounts a gas order AFTER the loyalty discount
                // (see OrderController::store), so the base for "what % was
                // this" is what was left post-loyalty, not the full gas cost.
                const gasCost = order.kg * order.price_per_kg
                const baseAfterLoyalty = order.loyalty_discount_applied ? gasCost - order.loyalty_discount_amount : gasCost
                const percent = baseAfterLoyalty > 0 ? Math.round((order.referral_discount_amount / baseAfterLoyalty) * 100) : 0
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-brand-teal">Referral discount ({percent}%)</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(order.referral_discount_amount)}</span>
                  </div>
                )
              })()}

              {Number(order.vvip_discount_amount) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-brand-teal">VVIP discount — gas is free</span>
                  <span className="figure font-medium text-brand-teal">&minus;{formatNaira(order.vvip_discount_amount)}</span>
                </div>
              )}


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
                <span className="text-right text-slate-700">{order.hostel_address}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Wallet className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.8} />
                  Payment
                </span>
                <span className="text-slate-700">
                  {order.payment_gateway === 'flutterwave'
                    ? 'Paid via Flutterwave'
                    : order.payment_gateway === 'paystack' || order.paystack_reference
                      ? 'Paid via Paystack'
                      : 'Not yet paid'}
                </span>
              </div>
            </div>

            {order.status === 'pending' && (
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={handlePayNow} disabled={paying} className="btn-primary w-full">
                  {paying ? 'Redirecting…' : 'Pay Now'}
                </button>
                <Link to={`/orders/${order.id}/edit`} className="btn-outline w-full">
                  <Pencil className="h-4 w-4" strokeWidth={1.8} />
                  Not satisfied? Edit this order
                </Link>
              </div>
            )}
          </div>

          {order.product_order && (
            <ShopBundleCard productOrder={order.product_order} title="Shopped with this refill" />
          )}
          {order.attached_product_order && (
            <ShopBundleCard
              productOrder={order.attached_product_order}
              title="Paid cart delivered with this refill"
            />
          )}
        </div>
      </div>

      <PaymentGatewayModal open={pickerOpen} busy={pickerBusy} onChoose={chooseGateway} onCancel={cancelPicker} />
    </div>
  )
}

export default OrderDetail
