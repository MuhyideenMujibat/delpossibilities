import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PlusCircle, MapPin, Flame, Check, ImagePlus, Camera, ArrowLeft, ArrowRight, ShieldCheck, ShoppingBag, ShoppingCart, Gift } from 'lucide-react'
import { apiFetch, formatNaira, resolveImageUrl } from '../api'
import { publicFetch } from '../publicData'
import { setPostAuthRedirect } from '../authRedirect'
import { setPendingOrderImage, takePendingOrderImage } from '../pendingOrderImage'
import { readCachedData, writeCachedData, removeCachedData } from '../offlineCache'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import PaymentGatewayModal from '../components/PaymentGatewayModal'
import AddToDeliveryModal from '../components/shop/AddToDeliveryModal'
import HostelSelect from '../HostelSelect'
import DeliveryZoneSelect from '../DeliveryZoneSelect'
import LocationTypeToggle from '../components/LocationTypeToggle'
import { useToast } from '../toastContext'
import { useCart } from '../cartContext'
import { useCurrentUser } from '../userContext'
import { useDeliveryZones } from '../hooks/useDeliveryZones'
import { usePaymentCheckout } from '../hooks/usePaymentCheckout'

const KG_PRESETS = [5, 10, 12.5, 15]
const ORDER_DRAFT_KEY = 'order-draft'
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

    publicFetch('/eazy-market-delivery-tiers')
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
  const { startPayment: startGatewayPayment, pickerOpen, pickerBusy, chooseGateway, cancelPicker } = usePaymentCheckout(token)

  // The shared /user context (see UserProvider) only fetches once per
  // login and otherwise waits for something to explicitly call refresh() —
  // but loyalty/referral standing can change from someone ELSE's action
  // (a referred student's qualifying order/subscription), which this
  // browser has no way to know about. Force a fresh copy whenever this page
  // is opened, since it's read live below and can be spent on this order.
  useEffect(() => {
    refreshUser?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // What the student had typed last time (saved on every change below), so a
  // dropped connection, a reload or a killed tab on a weak network doesn't
  // make them re-enter the order. The cylinder photo is a File and can't be
  // stored, so it's the one thing they may need to re-pick. Cleared as soon
  // as the order is created. A guest's login hand-off draft (restored in an
  // effect further down) still wins over this.
  const [draft] = useState(() => readCachedData(ORDER_DRAFT_KEY, '') || {})
  const draftClearedRef = useRef(false)

  const [step, setStep] = useState(Math.min(Number(draft.step) || 0, 2))
  const [kg, setKg] = useState(draft.kg ?? '')
  const [customKg, setCustomKg] = useState(Boolean(draft.customKg))
  const [locationType, setLocationType] = useState(draft.locationType || 'hostel')
  const [hostelName, setHostelName] = useState(draft.hostelName || '')
  const [roomDetails, setRoomDetails] = useState(draft.roomDetails || '')
  const [offCampusAddress, setOffCampusAddress] = useState(draft.offCampusAddress || '')
  const [deliveryZoneId, setDeliveryZoneId] = useState(draft.deliveryZoneId || '')
  const [cylinderImage, setCylinderImage] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [forSomeoneElse, setForSomeoneElse] = useState(Boolean(draft.forSomeoneElse))
  const [pricePerKg, setPricePerKg] = useState(null)
  const [deliveryFeeHostel, setDeliveryFeeHostel] = useState(0)
  const [offer, setOffer] = useState(null)
  const [loyalty, setLoyalty] = useState(null)
  const [error, setError] = useState('')
  const [needsProfileImage, setNeedsProfileImage] = useState(false)
  // Set when the backend blocks this submission because an order is already
  // sitting unpaid (see OrderController::store) — a student only ever has
  // one gas order in flight. `duplicateExactMatch` says whether it's the
  // exact same kg/address/photo (just go pay it) or different (offer to
  // update that order to today's form values instead of creating another).
  const [duplicateOrder, setDuplicateOrder] = useState(null)
  const [duplicateExactMatch, setDuplicateExactMatch] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [addToDeliveryOpen, setAddToDeliveryOpen] = useState(false)
  // Defaults on (opt-out, not opt-in) — a refill-only checkout with an
  // empty cart never sees the bundle UI at all, so today's flow stays
  // exactly as easy for anyone not using the shop.
  const [bundleCart, setBundleCart] = useState(true)
  const [pendingProductOrderId, setPendingProductOrderId] = useState(null)
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
    publicFetch('/price')
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
    if (!guestDraftRestoredRef.current && !draft.hostelName && !draft.offCampusAddress) {
      const type = user.location_type || 'hostel'
      setLocationType(type)
      if (user.hostel) {
        if (type === 'off_campus') setOffCampusAddress(user.hostel)
        else setHostelName(user.hostel)
      }
    }
    if (user.cylinder_image_url) setExistingImageUrl(user.cylinder_image_url)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user, draft.hostelName, draft.offCampusAddress])

  // Zones load asynchronously and have no natural "blank" state the way an
  // address field does — same reasoning as defaulting the cylinder image to
  // whatever's already on file, just pre-pick the first zone so the field
  // never sits empty, rather than making every off-campus student choose
  // one before they can even see a total. Only fires while nothing's
  // selected yet, so it never overwrites a restored guest draft or the
  // student's own later choice.
  useEffect(() => {
    if (deliveryZoneId || deliveryZones.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeliveryZoneId(String(deliveryZones[0].id))
  }, [deliveryZones, deliveryZoneId])

  // Loyalty standing and the referral percent balance are read LIVE from
  // the shared /user fetch (not copied into local state like the form
  // fields above) so they update the instant the context refreshes — e.g.
  // right after a paid order, with no page reload or remount needed.
  // PaymentCallback calls refresh() so this is fresh on return, and stays
  // fresh across a second order placed without leaving this page.
  const loyaltyProgressKg = Number(user?.loyalty_progress_kg || 0)
  const referralPercentAvailable = Number(user?.referral_discount_percent_available || 0)
  // A kg credit (not a percent/currency balance) earned from referrals hitting
  // the ambassador milestone — see User::referral_free_kg_balance. Spent
  // automatically here, same as loyalty/referral above: up to this order's
  // own kg, whatever's left over stays on the balance for next time.
  const referralFreeKgBalance = Number(user?.referral_free_kg_balance || 0)
  // The monthly spend cap — separate from the lifetime balance above. Mirrors
  // User::referralFreeKgMonthRemaining exactly (see OrderController::
  // referralFreeKgDiscount, the authoritative version this is meant to
  // preview). Once this hits 0 for the month, no free kg is actually
  // applicable even if the balance itself is still positive.
  const referralFreeKgMonthRemaining = Number(user?.referral_free_kg_month_remaining ?? referralFreeKgBalance)
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

  useEffect(() => {
    if (draftClearedRef.current) return
    if (!kg && !hostelName && !offCampusAddress && !roomDetails) return
    writeCachedData(ORDER_DRAFT_KEY, '', { step, kg, customKg, locationType, hostelName, roomDetails, offCampusAddress, deliveryZoneId, forSomeoneElse })
  }, [step, kg, customKg, locationType, hostelName, roomDetails, offCampusAddress, deliveryZoneId, forSomeoneElse])

  const imagePreview = useMemo(() => (cylinderImage ? URL.createObjectURL(cylinderImage) : null), [cylinderImage])

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const kgValue = Number(kg)
  const kgValid = kg !== '' && !Number.isNaN(kgValue) && kgValue > 0
  const selectedZone = deliveryZones.find((z) => String(z.id) === String(deliveryZoneId))
  // Mirrors User::getsFreeDelivery / ::getsFreeGasDelivery / ::getsFreeGas.
  // VIP: free delivery only, on gas AND shop orders. VVIP: same free
  // delivery, PLUS the gas cost itself is free. An investor (signed
  // investment) gets free delivery on a GAS order specifically — not shop
  // orders, and not the gas cost itself.
  const getsFreeShopDelivery = user?.membership_tier === 'vip' || user?.membership_tier === 'vvip'
  const getsFreeGasDelivery = getsFreeShopDelivery || Boolean(user?.is_investor)
  const getsFreeGas = user?.membership_tier === 'vvip'
  const deliveryFee = getsFreeGasDelivery ? 0 : (locationType === 'off_campus' ? Number(selectedZone?.fee || 0) : deliveryFeeHostel)
  const gasCost = pricePerKg !== null && kgValid ? pricePerKg * kgValue : null
  // Mirrors the backend (OrderController::store): once loyalty_progress_kg
  // has reached the threshold, the kg of this order beyond what was still
  // needed to complete the threshold is discounted — not the whole order,
  // and not nothing. `loyaltyNeededToComplete` is 0 once the threshold is
  // already reached, so the whole order is discountable in that case.
  // Skipped entirely for a VVIP account — nothing left to discount on an
  // already-free order, so the reward isn't spent for zero benefit.
  const loyaltyNeededToComplete = loyalty ? Math.max(loyalty.thresholdKg - loyaltyProgressKg, 0) : 0
  const loyaltyDiscountableKg = loyalty && kgValid && !getsFreeGas ? Math.max(kgValue - loyaltyNeededToComplete, 0) : 0
  const loyaltyDiscount = loyalty && pricePerKg !== null && loyaltyDiscountableKg > 0
    ? pricePerKg * loyaltyDiscountableKg * (loyalty.discountPercent / 100)
    : 0
  // Spent right after loyalty and before the referral percent below — mirrors
  // OrderController::referralFreeKgDiscount exactly: covers at most this
  // order's own kg, never more than the balance holds, and never more than
  // what's left of the monthly spend cap — once that cap is used up this
  // month, freeKgUsed is 0 even if the lifetime balance is still positive,
  // matching exactly what the backend will actually apply at checkout. Also
  // skipped for VVIP, same reasoning as loyalty (nothing left to discount on
  // a free order).
  const freeKgUsed = !getsFreeGas && kgValid && referralFreeKgBalance > 0 && referralFreeKgMonthRemaining > 0
    ? Math.min(referralFreeKgBalance, kgValue, referralFreeKgMonthRemaining)
    : 0
  // What the banner below should actually promise — the balance capped by
  // what's left of this month's spend cap, so it never advertises more than
  // the backend will actually apply. 0 once the monthly cap is used up,
  // even if the lifetime balance is still positive — the banner then hides
  // entirely (see the condition below).
  const freeKgAvailableThisMonth = !getsFreeGas
    ? Math.min(referralFreeKgBalance, referralFreeKgMonthRemaining)
    : 0
  const freeKgDiscount = freeKgUsed > 0 && pricePerKg !== null ? pricePerKg * freeKgUsed : 0
  // What's left on the free-kg balance once this order spends its share —
  // shown so the student can see it carries over rather than vanishing.
  const freeKgRemaining = Math.round((referralFreeKgBalance - freeKgUsed) * 100) / 100
  // Applied to whatever's still owed on the gas cost AFTER loyalty AND the
  // free-kg credit above — loyalty goes first, then free kg, then referral
  // percent only discounts what's left of those two. referralPercentAvailable
  // is a running PERCENT balance (not a coupon count — see
  // User::grantReferralReward), so it can be over 100% (e.g. 140% from two
  // referrals at 70% each); this one order only ever spends up to 100
  // percentage points of it, and whatever's left (e.g. that other 40%) stays
  // on the balance for a future order. Mirrors OrderController::store. Also
  // skipped for VVIP, same reasoning as loyalty.
  const remainingAfterLoyalty = gasCost !== null ? Math.max(gasCost - loyaltyDiscount - freeKgDiscount, 0) : null
  const referralPercentUsed = getsFreeGas || !remainingAfterLoyalty
    ? 0
    : Math.min(referralPercentAvailable, 100)
  const referralDiscount = referralPercentUsed > 0 && remainingAfterLoyalty !== null
    ? Math.round(remainingAfterLoyalty * (referralPercentUsed / 100) * 100) / 100
    : 0
  // What's left on the balance once this order spends its share — shown so
  // the student can see it carries over rather than vanishing. Rounded to
  // guard against binary floating-point noise from the subtraction (e.g.
  // 33.33 - 33.33 landing on 0.00000000003 instead of a clean 0).
  const referralPercentRemaining = Math.round((referralPercentAvailable - referralPercentUsed) * 100) / 100
  // The whole gas cost, wiped out as its own line item for a VVIP account.
  const vvipDiscount = getsFreeGas && gasCost !== null ? gasCost : 0
  // Whether a fresh, still-unpaid cart is actually going to be bundled into
  // this same charge (mirrors ensureProductOrder's own condition exactly).
  // Independent of attachOrderId: a student can attach an already-paid cart
  // for delivery AND still bundle their remaining unpaid items on the same
  // refill — the attached order just adds nothing to this total.
  const bundlingFreshCart = bundleCart && cart.itemCount > 0
  const cartEazyMarketSubtotal = cart.subtotalByGroup.eazy_market || 0
  const cartGasServicesSubtotal = cart.subtotalByGroup.gas_services || 0
  const cartEazyMarketFee = useMemo(() => {
    if (getsFreeShopDelivery || cartEazyMarketSubtotal <= 0) return 0
    const tier = eazyMarketTiers.find(
      (t) => cartEazyMarketSubtotal >= Number(t.min_amount) && (t.max_amount === null || cartEazyMarketSubtotal <= Number(t.max_amount))
    )
    return tier ? Number(tier.fee) : 0
  }, [eazyMarketTiers, cartEazyMarketSubtotal, getsFreeShopDelivery])
  const shopChargeNow = bundlingFreshCart ? cart.subtotal + cartEazyMarketFee : 0
  const total = gasCost !== null ? Math.max(gasCost - loyaltyDiscount - freeKgDiscount - referralDiscount - vvipDiscount, 0) + deliveryFee + shopChargeNow : null
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

  const submitOrder = async (imageFile, { syncProfile = true, forceCreate = false } = {}) => {
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
    if (imageFile) {
      formData.append('cylinder_image', imageFile)
    }
    // Set only when the student explicitly chose "create this order anyway"
    // from the already-have-one-pending prompt below — see the 409 case.
    if (forceCreate) {
      formData.append('force_create', '1')
    }

    const response = await apiFetch('/orders', { method: 'POST', token, body: formData })
    const data = await response.json().catch(() => null)

    if (response.status === 422) {
      setError(data?.message || 'Please add a cylinder image to continue.')
      setNeedsProfileImage(true)
      return null
    }

    if (response.status === 409) {
      setError(data?.message || 'You already have an order awaiting payment.')
      setDuplicateOrder(data?.existing_order ?? null)
      setDuplicateExactMatch(Boolean(data?.exact_match))
      return null
    }

    if (!response.ok) {
      setError(data?.message || 'Could not create the order.')
      return null
    }

    // The order exists server-side now — the saved form draft has done its job.
    draftClearedRef.current = true
    removeCachedData(ORDER_DRAFT_KEY, '')

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

  // Reached from the "you already have one pending" prompt below (see the
  // 409 case in submitOrder) when the student chooses to go ahead anyway —
  // resubmits with force_create so the backend skips the pending-order
  // check this time, then pays for the freshly created order. Editing the
  // existing pending order instead happens on its own tracking page
  // (OrderDetail.jsx), not here.
  const handleCreateAnyway = async () => {
    setError('')
    setDuplicateOrder(null)
    setDuplicateExactMatch(false)
    setSubmitting(true)

    try {
      const order = await submitOrder(cylinderImage, { syncProfile: !forSomeoneElse, forceCreate: true })
      if (!order) return
      await startPayment(order)
    } catch {
      setError('Check your internet connection.')
    } finally {
      setSubmitting(false)
    }
  }

  const startPayment = async (order) => {
    const { ok, data: payData, gateway, cancelled } = await startGatewayPayment('order', order.id)

    if (cancelled) {
      navigate('/orders')
      return
    }

    if (!ok || !payData?.authorization_url) {
      show(payData?.message || 'Order created, but payment could not start. Retry from Track.', { type: 'error' })
      navigate('/orders')
      return
    }

    show(`Order created — redirecting you to ${gateway === 'flutterwave' ? 'Flutterwave' : 'Paystack'}…`, { type: 'success', duration: 2500 })
    window.location.href = payData.authorization_url
  }

  const handleCheckout = async () => {
    // Guards double-fire: the confirm dialog's button disables on `submitting`,
    // but this also protects against a stray second call reaching here.
    if (submitting) return

    setConfirmOpen(false)
    setError('')
    setNeedsProfileImage(false)
    setDuplicateOrder(null)
    setDuplicateExactMatch(false)
    setSubmitting(true)

    try {
      const order = await submitOrder(cylinderImage, { syncProfile: !forSomeoneElse })
      if (!order) return
      await startPayment(order)
    } catch {
      setError('Check your internet connection.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecoveryFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setError('')
    setDuplicateOrder(null)
    setDuplicateExactMatch(false)
    setSubmitting(true)

    try {
      const order = await submitOrder(file)
      if (!order) return
      await startPayment(order)
    } catch {
      setError('Check your internet connection.')
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
    setPostAuthRedirect('/home')
    navigate('/login', { state: { from: '/home' } })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Create Order" subtitle="Request a gas refill for delivery to your hostel." icon={PlusCircle} />

      {!getsFreeGas && freeKgAvailableThisMonth > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3 text-sm">
          <Gift className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" strokeWidth={2} />
          <span>
            <span className="font-medium text-brand-navy">Free gas credit from referrals</span> — you have{' '}
            <strong>{freeKgAvailableThisMonth}kg</strong> available. It&apos;s applied to this order automatically at
            checkout — if this order is {freeKgAvailableThisMonth}kg or more, {freeKgAvailableThisMonth}kg of it is free;
            if it&apos;s less, only what you order is covered.
            {kgValid && freeKgUsed > 0 && freeKgRemaining > 0 && (
              <> The remaining {freeKgRemaining}kg carries over to your next order.</>
            )}
            {kgValid && freeKgUsed > 0 && freeKgRemaining === 0 && (
              <> This order uses it up completely.</>
            )}
          </span>
        </div>
      )}

      {!getsFreeGas && referralPercentAvailable > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3 text-sm">
          <Gift className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" strokeWidth={2} />
          <span>
            <span className="font-medium text-brand-navy">Referral discount</span> — you have{' '}
            <strong>{referralPercentAvailable}%</strong> available. Up to 100% is applied to this order&apos;s gas
            cost automatically at checkout — enough to make it fully free once you hit that mark.
            {kgValid && referralPercentUsed > 0 && referralPercentRemaining > 0 && (
              <> {referralPercentRemaining}% will carry over to your next order.</>
            )}
          </span>
        </div>
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
                {freeKgDiscount > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-brand-teal">Free gas credit ({freeKgUsed}kg)</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(freeKgDiscount)}</span>
                  </div>
                )}
                {vvipDiscount > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-brand-teal">VVIP discount — gas is free</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(vvipDiscount)}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Delivery fee</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(deliveryFee)}</span>
                </div>
                {renderShopBreakdownLines()}
                {referralDiscount > 0 && (
                  <div className="mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-brand-teal">
                        Referral discount ({referralPercentUsed}%)
                      </span>
                      <span className="figure font-medium text-brand-teal">&minus;{formatNaira(referralDiscount)}</span>
                    </div>
                    {referralPercentRemaining > 0 && (
                      <p className="text-xs text-slate-400">
                        {referralPercentRemaining}% left for next time
                      </p>
                    )}
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
                <img src={imagePreview || resolveImageUrl(usableExistingImageUrl)} alt="Cylinder" width={640} height={192} loading="lazy" decoding="async" className="h-48 w-full object-cover" />
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
                {freeKgDiscount > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-brand-teal">Free gas credit ({freeKgUsed}kg)</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(freeKgDiscount)}</span>
                  </div>
                )}
                {vvipDiscount > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-brand-teal">VVIP discount — gas is free</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(vvipDiscount)}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Delivery fee</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(deliveryFee)}</span>
                </div>
                {renderShopBreakdownLines()}
                {referralDiscount > 0 && (
                  <div className="mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-brand-teal">
                        Referral discount ({referralPercentUsed}%)
                      </span>
                      <span className="figure font-medium text-brand-teal">&minus;{formatNaira(referralDiscount)}</span>
                    </div>
                    {referralPercentRemaining > 0 && (
                      <p className="text-xs text-slate-400">
                        {referralPercentRemaining}% left for next time
                      </p>
                    )}
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
                <img src={imagePreview || resolveImageUrl(usableExistingImageUrl)} alt="Cylinder" width={640} height={128} loading="lazy" decoding="async" className="h-32 w-full object-cover" />
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
                {freeKgDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-brand-teal">Free gas credit ({freeKgUsed}kg)</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(freeKgDiscount)}</span>
                  </div>
                )}
                {vvipDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-brand-teal">VVIP discount — gas is free</span>
                    <span className="figure font-medium text-brand-teal">&minus;{formatNaira(vvipDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Delivery fee</span>
                  <span className="figure font-medium text-brand-navy">{formatNaira(deliveryFee)}</span>
                </div>
                {renderShopBreakdownLines()}
                {referralDiscount > 0 && (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-brand-teal">
                        Referral discount ({referralPercentUsed}%)
                      </span>
                      <span className="figure font-medium text-brand-teal">&minus;{formatNaira(referralDiscount)}</span>
                    </div>
                    {referralPercentRemaining > 0 && (
                      <p className="text-xs text-slate-400">
                        {referralPercentRemaining}% left for next time
                      </p>
                    )}
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
              You'll be redirected to our secure payment page to pay — nothing is charged until you confirm there.
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

            {duplicateOrder && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-600">
                  {duplicateExactMatch
                    ? "It's an exact match for an order you already have pending — edit and pay for it there, or go ahead and create this one anyway."
                    : "Choose whether to edit and pay for your existing pending order instead, or create this one as a separate order."}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link to={`/orders/${duplicateOrder.id}/edit`} className="btn-primary">
                    Edit &amp; pay that order
                  </Link>
                  <button type="button" onClick={handleCreateAnyway} disabled={submitting} className="btn-outline">
                    {submitting ? 'Creating…' : 'Create this order anyway'}
                  </button>
                </div>
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
        message={`${kg} kg for ${total !== null ? formatNaira(total) : '—'} — you'll be sent to pay next.`}
        confirmLabel="Confirm & Pay"
        busy={submitting}
        onConfirm={handleCheckout}
        onCancel={() => setConfirmOpen(false)}
      />

      <PaymentGatewayModal open={pickerOpen} busy={pickerBusy} onChoose={chooseGateway} onCancel={cancelPicker} />
    </div>
  )
}

export default CreateOrder
