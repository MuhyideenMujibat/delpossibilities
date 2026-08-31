import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PlusCircle, MapPin, Flame, Check, ImagePlus, Camera, ArrowLeft, ArrowRight, ShieldCheck, ShoppingBag, ShoppingCart, Gift } from 'lucide-react'
import { apiFetch, formatNaira, resolveImageUrl } from '../api'
import { setPostAuthRedirect } from '../authRedirect'
import { setPendingOrderImage, takePendingOrderImage } from '../pendingOrderImage'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import AddToDeliveryModal from '../components/shop/AddToDeliveryModal'
import HostelSelect from '../HostelSelect'
import DeliveryZoneSelect from '../DeliveryZoneSelect'
import LocationTypeToggle from '../components/LocationTypeToggle'
import { useToast } from '../toastContext'
import { useCart } from '../cartContext'
import { useCurrentUser } from '../userContext'
import { useDeliveryZones } from '../hooks/useDeliveryZones'

const KG_PRESETS = [5, 10, 12.5, 15]
const STEP_LABELS = ['Size', 'Cylinder', 'Address', 'Summary']

// Keeps the student's profile image in sync whenever they attach an image on
// an order, so future orders default to it too. Best-effort: a failure here
// shouldn't block the order, since the image is also sent directly with it.
function syncProfileImage(token, file) {
  const formData = new FormData()
  formData.append('cylinder_image', file)
  return apiFetch('/profile/cylinder-image', { method: 'POST', token, body: formData }).catch(() => null)
}

// Same tiered fee lookup as Cart.jsx — needed here too so the running total
// shown while bundling a fresh cart already reflects what the backend will
// actually charge for its Eazy Market portion, not just the gas side.
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

function Stepper({ step }) {
  return (
    <div className="mb-8 flex items-center">
      {STEP_LABELS.map((label, index) => {
        const done = index < step
        const active = index === step
        return (
          <div key={label} className={`flex items-center ${index < STEP_LABELS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  done
                    ? 'border-brand-teal bg-brand-teal text-white'
                    : active
                      ? 'border-brand-ember bg-brand-ember text-white'
                      : 'border-slate-200 bg-white text-slate-300'
                }`}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : index + 1}
              </span>
              <span className={`whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide ${active || done ? 'text-brand-navy' : 'text-slate-300'}`}>
                {label}
              </span>
            </div>
            {index < STEP_LABELS.length - 1 && <span className={`mx-2 h-0.5 flex-1 ${done ? 'bg-brand-teal' : 'bg-slate-200'}`} aria-hidden="true" />}
          </div>
        )
      })}
    </div>
  )
}

function CreateOrder({ token }) {
  const navigate = useNavigate()
  const { show } = useToast()
  const cart = useCart()
  const { user, refresh: refreshUser } = useCurrentUser()
  const { zones: deliveryZones } = useDeliveryZones()
  const eazyMarketTiers = useEazyMarketTiers()

  const [step, setStep] = useState(0)
  const [kg, setKg] = useState('')
  const [customKg, setCustomKg] = useState(false)
  const [locationType, setLocationType] = useState('hostel')
  const [hostelName, setHostelName] = useState('')
  const [roomDetails, setRoomDetails] = useState('')
  const [offCampusAddress, setOffCampusAddress] = useState('')
  const [deliveryZoneId, setDeliveryZoneId] = useState('')
  const [cylinderImage, setCylinderImage] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [forSomeoneElse, setForSomeoneElse] = useState(false)
  const [pricePerKg, setPricePerKg] = useState(null)
  const [deliveryFeeHostel, setDeliveryFeeHostel] = useState(0)
  const [offer, setOffer] = useState(null)
  const [loyalty, setLoyalty] = useState(null)
  const [error, setError] = useState('')
  const [needsProfileImage, setNeedsProfileImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [addToDeliveryOpen, setAddToDeliveryOpen] = useState(false)
  // Defaults on (opt-out, not opt-in) — a refill-only checkout with an
  // empty cart never sees the bundle UI at all, so today's flow stays
  // exactly as easy for anyone not using the shop.
  const [bundleCart, setBundleCart] = useState(true)
  const [pendingProductOrderId, setPendingProductOrderId] = useState(null)
  const [referralCreditBalance, setReferralCreditBalance] = useState(0)
  const [useReferralCredit, setUseReferralCredit] = useState(true)
  // Paid cart orders not yet riding on any delivery — eligible to attach to
  // this order instead of bundling a fresh one (mirrors the identical
  // pattern in MySubscription.jsx for subscriber refills).
  const [attachableOrders, setAttachableOrders] = useState([])
  const [attachOrderId, setAttachOrderId] = useState('')
  // Set when this page mounted from a restored guest draft (a guest who
  // filled the wizard, hit "Log In to Order", and came back signed in). In
  // that flow the address and photo they entered as a guest are treated as
  // an intentional edit to their own profile — see submitOrder — and the
  // profile's saved values must NOT seed over them (see the /user effect).
  // A ref, not state: nothing renders off it, and submitOrder just reads it.
  const guestDraftRestoredRef = useRef(false)

  useEffect(() => {
    apiFetch('/price')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.delivery_fee !== undefined && data?.delivery_fee !== null) setDeliveryFeeHostel(Number(data.delivery_fee))

        const activeOffer = data?.offer_active && data?.offer_price_per_kg
        if (activeOffer) {
          setOffer(data)
          setPricePerKg(Number(data.offer_price_per_kg))
          return
        }
        if (data?.price_per_kg !== undefined && data?.price_per_kg !== null) setPricePerKg(Number(data.price_per_kg))

        if (data?.loyalty_enabled && data?.loyalty_threshold_kg && data?.loyalty_discount_percent) {
          setLoyalty({
            thresholdKg: Number(data.loyalty_threshold_kg),
            discountPercent: Number(data.loyalty_discount_percent),
          })
        }
      })
      .catch(() => {})
  }, [])

  // Seeds local (user-editable) form state from the shared /user fetch
  // exactly once when it first arrives — guarded by a ref rather than
  // re-running on every `user` change, so an unrelated refresh() elsewhere
  // (e.g. Profile.jsx) never clobbers an address the student is mid-editing
  // here.
  const userSeededRef = useRef(false)
  useEffect(() => {
    if (!user || userSeededRef.current) return
    userSeededRef.current = true

    /* eslint-disable react-hooks/set-state-in-effect -- one-shot seed of
       editable form fields from the shared /user fetch; guarded by
       userSeededRef so it runs at most once, not a render loop. */
    // A restored guest draft already carries the address the student typed
    // before logging in — don't overwrite it with whatever was saved on the
    // profile. The photo/referral seeding below is still wanted either way.
    if (!guestDraftRestoredRef.current) {
      const type = user.location_type || 'hostel'
      setLocationType(type)
      if (user.hostel) {
        if (type === 'off_campus') setOffCampusAddress(user.hostel)
        else setHostelName(user.hostel)
      }
    }
    if (user.cylinder_image_url) setExistingImageUrl(user.cylinder_image_url)
    setReferralCreditBalance(Number(user.referral_credit_balance || 0))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user])

  // Loyalty standing is read LIVE from the shared /user fetch (not copied
  // into local state like the form fields above) so it updates the instant
  // the context refreshes — e.g. right after a paid order, with no page
  // reload. PaymentCallback calls refresh() so this is fresh on return.
  const loyaltyProgressKg = Number(user?.loyalty_progress_kg || 0)
  const loyaltyRewardAvailable = Boolean(user?.loyalty_reward_available)
  const loyaltyKgToNextReward =
    user?.loyalty_kg_to_next_reward !== null && user?.loyalty_kg_to_next_reward !== undefined
      ? Number(user.loyalty_kg_to_next_reward)
      : null

  useEffect(() => {
    if (!token) return

    apiFetch('/my-product-orders', { token })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const eligible = (Array.isArray(data) ? data : []).filter(
          (po) => po.status === 'approved' && !po.order && !po.attaching_order && !po.refill
        )
        setAttachableOrders(eligible)
      })
      .catch(() => {})
  }, [token])

  // A guest who filled the whole wizard and hit "Log In to Order" comes back
  // here post-login — restore everything that survives serialization (the
  // cylinder photo, a real File, can't) instead of making them start over.
  // If they never had a saved profile photo either, the existing
  // needsProfileImage recovery UI on the Summary step covers that gap.
  useEffect(() => {
    if (!token) return
    const raw = sessionStorage.getItem('pendingOrderDraft')
    if (!raw) return
    sessionStorage.removeItem('pendingOrderDraft')

    // Flip this before the /user effect gets a chance to run with real data,
    // so the profile's saved address can't seed over the restored one.
    guestDraftRestoredRef.current = true

    /* eslint-disable react-hooks/set-state-in-effect -- one-shot restore of
       a guest's wizard draft after they log in; runs once (the draft is
       removed from sessionStorage above), not a render loop. */
    // The cylinder photo (a real File) rode over in memory, not in the
    // serialized draft — pick it back up if it's there.
    const savedImage = takePendingOrderImage()
    if (savedImage) setCylinderImage(savedImage)

    try {
      const draft = JSON.parse(raw)
      if (draft.kg) {
        setKg(draft.kg)
        setCustomKg(Boolean(draft.customKg))
      }
      if (draft.locationType) setLocationType(draft.locationType)
      if (draft.hostelName) setHostelName(draft.hostelName)
      if (draft.roomDetails) setRoomDetails(draft.roomDetails)
      if (draft.offCampusAddress) setOffCampusAddress(draft.offCampusAddress)
      if (draft.deliveryZoneId) setDeliveryZoneId(draft.deliveryZoneId)
      if (draft.forSomeoneElse) setForSomeoneElse(draft.forSomeoneElse)
      setStep(3)
      // eslint-disable-next-line no-empty
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const imagePreview = useMemo(() => (cylinderImage ? URL.createObjectURL(cylinderImage) : null), [cylinderImage])

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const kgValue = Number(kg)
  const kgValid = kg !== '' && !Number.isNaN(kgValue) && kgValue > 0
  const selectedZone = deliveryZones.find((z) => String(z.id) === String(deliveryZoneId))
  const deliveryFee = locationType === 'off_campus' ? Number(selectedZone?.fee || 0) : deliveryFeeHostel
  const gasCost = pricePerKg !== null && kgValid ? pricePerKg * kgValue : null
  // Mirrors the backend (OrderController::store): once loyalty_progress_kg
  // has reached the threshold, the kg of this order beyond what was still
  // needed to complete the threshold is discounted — not the whole order,
  // and not nothing. `loyaltyNeededToComplete` is 0 once the threshold is
  // already reached, so the whole order is discountable in that case.
  const loyaltyNeededToComplete = loyalty ? Math.max(loyalty.thresholdKg - loyaltyProgressKg, 0) : 0
  const loyaltyDiscountableKg = loyalty && kgValid ? Math.max(kgValue - loyaltyNeededToComplete, 0) : 0
  const loyaltyDiscount = loyalty && pricePerKg !== null && loyaltyDiscountableKg > 0
    ? pricePerKg * loyaltyDiscountableKg * (loyalty.discountPercent / 100)
    : 0
  const referralCreditApplied = useReferralCredit ? Math.min(deliveryFee, referralCreditBalance) : 0
  // Whether a fresh, still-unpaid cart is actually going to be bundled into
  // this same charge (mirrors ensureProductOrder's own condition exactly).
  // Independent of attachOrderId: a student can attach an already-paid cart
  // for delivery AND still bundle their remaining unpaid items on the same
  // refill — the attached order just adds nothing to this total.
  const bundlingFreshCart = bundleCart && cart.itemCount > 0
  const cartEazyMarketSubtotal = cart.subtotalByGroup.eazy_market || 0
  const cartGasServicesSubtotal = cart.subtotalByGroup.gas_services || 0
  const cartEazyMarketFee = useMemo(() => {
    if (cartEazyMarketSubtotal <= 0) return 0
    const tier = eazyMarketTiers.find(
      (t) => cartEazyMarketSubtotal >= Number(t.min_amount) && (t.max_amount === null || cartEazyMarketSubtotal <= Number(t.max_amount))
    )
    return tier ? Number(tier.fee) : 0
  }, [eazyMarketTiers, cartEazyMarketSubtotal])
  const shopChargeNow = bundlingFreshCart ? cart.subtotal + cartEazyMarketFee : 0
  const total = gasCost !== null ? gasCost - loyaltyDiscount + deliveryFee - referralCreditApplied + shopChargeNow : null
  // Ordering for someone else means their cylinder photo shouldn't stand in
  // for — or overwrite — the requester's own saved default.
  const usableExistingImageUrl = forSomeoneElse ? null : existingImageUrl
  const hasImage = !!cylinderImage || !!usableExistingImageUrl
  // On campus: the hostel name (from the admin-managed list) and free-text
  // block/room detail combine into the address string the backend and rider
  // see. Off campus: the student's own typed address is used as-is.
  const hostelAddress = locationType === 'hostel'
    ? [hostelName, roomDetails.trim()].filter(Boolean).join(', ')
    : offCampusAddress.trim()
  const addressValid = locationType === 'hostel'
    ? hostelName.trim().length > 0
    : offCampusAddress.trim().length > 0 && !!deliveryZoneId
  const canAdvance = [kgValid, hasImage, addressValid, true][step]

  // Shared across the Size, Address, and Summary breakdowns so shopped
  // items and their delivery fees are visible everywhere the running total
  // shows, not just at final confirmation.
  const renderShopBreakdownLines = () => (
    <>
      {!!attachOrderId && (
        <div className="mt-1 flex items-center justify-between">
          <span className="text-slate-500">Paid cart (delivered with this order)</span>
          <span className="figure font-medium text-brand-teal">Paid</span>
        </div>
      )}
      {bundlingFreshCart && (
        <>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-500">Shop subtotal</span>
            <span className="figure font-medium text-brand-navy">{formatNaira(cart.subtotal)}</span>
          </div>
          {cartGasServicesSubtotal > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-slate-500">Gas accessories delivery</span>
              <span className="figure font-medium text-brand-teal">Free</span>
            </div>
          )}
          {cartEazyMarketSubtotal > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-slate-500">Eazy Market delivery</span>
              <span className="figure font-medium text-brand-navy">{formatNaira(cartEazyMarketFee)}</span>
            </div>
          )}
        </>
      )}
    </>
  )

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) setCylinderImage(file)
  }

  const handleForSomeoneElseToggle = (checked) => {
    setForSomeoneElse(checked)
    if (checked) setCylinderImage(null)
  }

  // Creates the ProductOrder for the current cart on first call, then
  // caches its id in state so a retried/failed /orders submission never
  // spawns a second dangling ProductOrder — same idempotent-reuse
  // principle already used by startPayment (return the existing
  // authorization_url) and the backend's own duplicate-order guard.
  const ensureProductOrder = async () => {
    // Only ever the fresh, still-unpaid cart bundle. An already-paid order to
    // attach is handled separately (attached_product_order_id) so the two
    // never compete for the same slot.
    if (pendingProductOrderId) return pendingProductOrderId
    if (!bundleCart || cart.itemCount === 0) return null

    const payload = {
      items: cart.items.map((item) => ({
        product_id: item.productId,
        product_variant_id: item.variantId,
        quantity: item.quantity,
      })),
    }

    const response = await apiFetch('/product-orders', { method: 'POST', token, body: payload })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.message || 'Could not prepare your cart for checkout.')
    }

    setPendingProductOrderId(data.id)
    return data.id
  }

  const submitOrder = async (imageFile, { syncProfile = true } = {}) => {
    if (imageFile && syncProfile) {
      await syncProfileImage(token, imageFile)
    }

    let productOrderId = null
    try {
      productOrderId = await ensureProductOrder()
    } catch (err) {
      setError(err.message)
      return null
    }

    const formData = new FormData()
    formData.append('kg', kg)
    formData.append('location_type', locationType)
    formData.append('hostel_address', hostelAddress)
    if (locationType === 'off_campus') {
      formData.append('delivery_zone_id', deliveryZoneId)
    }
    if (productOrderId) {
      formData.append('product_order_id', productOrderId)
    }
    if (attachOrderId) {
      formData.append('attached_product_order_id', attachOrderId)
    }
    if (useReferralCredit && referralCreditBalance > 0) {
      formData.append('use_referral_credit', '1')
    }
    if (imageFile) {
      formData.append('cylinder_image', imageFile)
    }

    const response = await apiFetch('/orders', { method: 'POST', token, body: formData })
    const data = await response.json().catch(() => null)

    if (response.status === 422) {
      setError(data?.message || 'Please add a cylinder image to continue.')
      setNeedsProfileImage(true)
      return null
    }

    if (!response.ok) {
      setError(data?.message || 'Could not create the order.')
      return null
    }

    // Cart clears once the order exists server-side, not once payment is
    // confirmed — matches this page's existing behavior (an order can
    // never be edited after creation, only its payment retried). Only the
    // fresh bundle came from the local cart; an attached already-paid
    // order's items were never in the local cart, so `productOrderId`
    // (bundle only, see ensureProductOrder) is the right thing to gate on.
    if (productOrderId) {
      cart.clear()
    }

    // A guest who set a fresh address on the wizard and only then logged in
    // is telling us that's now their address — write it back to their own
    // profile (the photo is already handled by syncProfileImage above).
    // Scoped to the guest-draft flow so a normal one-off "deliver here just
    // this once" order never silently rewrites someone's saved address.
    if (guestDraftRestoredRef.current && syncProfile && user?.name) {
      const profileHostel = locationType === 'hostel' ? hostelName.trim() : offCampusAddress.trim()
      if (profileHostel) {
        await apiFetch('/profile', {
          method: 'PATCH',
          token,
          body: { name: user.name, location_type: locationType, hostel: profileHostel },
        }).catch(() => null)
        refreshUser?.()
      }
    }

    return data
  }

  const startPayment = async (order) => {
    const payResponse = await apiFetch(`/orders/${order.id}/pay`, { method: 'POST', token })
    const payData = await payResponse.json().catch(() => null)

    if (!payResponse.ok || !payData?.authorization_url) {
      show('Order created, but payment could not start. Retry from Track.', { type: 'error' })
      navigate('/orders')
      return
    }

    show('Order created — redirecting you to Paystack…', { type: 'success', duration: 2500 })
    window.location.href = payData.authorization_url
  }

  const handleCheckout = async () => {
    // Guards double-fire: the confirm dialog's button disables on `submitting`,
    // but this also protects against a stray second call reaching here.
    if (submitting) return

    setConfirmOpen(false)
    setError('')
    setNeedsProfileImage(false)
    setSubmitting(true)

    try {
      const order = await submitOrder(cylinderImage, { syncProfile: !forSomeoneElse })
      if (!order) return
      await startPayment(order)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecoveryFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setError('')
    setSubmitting(true)

    try {
      const order = await submitOrder(file)
      if (!order) return
      await startPayment(order)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  const goNext = () => canAdvance && setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  const goLoginToOrder = () => {
    try {
      sessionStorage.setItem(
        'pendingOrderDraft',
        JSON.stringify({ kg, customKg, locationType, hostelName, roomDetails, offCampusAddress, deliveryZoneId, forSomeoneElse })
      )
    } catch {
      // Storage full/unavailable — worst case they just re-fill the form.
    }
    // The photo can't be serialized — hand it over in memory instead.
    setPendingOrderImage(cylinderImage)
    setPostAuthRedirect('/')
    navigate('/login', { state: { from: '/' } })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Create Order" subtitle="Request a gas refill for delivery to your hostel." icon={PlusCircle} />

      {referralCreditBalance > 0 && (
        <label className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3 text-sm">
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
              {formatNaira(referralCreditBalance)} available to offset this order's delivery fee.
            </span>
          </span>
        </label>
      )}

      {/* Two independent add-ons — a student with a paid cart to deliver AND
          other unpaid items still in their cart can pick both, and both then
          ride on this one refill / show in the total below. */}
      {attachableOrders.length > 0 && (
        <label className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3 text-sm">
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

      {cart.itemCount > 0 && (
        <label className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={bundleCart}
            onChange={(e) => setBundleCart(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-brand-teal"
          />
          <span className="flex items-start gap-2">
            <ShoppingBag className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" strokeWidth={2} />
            <span>
              <span className="font-medium text-brand-navy">
                {attachableOrders.length > 0 ? 'Also bundle your unpaid cart items' : 'Bundle your cart with this refill'}
              </span>{' '}
              —{' '}
              <Link to="/cart" onClick={(e) => e.stopPropagation()} className="underline hover:text-brand-teal">
                {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}, {formatNaira(cart.subtotal)}
              </Link>
              . One payment, one delivery trip.
            </span>
          </span>
        </label>
      )}

      <div className="card">
        <Stepper step={step} />

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="label-text">Refill size</label>
              <div className="relative mb-3">
                <Flame className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="Enter any size, e.g. 1.5 kg"
                  value={kg}
                  onChange={(e) => {
                    setKg(e.target.value)
                    setCustomKg(true)
                  }}
                  className="input-field pl-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {KG_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setKg(String(preset))
                      setCustomKg(false)
                    }}
                    className={`rounded-xl border-2 px-3 py-3 text-center font-heading text-sm font-bold transition-colors ${
                      !customKg && Number(kg) === preset
                        ? 'border-brand-teal bg-brand-teal/5 text-brand-teal'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {preset} kg
                  </button>
                ))}
              </div>
            </div>

            {loyalty && (
              loyaltyDiscountableKg > 0 ? (
                <div className="rounded-xl bg-brand-teal/10 px-4 py-3 text-sm text-brand-teal">
                  <p className="font-semibold">🎉 Loyalty discount applied!</p>
                  <p className="mt-0.5 text-xs text-brand-teal/80">
                    {loyaltyRewardAvailable
                      ? `${loyalty.discountPercent}% off this order — your progress then resets so you can earn the next one.`
                      : `${loyalty.discountPercent}% off ${loyaltyDiscountableKg} kg of this order's ${kg} kg — the rest completes your progress, then it resets.`}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-brand-bg px-4 py-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Loyalty progress</span>
                    <span className="figure font-medium text-brand-navy">
                      {loyaltyProgressKg} / {loyalty.thresholdKg} kg
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-brand-teal"
                      style={{ width: `${Math.min(100, (loyaltyProgressKg / loyalty.thresholdKg) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {loyaltyKgToNextReward} kg more to unlock {loyalty.discountPercent}% off your next order.
                  </p>
                </div>
              )
            )}

            {pricePerKg !== null && (
              <div className="rounded-xl bg-brand-bg px-4 py-3 text-sm">
                {offer && (
                  <div className="mb-3 rounded-lg bg-white px-3 py-2 text-brand-navy">
                    <p className="font-semibold">{offer.offer_title || 'Active refill offer'}</p>
                    {offer.offer_message && <p className="mt-1 text-xs text-slate-500">{offer.offer_message}</p>}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{offer ? 'Offer price per kg' : 'Price per kg'}</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(pricePerKg)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Gas cost{kgValid ? ` (${kg} kg)` : ''}</span>
                  <span className="figure font-medium text-brand-navy">{gasCost !== null ? formatNaira(gasCost) : '—'}</span>
                </div>
                {loyaltyDiscount > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-brand-teal">Loyalty discount</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(loyaltyDiscount)}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Delivery fee</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(deliveryFee)}</span>
                </div>
                {renderShopBreakdownLines()}
                {referralCreditApplied > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-brand-teal">Referral credit</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(referralCreditApplied)}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Estimated total</span>
                  <span className="figure font-semibold text-brand-navy">{total !== null ? formatNaira(total) : '—'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <label className="label-text">Cylinder photo</label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-brand-bg px-3.5 py-3 text-sm">
              <input
                type="checkbox"
                checked={forSomeoneElse}
                onChange={(e) => handleForSomeoneElseToggle(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-brand-teal"
              />
              <span className="text-slate-600">
                <span className="font-medium text-brand-navy">This isn't my cylinder</span> — I'm ordering for someone else.
                Upload their photo below; it won't replace your saved default.
              </span>
            </label>

            {imagePreview || usableExistingImageUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200">
                <img src={imagePreview || resolveImageUrl(usableExistingImageUrl)} alt="Cylinder" className="h-48 w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-black/55 px-3 py-2 backdrop-blur-sm">
                  <span className="text-xs text-white">
                    {imagePreview ? (forSomeoneElse ? "Someone else's photo" : 'New photo') : 'Using your saved photo'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-white/30">
                      <Camera className="h-3 w-3" strokeWidth={2} />
                      Camera
                      <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-white/30">
                      <ImagePlus className="h-3 w-3" strokeWidth={2} />
                      Gallery
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => setCylinderImage(null)}
                        className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-white/30"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition-colors hover:border-brand-teal hover:text-brand-teal">
                  <Camera className="h-8 w-8" strokeWidth={1.6} />
                  <span className="text-center text-sm font-medium">Take Photo</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                </label>
                <label className="flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition-colors hover:border-brand-teal hover:text-brand-teal">
                  <ImagePlus className="h-8 w-8" strokeWidth={1.6} />
                  <span className="text-center text-sm font-medium">Choose from Gallery</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            )}

            <p className="text-xs text-slate-400">
              {forSomeoneElse
                ? "This photo is used for this order only and stays off your own profile, so our rider knows it isn't your cylinder."
                : "This helps our rider identify your cylinder at pickup — it's saved to your profile for next time."}
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="label-text">Delivery Location</label>
              <LocationTypeToggle value={locationType} onChange={setLocationType} className="mb-3" />
            </div>

            {locationType === 'hostel' ? (
              <>
                <div>
                  <label className="label-text" htmlFor="hostel-name">Hostel</label>
                  <HostelSelect id="hostel-name" icon={MapPin} value={hostelName} onChange={(e) => setHostelName(e.target.value)} required />
                </div>

                <div>
                  <label className="label-text" htmlFor="room-details">Block / Room (optional)</label>
                  <input
                    id="room-details"
                    type="text"
                    placeholder="e.g. Block 2, Room 14"
                    value={roomDetails}
                    onChange={(e) => setRoomDetails(e.target.value)}
                    className="input-field"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label-text" htmlFor="delivery-zone">Delivery zone</label>
                  <DeliveryZoneSelect
                    id="delivery-zone"
                    icon={MapPin}
                    value={deliveryZoneId}
                    onChange={(e) => setDeliveryZoneId(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="label-text" htmlFor="off-campus-address">Delivery address</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} aria-hidden="true" />
                    <textarea
                      id="off-campus-address"
                      placeholder="e.g. 12 Adeola Street, Yaba, Lagos"
                      value={offCampusAddress}
                      onChange={(e) => setOffCampusAddress(e.target.value)}
                      rows={3}
                      required
                      className="input-field min-h-[5.5rem] resize-y pl-9"
                    />
                  </div>
                </div>
              </>
            )}

            <p className="text-xs text-slate-400">This is exactly where we'll bring your refilled cylinder.</p>

            {pricePerKg !== null && (
              <div className="rounded-xl bg-brand-bg px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Gas cost{kgValid ? ` (${kg} kg)` : ''}</span>
                  <span className="figure font-medium text-brand-navy">{gasCost !== null ? formatNaira(gasCost) : '—'}</span>
                </div>
                {loyaltyDiscount > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-brand-teal">Loyalty discount</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(loyaltyDiscount)}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Delivery fee</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(deliveryFee)}</span>
                </div>
                {renderShopBreakdownLines()}
                {referralCreditApplied > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-brand-teal">Referral credit</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(referralCreditApplied)}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Estimated total</span>
                  <span className="figure font-semibold text-brand-navy">{total !== null ? formatNaira(total) : '—'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {(imagePreview || usableExistingImageUrl) && (
                <img src={imagePreview || resolveImageUrl(usableExistingImageUrl)} alt="Cylinder" className="h-32 w-full object-cover" />
              )}
              {forSomeoneElse && (
                <p className="bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">Not your saved cylinder — ordering on behalf of someone else</p>
              )}
              <div className="flex flex-col gap-2 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Refill size</span>
                  <span className="figure font-medium text-brand-navy">{kg} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Price per kg</span>
                  <span className="figure font-medium text-brand-navy">{pricePerKg !== null ? formatNaira(pricePerKg) : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Gas cost</span>
                  <span className="figure font-medium text-brand-navy">{gasCost !== null ? formatNaira(gasCost) : '—'}</span>
                </div>
                {loyaltyDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-brand-teal">Loyalty discount</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(loyaltyDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Delivery fee</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(deliveryFee)}</span>
                </div>
                {renderShopBreakdownLines()}
                {referralCreditApplied > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-brand-teal">Referral credit</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(referralCreditApplied)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="font-medium text-slate-600">Total</span>
                  <span className="figure text-base font-bold text-brand-navy">{total !== null ? formatNaira(total) : '—'}</span>
                </div>
                <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-2">
                  <span className="text-slate-500">Delivery address</span>
                  <span className="text-right text-slate-700">{hostelAddress}</span>
                </div>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.8} />
              You'll be redirected to Paystack to pay securely — nothing is charged until you confirm there.
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={goBack} disabled={submitting} className="btn-outline">
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Back
            </button>
          )}

          {step < STEP_LABELS.length - 1 ? (
            <button type="button" onClick={goNext} disabled={!canAdvance} className="btn-primary ml-auto">
              Next
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : !token ? (
            // Guests can fill out the whole wizard — login is only enforced
            // here, at the actual pay step, rather than blocking the page
            // entirely (see Home.jsx, the new guest-viewable "/").
            <button type="button" onClick={goLoginToOrder} className="btn-primary ml-auto">
              Log In to Order
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (cart.itemCount === 0 ? setAddToDeliveryOpen(true) : setConfirmOpen(true))}
              disabled={submitting}
              className="btn-primary ml-auto"
            >
              {submitting ? 'Processing…' : 'Continue to Payment'}
            </button>
          )}
        </div>

        {error && (
          <div className="alert-error mt-4 flex flex-col gap-3">
            <p>{error}</p>

            {needsProfileImage && (
              <div>
                <label className="label-text text-red-700">Upload a cylinder image now to continue:</label>
                <input type="file" accept="image/*" onChange={handleRecoveryFileChange} disabled={submitting} className="file-input" />
              </div>
            )}
          </div>
        )}
      </div>

      <AddToDeliveryModal
        open={addToDeliveryOpen}
        onClose={() => setAddToDeliveryOpen(false)}
        onContinue={() => {
          setAddToDeliveryOpen(false)
          setConfirmOpen(true)
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Place this order?"
        message={`${kg} kg for ${total !== null ? formatNaira(total) : '—'} — you'll be sent to Paystack to pay.`}
        confirmLabel="Confirm & Pay"
        busy={submitting}
        onConfirm={handleCheckout}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

export default CreateOrder
