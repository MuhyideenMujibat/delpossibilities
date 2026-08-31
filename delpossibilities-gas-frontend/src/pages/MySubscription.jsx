import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarCheck, Flame, Copy, ArrowRightLeft, Droplets, Clock, ShoppingCart, Info } from 'lucide-react'
import { apiFetch, formatNaira, formatDate } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge from '../StatusBadge'
import { useToast } from '../toastContext'
import { useCart } from '../cartContext'
import AddToDeliveryModal from '../components/shop/AddToDeliveryModal'
import SubscriptionPreview from '../components/landing/SubscriptionPreview'

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }

const REFILL_STATUS_STYLES = {
  pending: { badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  approved: { badge: 'bg-brand-teal/10 text-brand-teal', dot: 'bg-brand-teal' },
  picked_up: { badge: 'bg-brand-accent/15 text-brand-accent', dot: 'bg-brand-accent' },
  delivered: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  cancelled: { badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
}

function daysRemaining(endsAt) {
  if (!endsAt) return null
  const diff = new Date(endsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function TransferForm({ subscriber, token, onDone }) {
  const { show } = useToast()
  const [customerId, setCustomerId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await apiFetch(`/subscribers/${subscriber.id}/transfer`, {
        method: 'POST',
        token,
        body: { customer_id: customerId },
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        show(data?.message || Object.values(data?.errors || {})[0]?.[0] || 'Could not transfer this subscription.', { type: 'error' })
        return
      }

      show('Subscription transferred.', { type: 'success' })
      onDone(true)
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-xl bg-brand-bg p-4">
      <div>
        <label className="label-text">Recipient's Customer ID</label>
        <p className="mb-1.5 text-xs text-slate-400">
          They must already have their own account and Customer ID — this hands your remaining kg over to them.
        </p>
        <input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="DEL-2026-0001"
          required
          className="input-field"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onDone(false)} disabled={submitting} className="btn-outline">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Transferring…' : 'Confirm Transfer'}
        </button>
      </div>
    </form>
  )
}

function MySubscription({ token }) {
  const { show } = useToast()
  const cart = useCart()
  const navigate = useNavigate()
  const [subscriber, setSubscriber] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [requestingRefill, setRequestingRefill] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [refillKg, setRefillKg] = useState('')
  const [attachableOrders, setAttachableOrders] = useState([])
  const [attachOrderId, setAttachOrderId] = useState('')
  const [addToDeliveryOpen, setAddToDeliveryOpen] = useState(false)

  const [selectedPlan, setSelectedPlan] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [subscribeError, setSubscribeError] = useState('')

  const load = () => {
    if (!token) {
      setLoading(false)
      return Promise.resolve()
    }
    setError('')
    return apiFetch('/my-subscription', { token })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setSubscriber(data || null))
      .catch(() => setError('Could not load your subscription.'))
      .finally(() => setLoading(false))
  }

  const loadAttachableOrders = () => {
    if (!token) return
    apiFetch('/my-product-orders', { token })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const eligible = (Array.isArray(data) ? data : []).filter(
          (po) => po.status === 'approved' && !po.order && !po.refill
        )
        setAttachableOrders(eligible)
      })
      .catch(() => {})
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    loadAttachableOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const daysLeft = useMemo(() => daysRemaining(subscriber?.ends_at), [subscriber])
  const hasPendingRefill = subscriber?.refills?.some((r) => r.status === 'pending')
  const remainingKg = subscriber ? Number(subscriber.remaining_kg ?? 0) : 0
  const isExpired = subscriber?.ends_at ? new Date(subscriber.ends_at).getTime() < Date.now() : false
  const kgExhausted = subscriber?.status === 'active' && remainingKg <= 0
  // A subscription that's technically still `active` in the database but
  // has nothing left to give (no kg, or past its end date) is treated as
  // unusable here — no tier highlighted, no transfer offered, same grid a
  // guest or a never-subscribed student would see.
  const isUsableSubscription = subscriber?.status === 'active' && !kgExhausted && !isExpired
  const hasActiveOrPending = subscriber && ['active', 'pending'].includes(subscriber.status)
  const plan = subscriber?.plan

  const handlePayNow = async () => {
    setPaying(true)
    try {
      const response = await apiFetch(`/subscribers/${subscriber.id}/pay`, { method: 'POST', token })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.authorization_url) {
        show(data?.message || 'Could not start payment.', { type: 'error' })
        setPaying(false)
        return
      }

      window.location.href = data.authorization_url
    } catch {
      show('Could not reach the server.', { type: 'error' })
      setPaying(false)
    }
  }

  const submitRefillRequest = async () => {
    setRequestingRefill(true)
    try {
      const response = await apiFetch('/refills', {
        method: 'POST',
        token,
        body: { kg: refillKg, product_order_id: attachOrderId || undefined },
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        show(data?.message || Object.values(data?.errors || {})[0]?.[0] || 'Could not request a refill.', { type: 'error' })
        return
      }

      show(
        attachOrderId
          ? "Refill requested — your cart order will be delivered on the same trip."
          : 'Refill requested — we\'ll be in touch to deliver it.',
        { type: 'success' }
      )
      setRefillKg('')
      setAttachOrderId('')
      await load()
      loadAttachableOrders()
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setRequestingRefill(false)
    }
  }

  const handleRequestRefill = (e) => {
    e.preventDefault()
    if (requestingRefill) return

    if (cart.itemCount === 0 && attachableOrders.length === 0) {
      setAddToDeliveryOpen(true)
      return
    }

    submitRefillRequest()
  }

  const copyCustomerId = () => {
    navigator.clipboard?.writeText(subscriber.customer_id).then(
      () => show('Customer ID copied.', { type: 'success' }),
      () => {}
    )
  }

  const handleSubscribe = (chosenPlan) => {
    setSelectedPlan(chosenPlan)
    setConfirmOpen(true)
  }

  // Guest picked a specific tier — remember which one so that once they're
  // back here logged in, the same Subscribe flow resumes on that exact
  // plan instead of making them find and click it again.
  const goLoginToSubscribe = (plan) => {
    try {
      sessionStorage.setItem('pendingSubscribePlanId', String(plan.id))
    } catch {
      // Storage full/unavailable — worst case they just pick the plan again.
    }
    navigate('/login', { state: { from: '/subscription' } })
  }

  useEffect(() => {
    if (!token) return
    const pendingPlanId = sessionStorage.getItem('pendingSubscribePlanId')
    if (!pendingPlanId) return
    sessionStorage.removeItem('pendingSubscribePlanId')

    apiFetch('/subscription-plans')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const found = (Array.isArray(data) ? data : []).find((p) => String(p.id) === pendingPlanId)
        if (found) handleSubscribe(found)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleConfirmSubscribe = async () => {
    if (!selectedPlan || submitting) return

    setSubmitting(true)
    setSubscribeError('')

    try {
      const storeResponse = await apiFetch('/subscribers', {
        method: 'POST',
        token,
        body: { subscription_plan_id: selectedPlan.id },
      })
      const created = await storeResponse.json().catch(() => null)

      if (!storeResponse.ok) {
        setSubscribeError(created?.message || Object.values(created?.errors || {})[0]?.[0] || 'Could not start this subscription.')
        setConfirmOpen(false)
        setSubmitting(false)
        return
      }

      const payResponse = await apiFetch(`/subscribers/${created.id}/pay`, { method: 'POST', token })
      const payData = await payResponse.json().catch(() => null)

      if (!payResponse.ok || !payData?.authorization_url) {
        show(payData?.message || 'Subscription created, but payment could not start. Retry from this page.', { type: 'error' })
        setConfirmOpen(false)
        setSubmitting(false)
        await load()
        return
      }

      show('Redirecting you to Paystack…', { type: 'success', duration: 2500 })
      window.location.href = payData.authorization_url
    } catch {
      setSubscribeError('Could not reach the server.')
      setConfirmOpen(false)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="skeleton h-72 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Subscription" subtitle="Lock in a price for the whole session or semester, then refill anytime at no extra cost." icon={CalendarCheck} />

      {error && <p className="alert-error mb-6">{error}</p>}

      {subscriber?.status === 'pending' && (
        <div className="alert-error mb-6 flex items-center justify-between gap-3">
          <span>Your subscription is awaiting payment.</span>
          <button onClick={handlePayNow} disabled={paying} className="btn-primary flex-shrink-0 whitespace-nowrap !py-1.5">
            {paying ? 'Redirecting…' : 'Pay Now'}
          </button>
        </div>
      )}

      {isUsableSubscription && (
        <div className="card mb-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="eyebrow">{plan.package_type === 'session' ? 'Session' : 'Semester'} Package</span>
                <StatusBadge status={subscriber.status} label={subscriber.status.charAt(0).toUpperCase() + subscriber.status.slice(1)} />
              </div>
              <h3 className="mt-1 font-heading text-xl font-bold text-brand-navy">{TIER_LABELS[plan.tier] || plan.tier}</h3>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <Flame className="h-4 w-4 text-brand-ember" strokeWidth={2} />
                {Number(plan.cylinder_kg)} kg total allowance — locked at {formatNaira(subscriber.locked_price)}
              </div>
            </div>

            <div className="flex flex-shrink-0 gap-2">
              <div className="rounded-xl bg-brand-teal/10 px-4 py-3 text-center">
                <p className="figure text-2xl font-bold text-brand-teal">{remainingKg}</p>
                <p className="eyebrow mt-0.5">kg left</p>
              </div>
              {daysLeft !== null && (
                <div className="rounded-xl bg-brand-bg px-4 py-3 text-center">
                  <p className="figure text-2xl font-bold text-brand-navy">{daysLeft}</p>
                  <p className="eyebrow mt-0.5">{daysLeft === 1 ? 'day left' : 'days left'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            {formatDate(subscriber.starts_at)} — {formatDate(subscriber.ends_at)}
          </div>

          <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label-text mb-1">Customer ID</p>
              <button onClick={copyCustomerId} className="figure inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:text-brand-teal">
                {subscriber.customer_id}
                <Copy className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>

            <button type="button" onClick={() => setTransferring((t) => !t)} className="btn-outline flex-shrink-0">
              <ArrowRightLeft className="h-4 w-4" strokeWidth={2} />
              {transferring ? 'Cancel' : 'Transfer'}
            </button>
          </div>

          {transferring && (
            <TransferForm
              subscriber={subscriber}
              token={token}
              onDone={(didTransfer) => {
                setTransferring(false)
                if (didTransfer) load()
              }}
            />
          )}
        </div>
      )}

      {isUsableSubscription && (
        <div className="card mb-6">
          <p className="font-medium text-brand-navy">Need a refill?</p>
          <p className="text-sm text-slate-500">
            Free — just tell us how many kg you need. It's deducted from your {remainingKg} kg remaining.
          </p>

          <form onSubmit={handleRequestRefill} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 sm:max-w-[10rem]">
                <label className="label-text" htmlFor="refill-kg">Kg needed</label>
                <input
                  id="refill-kg"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={remainingKg}
                  placeholder={`up to ${remainingKg}`}
                  value={refillKg}
                  onChange={(e) => setRefillKg(e.target.value)}
                  disabled={hasPendingRefill}
                  required
                  className="input-field"
                />
              </div>
              <button
                type="submit"
                disabled={requestingRefill || hasPendingRefill}
                className="btn-primary flex-shrink-0 whitespace-nowrap"
              >
                <Droplets className="h-4 w-4" strokeWidth={2} />
                {hasPendingRefill ? 'Refill Already Requested' : requestingRefill ? 'Requesting…' : 'Request a Refill'}
              </button>
            </div>

            {attachableOrders.length > 0 && !hasPendingRefill && (
              <label className="flex items-start gap-2.5 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!attachOrderId}
                  onChange={(e) => setAttachOrderId(e.target.checked ? String(attachableOrders[0].id) : '')}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-brand-teal"
                />
                <span className="flex items-start gap-2 text-slate-600">
                  <ShoppingCart className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" strokeWidth={2} />
                  <span>
                    <span className="font-medium text-brand-navy">Deliver your paid cart order with this refill</span> —{' '}
                    {formatNaira(attachableOrders[0].total_amount)}, already paid,{' '}
                    <Link to="/my-shop-orders" onClick={(e) => e.stopPropagation()} className="underline hover:text-brand-teal">
                      {attachableOrders[0].items?.length || 0} item{attachableOrders[0].items?.length === 1 ? '' : 's'}
                    </Link>
                    .
                  </span>
                </span>
              </label>
            )}
          </form>
        </div>
      )}

      {token && cart.itemCount > 0 && (
        <Link
          to="/cart"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3 text-sm text-brand-navy transition-colors hover:bg-brand-teal/10"
        >
          <span className="flex items-center gap-2.5">
            <ShoppingCart className="h-4 w-4 flex-shrink-0 text-brand-teal" strokeWidth={2} />
            You have {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} in your cart — refills are free and separate, so check out your cart on its own.
          </span>
          <span className="flex-shrink-0 whitespace-nowrap text-sm font-semibold text-brand-teal">Go to Cart</span>
        </Link>
      )}

      {token && subscriber && !isUsableSubscription && subscriber.status !== 'pending' && (
        <p className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Info className="h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={2} />
          {kgExhausted ? "Your subscription's kg allowance is used up." : 'Your subscription has expired.'}
        </p>
      )}

      {subscribeError && <p className="alert-error mb-6">{subscribeError}</p>}

      {/* Exactly the same section that appears on the public landing page —
          just parameterized to highlight the viewer's own tier (if usable)
          and, when logged in, run the real subscribe-and-pay flow instead of
          linking to /register. Cancels <main>'s padding the same way
          Shop.jsx does for ShopSection, since this renders its own
          full-bleed section. */}
      <div className="-mx-4 sm:-mx-6 md:-mx-10">
        <SubscriptionPreview
          activePlanId={isUsableSubscription ? plan?.id : null}
          defaultPackageType={isUsableSubscription ? plan.package_type : 'session'}
          onSubscribe={token ? handleSubscribe : goLoginToSubscribe}
          disableSubscribe={submitting}
          submittingPlanId={submitting ? selectedPlan?.id : null}
        />
      </div>

      {token && subscriber && (
        <div className="mt-10">
          <h3 className="mb-3 font-heading text-lg font-bold text-brand-navy">Refill History</h3>

          {(!subscriber.refills || subscriber.refills.length === 0) && (
            <EmptyState icon={Droplets} title="No refills yet" description="Your refill requests and deliveries will show up here." />
          )}

          {subscriber.refills && subscriber.refills.length > 0 && (
            <div className="table-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th-cell">Requested</th>
                    <th className="th-cell">Delivered</th>
                    <th className="th-cell">Kg Requested</th>
                    <th className="th-cell">Kg Delivered</th>
                    <th className="th-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriber.refills.map((refill) => {
                    const style = REFILL_STATUS_STYLES[refill.status] || REFILL_STATUS_STYLES.pending
                    return (
                      <tr key={refill.id}>
                        <td className="px-4 py-3 text-slate-600">{formatDate(refill.requested_at)}</td>
                        <td className="px-4 py-3 text-slate-600">{refill.delivered_at ? formatDate(refill.delivered_at) : '—'}</td>
                        <td className="figure px-4 py-3 text-brand-navy">{refill.kg_requested ? `${refill.kg_requested} kg` : '—'}</td>
                        <td className="figure px-4 py-3 text-brand-navy">{refill.kg_delivered ? `${refill.kg_delivered} kg` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} />
                            {refill.status.charAt(0).toUpperCase() + refill.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <AddToDeliveryModal
        open={addToDeliveryOpen}
        onClose={() => setAddToDeliveryOpen(false)}
        onContinue={() => {
          setAddToDeliveryOpen(false)
          submitRefillRequest()
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={selectedPlan ? `Subscribe to ${TIER_LABELS[selectedPlan.tier]} ${selectedPlan.package_type === 'session' ? 'Session' : 'Semester'}?` : ''}
        message={selectedPlan ? `${formatNaira(selectedPlan.price)} — you'll be sent to Paystack to pay, then this price is locked in for the duration.` : ''}
        confirmLabel="Confirm & Pay"
        busy={submitting}
        onConfirm={handleConfirmSubscribe}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

export default MySubscription
