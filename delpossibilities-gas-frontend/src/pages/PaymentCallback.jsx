import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle, HelpCircle } from 'lucide-react'
import { apiFetch, formatNaira } from '../api'
import { useCurrentUser } from '../userContext'

// Paystack's redirect only carries a `reference` — it doesn't tell us
// whether the charge succeeded. Rather than waiting on the webhook (which
// requires Paystack's servers to reach ours — impossible in local dev, and
// not instant even in production), this page calls verify-payment, which
// has the backend ask Paystack directly and update the order synchronously.
// Subscription and standalone cart-checkout payments reuse this same
// callback page (one shared FRONTEND_PAYMENT_CALLBACK_URL on the backend
// for all three flows) — the reference's prefix ('order_...' vs
// 'subscription_...' vs 'product_order_...', see OrderController::pay /
// SubscriberController::pay / ProductOrderController::pay) says which this is.
const isSubscriptionReference = (reference) => reference.startsWith('subscription_')
const isProductOrderReference = (reference) => reference.startsWith('product_order_')

function PaymentCallback({ token }) {
  const [searchParams] = useSearchParams()
  const { refresh: refreshUser } = useCurrentUser()
  const reference = searchParams.get('reference') || searchParams.get('trxref') || ''
  const [phase, setPhase] = useState('checking') // checking | confirmed | failed | unknown
  const [order, setOrder] = useState(null)
  const [loyalty, setLoyalty] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [productOrder, setProductOrder] = useState(null)
  const isSubscription = isSubscriptionReference(reference)
  const isProductOrder = isProductOrderReference(reference)

  useEffect(() => {
    let cancelled = false

    const runOrder = async () => {
      try {
        const response = await apiFetch('/my-orders', { token })
        if (!response.ok) throw new Error()
        const data = await response.json()
        const orders = Array.isArray(data) ? data : data.orders || data.data || []

        const match = reference
          ? orders.find((o) => o.paystack_reference === reference)
          : [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

        if (!match) {
          if (!cancelled) setPhase('unknown')
          return
        }

        if (match.status !== 'pending') {
          if (!cancelled) {
            setOrder(match)
            setPhase('confirmed')
            // Pull a fresh /user so the order page shows updated loyalty
            // progress without a manual reload.
            refreshUser()
          }
          return
        }

        const verifyResponse = await apiFetch(`/orders/${match.id}/verify-payment`, { method: 'POST', token })
        const verifyData = await verifyResponse.json().catch(() => null)

        if (cancelled) return

        if (verifyResponse.ok && verifyData?.order && verifyData.order.status !== 'pending') {
          setOrder(verifyData.order)
          setLoyalty(verifyData.loyalty || null)
          setPhase('confirmed')
          // Pull a fresh /user so the order page shows updated loyalty
          // progress without a manual reload.
          refreshUser()
          return
        }

        if (verifyResponse.ok && ['failed', 'abandoned'].includes(verifyData?.paystack_status)) {
          setOrder(match)
          setPhase('failed')
          return
        }

        setOrder(match)
        setPhase('unknown')
      } catch {
        if (!cancelled) setPhase('unknown')
      }
    }

    // A subscriber only ever has one payment in flight at a time, so unlike
    // orders there's no need to match by reference — /my-subscription always
    // hands back the one being paid for.
    const runSubscription = async () => {
      try {
        const response = await apiFetch('/my-subscription', { token })
        if (!response.ok) throw new Error()
        const match = await response.json()

        if (!match) {
          if (!cancelled) setPhase('unknown')
          return
        }

        if (match.status !== 'pending') {
          if (!cancelled) {
            setSubscription(match)
            setPhase('confirmed')
          }
          return
        }

        const verifyResponse = await apiFetch(`/subscribers/${match.id}/verify-payment`, { method: 'POST', token })
        const verifyData = await verifyResponse.json().catch(() => null)

        if (cancelled) return

        if (verifyResponse.ok && verifyData?.subscriber && verifyData.subscriber.status !== 'pending') {
          setSubscription(verifyData.subscriber)
          setPhase('confirmed')
          return
        }

        if (verifyResponse.ok && ['failed', 'abandoned'].includes(verifyData?.paystack_status)) {
          setSubscription(match)
          setPhase('failed')
          return
        }

        setSubscription(match)
        setPhase('unknown')
      } catch {
        if (!cancelled) setPhase('unknown')
      }
    }

    // Unlike a subscriber (which blocks a second `pending` row), nothing
    // stops a student from starting, abandoning, and restarting a
    // standalone cart checkout — so "latest" product order isn't
    // guaranteed to be the one just paid for. Guard against misreporting a
    // different purchase's status by matching the reference explicitly.
    const runProductOrder = async () => {
      try {
        const response = await apiFetch('/my-product-order', { token })
        if (!response.ok) throw new Error()
        const match = await response.json()

        if (!match || match.paystack_reference !== reference) {
          if (!cancelled) setPhase('unknown')
          return
        }

        if (match.status !== 'pending') {
          if (!cancelled) {
            setProductOrder(match)
            setPhase('confirmed')
          }
          return
        }

        const verifyResponse = await apiFetch(`/product-orders/${match.id}/verify-payment`, { method: 'POST', token })
        const verifyData = await verifyResponse.json().catch(() => null)

        if (cancelled) return

        if (verifyResponse.ok && verifyData?.product_order && verifyData.product_order.status !== 'pending') {
          setProductOrder(verifyData.product_order)
          setPhase('confirmed')
          return
        }

        if (verifyResponse.ok && ['failed', 'abandoned'].includes(verifyData?.paystack_status)) {
          setProductOrder(match)
          setPhase('failed')
          return
        }

        setProductOrder(match)
        setPhase('unknown')
      } catch {
        if (!cancelled) setPhase('unknown')
      }
    }

    if (isSubscription) {
      runSubscription()
    } else if (isProductOrder) {
      runProductOrder()
    } else {
      runOrder()
    }

    return () => {
      cancelled = true
    }
    // refreshUser is a fresh function each render (UserProvider doesn't
    // memoize it) — deliberately excluded so this doesn't re-run every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reference, isSubscription, isProductOrder])

  return (
    <div className="mx-auto max-w-md">
      <div className="panel-card p-8 pt-10 text-center">
        {phase === 'checking' && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-teal" strokeWidth={1.8} />
            <h2 className="mt-4 font-heading text-xl font-bold text-brand-navy">Confirming your payment…</h2>
            <p className="mt-2 text-sm text-slate-500">This usually takes a few seconds.</p>
          </>
        )}

        {phase === 'confirmed' && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" strokeWidth={1.6} />
            <h2 className="mt-4 font-heading text-xl font-bold text-brand-navy">Payment Successful 🎉</h2>
            <p className="mt-2 text-sm text-slate-500">
              {isSubscription
                ? 'Your subscription is now active.'
                : isProductOrder
                  ? 'Your order has been received.'
                  : 'Your gas refill order has been received.'}
            </p>

            {productOrder && isProductOrder && (
              <div className="mt-6 rounded-xl bg-brand-bg px-4 py-3 text-left text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(productOrder.subtotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Delivery fee</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(productOrder.delivery_fee)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Amount paid</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(productOrder.total_amount)}</span>
                </div>
              </div>
            )}

            {order && !isSubscription && !isProductOrder && (
              <div className="mt-6 rounded-xl bg-brand-bg px-4 py-3 text-left text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Order</span>
                  <span className="figure font-medium text-brand-navy">#{order.id}</span>
                </div>
                {order.loyalty_discount_applied && (
                  <>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-slate-500">Gas cost{order.kg ? ` (${order.kg} kg)` : ''}</span>
                      <span className="figure font-medium text-brand-navy">
                        {formatNaira(Number(order.kg) * Number(order.price_per_kg))}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-brand-teal">Loyalty discount</span>
                      <span className="figure font-medium text-brand-teal">
                        &minus;{formatNaira(order.loyalty_discount_amount)}
                      </span>
                    </div>
                    {Number(order.delivery_fee) > 0 && (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-slate-500">Delivery fee</span>
                        <span className="figure font-medium text-brand-navy">{formatNaira(order.delivery_fee)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Amount paid</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(order.total_amount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Next step</span>
                  <span className="text-slate-700">We'll pick up your cylinder soon</span>
                </div>
              </div>
            )}

            {loyalty?.enabled && !isSubscription && !isProductOrder && (
              <div className="mt-4 rounded-xl bg-brand-teal/10 px-4 py-3 text-left text-sm text-brand-teal">
                {loyalty.discount_applied_to_this_order ? (
                  <p>
                    <span className="font-semibold">Loyalty discount used 🎉</span> Your progress is back to{' '}
                    {loyalty.progress_kg} / {loyalty.threshold_kg} kg — keep ordering to earn the next{' '}
                    {loyalty.discount_percent}% off.
                  </p>
                ) : loyalty.reward_available ? (
                  <p>
                    <span className="font-semibold">Reward ready 🎉</span> You&apos;ve hit {loyalty.threshold_kg} kg —{' '}
                    {loyalty.discount_percent}% off applies to your next refill.
                  </p>
                ) : loyalty.kg_to_next_reward > 0 ? (
                  <p>
                    <span className="font-semibold">
                      {loyalty.progress_kg} / {loyalty.threshold_kg} kg
                    </span>{' '}
                    — {loyalty.kg_to_next_reward} kg more to unlock {loyalty.discount_percent}% off.
                  </p>
                ) : null}
              </div>
            )}

            {subscription && isSubscription && (
              <div className="mt-6 rounded-xl bg-brand-bg px-4 py-3 text-left text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Customer ID</span>
                  <span className="figure font-medium text-brand-navy">{subscription.customer_id}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Amount paid</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(subscription.locked_price)}</span>
                </div>
              </div>
            )}

            <Link
              to={isSubscription ? '/subscription' : isProductOrder ? '/cart' : order ? `/orders/${order.id}` : '/orders'}
              className="btn-primary mt-6 w-full"
            >
              {isSubscription ? 'View My Subscription' : isProductOrder ? 'Back to My Cart' : 'Track This Order'}
            </Link>
          </>
        )}

        {phase === 'failed' && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-500" strokeWidth={1.6} />
            <h2 className="mt-4 font-heading text-xl font-bold text-brand-navy">Payment Didn't Go Through</h2>
            <p className="mt-2 text-sm text-slate-500">
              Paystack reported this payment as failed or abandoned. No charge was completed — you can retry from{' '}
              {isSubscription ? 'My Subscription' : isProductOrder ? 'My Cart' : 'My Orders'}.
            </p>
            <Link
              to={isSubscription ? '/subscription' : isProductOrder ? '/cart' : order ? `/orders/${order.id}` : '/orders'}
              className="btn-primary mt-6 w-full"
            >
              {isProductOrder ? 'Back to My Cart' : 'Retry Payment'}
            </Link>
          </>
        )}

        {phase === 'unknown' && (
          <>
            <HelpCircle className="mx-auto h-12 w-12 text-slate-300" strokeWidth={1.6} />
            <h2 className="mt-4 font-heading text-xl font-bold text-brand-navy">We couldn't confirm this automatically</h2>
            <p className="mt-2 text-sm text-slate-500">
              {isProductOrder
                ? "Your payment may still have gone through — check My Cart. If your items are gone but you weren't charged, please contact support."
                : `Your payment may still have gone through. Check ${isSubscription ? 'My Subscription' : 'My Orders'} — if it still shows as pending, you can retry payment from there.`}
            </p>
            <Link to={isSubscription ? '/subscription' : isProductOrder ? '/cart' : '/orders'} className="btn-outline mt-6 w-full">
              {isSubscription ? 'View My Subscription' : isProductOrder ? 'Back to My Cart' : 'View My Orders'}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default PaymentCallback
