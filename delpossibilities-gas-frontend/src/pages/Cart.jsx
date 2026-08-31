import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Minus, Plus, Trash2, ArrowRight, PlusCircle, Gift } from 'lucide-react'
import { apiFetch, formatNaira, resolveImageUrl } from '../api'
import { useCart } from '../cartContext'
import { useCurrentUser } from '../userContext'
import { useToast } from '../toastContext'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'

function useEazyMarketTiers() {
  const [tiers, setTiers] = useState([])

  useEffect(() => {
    let cancelled = false

    apiFetch('/eazy-market-delivery-tiers')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setTiers(Array.isArray(data) ? data : [])
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return tiers
}

function CartLine({ item }) {
  const cart = useCart()

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
      {item.snapshot.image_url ? (
        <img src={resolveImageUrl(item.snapshot.image_url)} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
          No image
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-brand-navy">{item.snapshot.name}</p>
        {item.snapshot.variant_label && <p className="text-xs text-slate-400">{item.snapshot.variant_label}</p>}
        <p className="figure mt-0.5 text-sm text-slate-600">{formatNaira(item.snapshot.price)}</p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-brand-bg p-1">
        <button
          type="button"
          onClick={() => cart.updateQuantity(item.productId, item.variantId, item.quantity - 1)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white"
        >
          <Minus className="h-3 w-3" strokeWidth={2} />
        </button>
        <span className="figure w-5 text-center text-xs font-semibold text-brand-navy">{item.quantity}</span>
        <button
          type="button"
          onClick={() => cart.updateQuantity(item.productId, item.variantId, item.quantity + 1)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => cart.removeItem(item.productId, item.variantId)}
        aria-label={`Remove ${item.snapshot.name}`}
        className="btn-ghost flex-shrink-0 px-2.5 text-red-500 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </div>
  )
}

function Cart({ token }) {
  const cart = useCart()
  const { show } = useToast()
  const navigate = useNavigate()
  const tiers = useEazyMarketTiers()
  const { user } = useCurrentUser()
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const [subscriber, setSubscriber] = useState(null)
  const [useReferralCredit, setUseReferralCredit] = useState(true)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false

    apiFetch('/my-subscription', { token })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setSubscriber(data)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [token])

  const referralCreditBalance = Number(user?.referral_credit_balance || 0)
  // A `status='active'` row alone isn't enough — status never auto-flips to
  // 'expired', so a subscription that's exhausted or past its end date can
  // still read 'active' forever (same reasoning as MySubscription.jsx's
  // isUsableSubscription and SubscriberController::transfer's recipient
  // check). Only a genuinely usable subscription exempts a student from the
  // Eazy-Market-only rule below.
  const isActiveSubscriber = Boolean(
    subscriber
    && subscriber.status === 'active'
    && Number(subscriber.remaining_kg) > 0
    && (!subscriber.ends_at || new Date(subscriber.ends_at).getTime() >= Date.now())
  )

  const eazyMarketSubtotal = cart.subtotalByGroup.eazy_market || 0
  const eazyMarketFee = useMemo(() => {
    if (eazyMarketSubtotal <= 0) return 0
    const tier = tiers.find(
      (t) => eazyMarketSubtotal >= Number(t.min_amount) && (t.max_amount === null || eazyMarketSubtotal <= Number(t.max_amount))
    )
    return tier ? Number(tier.fee) : 0
  }, [tiers, eazyMarketSubtotal])

  const referralCreditApplied = useReferralCredit ? Math.min(eazyMarketFee, referralCreditBalance) : 0
  const total = cart.subtotal + eazyMarketFee - referralCreditApplied
  // Eazy Market items can't ship on their own — they need a gas accessory in
  // the same cart, or to ride along with a gas refill (the "Add to My Gas
  // Refill Order" path below is exempt from this, the refill is the
  // companion there). Active subscribers are exempt too — their whole model
  // is pay-standalone-then-attach-to-next-refill, so their subscription
  // itself is the companion. Mirrors ProductOrderController::pay()'s check.
  const eazyMarketOnly = !isActiveSubscriber && eazyMarketSubtotal > 0 && (cart.subtotalByGroup.gas_services || 0) <= 0

  const handleCheckoutCartOnly = async () => {
    if (checkingOut || eazyMarketOnly) return
    setCheckingOut(true)
    setError('')

    try {
      const storeResponse = await apiFetch('/product-orders', {
        method: 'POST',
        token,
        body: {
          items: cart.items.map((item) => ({ product_id: item.productId, product_variant_id: item.variantId, quantity: item.quantity })),
          use_referral_credit: useReferralCredit && referralCreditBalance > 0,
        },
      })
      const productOrder = await storeResponse.json().catch(() => null)

      if (!storeResponse.ok) {
        setError(productOrder?.message || Object.values(productOrder?.errors || {})[0]?.[0] || 'Could not start checkout.')
        return
      }

      cart.clear()

      const payResponse = await apiFetch(`/product-orders/${productOrder.id}/pay`, { method: 'POST', token })
      const payData = await payResponse.json().catch(() => null)

      if (!payResponse.ok || !payData?.authorization_url) {
        show('Order created, but payment could not start. Please try again.', { type: 'error' })
        return
      }

      show('Redirecting you to Paystack…', { type: 'success', duration: 2500 })
      window.location.href = payData.authorization_url
    } catch {
      setError('Could not reach the server.')
    } finally {
      setCheckingOut(false)
    }
  }

  if (cart.itemCount === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="My Cart" subtitle="Gas Services and Eazy Market items you've added." icon={ShoppingCart} />
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse Gas Services and Eazy Market on the Shop page to add items."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My Cart" subtitle="Review your items, then check out on their own or with a gas refill." icon={ShoppingCart} />

      <div className="flex flex-col gap-3">
        {cart.items.map((item) => (
          <CartLine key={`${item.productId}:${item.variantId ?? 'base'}`} item={item} />
        ))}
      </div>

      <div className="card mt-6">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="figure font-medium text-brand-navy">{formatNaira(cart.subtotal)}</span>
          </div>
          {(cart.subtotalByGroup.gas_services || 0) > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Gas Services delivery</span>
              <span className="figure font-medium text-brand-teal">Free</span>
            </div>
          )}
          {eazyMarketSubtotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Eazy Market delivery</span>
              <span className="figure font-medium text-brand-navy">{formatNaira(eazyMarketFee)}</span>
            </div>
          )}
          {referralCreditApplied > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-brand-teal">Referral credit</span>
              <span className="figure font-medium text-brand-teal">&minus;{formatNaira(referralCreditApplied)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="font-medium text-slate-600">Total (cart only)</span>
            <span className="figure text-base font-bold text-brand-navy">{formatNaira(total)}</span>
          </div>
        </div>

        {referralCreditBalance > 0 && eazyMarketFee > 0 && (
          <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={useReferralCredit}
              onChange={(e) => setUseReferralCredit(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-brand-teal"
            />
            <span className="flex items-start gap-2">
              <Gift className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" strokeWidth={2} />
              <span>
                <span className="font-medium text-brand-navy">Use your referral credit</span> — you have{' '}
                {formatNaira(referralCreditBalance)} available to offset this delivery fee.
              </span>
            </span>
          </label>
        )}

        {eazyMarketOnly && (
          <p className="alert-error mt-4">
            Eazy Market items need a gas accessory in the same cart, or to be attached to a gas refill — add one of
            those, or use "Add to My Gas Refill Order" below.
          </p>
        )}

        {error && <p className="alert-error mt-4">{error}</p>}

        {!token ? null : isActiveSubscriber ? (
          <p className="mt-4 text-xs text-slate-400">
            On a subscription? Pay for this cart now, then attach it to your next refill request from My Subscription so it's delivered on the same trip.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => navigate('/')} className="btn-outline flex-1">
              <PlusCircle className="h-4 w-4" strokeWidth={2} />
              Add to My Gas Refill Order
            </button>
          </div>
        )}

        {token ? (
          <button type="button" onClick={handleCheckoutCartOnly} disabled={checkingOut} className="btn-primary mt-2 w-full">
            {checkingOut ? 'Processing…' : 'Checkout Cart Only'}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/login', { state: { from: '/cart' } })}
            className="btn-primary mt-2 w-full"
          >
            Log In to Check Out
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  )
}

export default Cart
