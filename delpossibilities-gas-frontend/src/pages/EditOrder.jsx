import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, ImagePlus, Camera, ShoppingBag, X, PackageX } from 'lucide-react'
import { apiFetch, formatNaira, resolveImageUrl } from '../api'
import { publicFetch } from '../publicData'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
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

// Same tiered fee lookup CreateOrder.jsx uses — kept as its own copy here
// rather than a shared import since it's the only other page-local hook it
// has too, and the two pages don't otherwise share module state.
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

// Full parity with CreateOrder.jsx (image, on/off-campus address, shop
// items) but for a pending order that already exists — reached from a
// "Not satisfied? Edit this order" button on OrderDetail.jsx (the track
// page), rather than a step in the create wizard. Submits to
// POST /orders/{order}/edit (see OrderController::update), which recomputes
// every discount fresh and clears any stale gateway reference so payment
// reflects the new total.
function EditOrder({ token }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const cart = useCart()
  const { user } = useCurrentUser()
  const { zones: deliveryZones } = useDeliveryZones()
  const eazyMarketTiers = useEazyMarketTiers()
  const { startPayment: startGatewayPayment, pickerOpen, pickerBusy, chooseGateway, cancelPicker } = usePaymentCheckout(token)

  const [orders, setOrders] = useState(null)
  const [loadError, setLoadError] = useState('')

  const [kg, setKg] = useState('')
  const [cylinderImage, setCylinderImage] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [locationType, setLocationType] = useState('hostel')
  const [hostelName, setHostelName] = useState('')
  const [roomDetails, setRoomDetails] = useState('')
  const [offCampusAddress, setOffCampusAddress] = useState('')
  const [deliveryZoneId, setDeliveryZoneId] = useState('')
  const [pricePerKg, setPricePerKg] = useState(null)
  const [deliveryFeeHostel, setDeliveryFeeHostel] = useState(0)
  const [loyalty, setLoyalty] = useState(null)

  // What's currently linked to this order — cleared to null means "remove
  // it on save" (see submit). A fresh local cart (below) takes priority
  // over whatever bundledCart already holds, since a ProductOrder's items
  // can't be edited in place (see ProductOrderController — only store()
  // exists), only swapped for a new one.
  const [bundledCart, setBundledCart] = useState(null)
  const [attachedCart, setAttachedCart] = useState(null)
  const [attachableOrders, setAttachableOrders] = useState([])
  const [selectedAttachId, setSelectedAttachId] = useState('')
  const [addToDeliveryOpen, setAddToDeliveryOpen] = useState(false)

  const [seeded, setSeeded] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch('/my-orders', { token })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setLoadError('Check your internet connection.'))
  }, [token])

  useEffect(() => {
    publicFetch('/price')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.delivery_fee !== undefined && data?.delivery_fee !== null) setDeliveryFeeHostel(Number(data.delivery_fee))
        const activeOffer = data?.offer_active && data?.offer_price_per_kg
        setPricePerKg(activeOffer ? Number(data.offer_price_per_kg) : Number(data?.price_per_kg ?? 0))

        // Loyalty threshold/percent live on Setting, not User — this is the
        // same source CreateOrder.jsx reads them from.
        if (data?.loyalty_enabled && data?.loyalty_threshold_kg && data?.loyalty_discount_percent) {
          setLoyalty({
            thresholdKg: Number(data.loyalty_threshold_kg),
            discountPercent: Number(data.loyalty_discount_percent),
          })
        }
      })
      .catch(() => {})
  }, [])

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

  const order = orders?.find((o) => String(o.id) === id)

  // One-shot seed from the fetched order — guarded so a later refetch (e.g.
  // after a failed save) never clobbers what the student is mid-editing.
  useEffect(() => {
    if (!order || seeded) return

    /* eslint-disable react-hooks/set-state-in-effect -- one-shot seed of
       editable fields from the fetched order; guarded by `seeded` so it
       runs at most once, not a render loop. */
    setSeeded(true)

    setKg(String(order.kg))
    setExistingImageUrl(order.cylinder_image_url || null)
    setLocationType(order.location_type)

    if (order.location_type === 'hostel') {
      setHostelName(order.hostel_address || '')
      setRoomDetails('')
    } else {
      setOffCampusAddress(order.hostel_address || '')
      setDeliveryZoneId(order.delivery_zone_id ? String(order.delivery_zone_id) : '')
    }

    if (order.product_order) setBundledCart(order.product_order)
    if (order.attached_product_order) {
      setAttachedCart(order.attached_product_order)
      setSelectedAttachId(String(order.attached_product_order.id))
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [order, seeded])

  // Split hostel_address ("Hostel Name, Room details") back against the
  // real hostel list — same approach as OrderDetail.jsx's inline edit did
  // before this page replaced it.
  const [hostelsLoaded, setHostelsLoaded] = useState(false)
  useEffect(() => {
    if (!order || hostelsLoaded || order.location_type !== 'hostel') return

    publicFetch('/hostels')
      .then((res) => (res.ok ? res.json() : []))
      .then((hostels) => {
        const address = order.hostel_address || ''
        const matched = (Array.isArray(hostels) ? hostels : []).find(
          (h) => address === h.name || address.startsWith(`${h.name}, `)
        )
        if (matched) {
          setHostelName(matched.name)
          setRoomDetails(address.slice(matched.name.length + 2))
        }
        setHostelsLoaded(true)
      })
      .catch(() => setHostelsLoaded(true))
  }, [order, hostelsLoaded])

  const kgValue = parseFloat(kg)
  const kgValid = !isNaN(kgValue) && kgValue > 0
  const hostelAddress = locationType === 'hostel'
    ? [hostelName, roomDetails.trim()].filter(Boolean).join(', ')
    : offCampusAddress.trim()
  const addressValid = locationType === 'hostel'
    ? hostelName.trim().length > 0
    : offCampusAddress.trim().length > 0 && !!deliveryZoneId
  const hasImage = !!cylinderImage || !!existingImageUrl
  const selectedZone = deliveryZones.find((z) => String(z.id) === String(deliveryZoneId))

  const getsFreeGasDelivery = Boolean(user?.membership_tier === 'vip' || user?.membership_tier === 'vvip' || user?.is_investor)
  const getsFreeGas = user?.membership_tier === 'vvip'
  const deliveryFee = getsFreeGasDelivery ? 0 : (locationType === 'off_campus' ? Number(selectedZone?.fee || 0) : deliveryFeeHostel)
  const gasCost = pricePerKg !== null && kgValid ? pricePerKg * kgValue : null

  const loyaltyProgressKg = Number(user?.loyalty_progress_kg || 0)
  const loyaltyNeededToComplete = loyalty ? Math.max(loyalty.thresholdKg - loyaltyProgressKg, 0) : 0
  const loyaltyDiscountableKg = loyalty && kgValid && !getsFreeGas ? Math.max(kgValue - loyaltyNeededToComplete, 0) : 0
  const loyaltyDiscount = loyalty && pricePerKg !== null && loyaltyDiscountableKg > 0
    ? round2(pricePerKg * loyaltyDiscountableKg * (loyalty.discountPercent / 100))
    : 0

  const referralPercentAvailable = Number(user?.referral_discount_percent_available || 0)
  const remainingAfterLoyalty = gasCost !== null ? Math.max(gasCost - loyaltyDiscount, 0) : null
  const referralPercentUsed = getsFreeGas || !remainingAfterLoyalty ? 0 : Math.min(referralPercentAvailable, 100)
  const referralDiscount = referralPercentUsed > 0 && remainingAfterLoyalty !== null
    ? round2(remainingAfterLoyalty * (referralPercentUsed / 100))
    : 0
  const vvipDiscount = getsFreeGas && gasCost !== null ? gasCost : 0

  const cartEazyMarketSubtotal = cart.subtotalByGroup.eazy_market || 0
  const cartGasServicesSubtotal = cart.subtotalByGroup.gas_services || 0
  const cartEazyMarketFee = useMemo(() => {
    const tier = eazyMarketTiers.find(
      (t) => cartEazyMarketSubtotal >= Number(t.min_amount) && (t.max_amount === null || cartEazyMarketSubtotal <= Number(t.max_amount))
    )
    return tier ? Number(tier.fee) : 0
  }, [eazyMarketTiers, cartEazyMarketSubtotal])

  // A fresh local cart always wins over whatever bundle already existed —
  // see the note on bundledCart above.
  const willBundleFreshCart = cart.itemCount > 0
  const shopChargeNow = willBundleFreshCart
    ? cart.subtotal + cartEazyMarketFee
    : bundledCart
      ? Number(bundledCart.total_amount)
      : 0

  const total = gasCost !== null
    ? Math.max(gasCost - loyaltyDiscount - referralDiscount - vvipDiscount, 0) + deliveryFee + shopChargeNow
    : null

  const canSave = kgValid && hasImage && addressValid && !saving

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) setCylinderImage(file)
  }

  const handleSave = async () => {
    if (!canSave) return
    setError('')
    setSaving(true)

    try {
      let productOrderId = bundledCart?.id ?? null

      if (willBundleFreshCart) {
        const response = await apiFetch('/product-orders', {
          method: 'POST',
          token,
          body: {
            items: cart.items.map((item) => ({
              product_id: item.productId,
              product_variant_id: item.variantId,
              quantity: item.quantity,
            })),
          },
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          setError(data?.message || 'Could not prepare your cart for this order.')
          setSaving(false)
          return
        }
        productOrderId = data.id
      }

      const formData = new FormData()
      formData.append('kg', kg)
      formData.append('location_type', locationType)
      formData.append('hostel_address', hostelAddress)
      if (locationType === 'off_campus') formData.append('delivery_zone_id', deliveryZoneId)
      if (cylinderImage) formData.append('cylinder_image', cylinderImage)
      if (productOrderId) formData.append('product_order_id', productOrderId)
      if (selectedAttachId) formData.append('attached_product_order_id', selectedAttachId)

      const response = await apiFetch(`/orders/${id}/edit`, { method: 'POST', token, body: formData })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.message || 'Could not save your changes.')
        setSaving(false)
        return
      }

      if (willBundleFreshCart) cart.clear()

      show('Order updated — taking you to payment.', { type: 'success', duration: 2500 })

      const { ok, data: payData, cancelled } = await startGatewayPayment('order', data.id)
      if (cancelled) {
        navigate(`/orders/${data.id}`)
        return
      }
      if (!ok || !payData?.authorization_url) {
        show(payData?.message || 'Saved, but payment could not start. Retry from the order page.', { type: 'error' })
        navigate(`/orders/${data.id}`)
        return
      }
      window.location.href = payData.authorization_url
    } catch {
      setError('Check your internet connection.')
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="alert-error">{loadError}</p>
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

  if (order.status !== 'pending') {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={PackageX}
          title="This order can no longer be edited"
          description="It's already been paid for or handled."
          action={
            <Link to={`/orders/${order.id}`} className="btn-primary mt-2">
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Back to Order
            </Link>
          }
        />
      </div>
    )
  }

  const imageSrc = cylinderImage ? URL.createObjectURL(cylinderImage) : resolveImageUrl(existingImageUrl)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={`Order #${order.id}`}
        title="Edit order"
        subtitle="Change anything below, then continue to payment."
        action={
          <Link to={`/orders/${order.id}`} className="btn-outline">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Cancel
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="card">
          <h3 className="mb-4 font-heading text-base font-bold text-brand-navy">Refill size</h3>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            className="input-field"
            required
          />
        </div>

        <div className="card">
          <h3 className="mb-4 font-heading text-base font-bold text-brand-navy">Cylinder photo</h3>
          {imageSrc && (
            <div className="mb-3 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <img src={imageSrc} alt="Cylinder" width={640} height={192} loading="lazy" decoding="async" className="h-48 w-full object-cover" />
            </div>
          )}
          <label className="btn-outline w-full cursor-pointer justify-center">
            {cylinderImage ? <Camera className="h-4 w-4" strokeWidth={1.8} /> : <ImagePlus className="h-4 w-4" strokeWidth={1.8} />}
            {cylinderImage ? 'Replace photo again' : 'Replace photo'}
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
        </div>

        <div className="card">
          <h3 className="mb-4 font-heading text-base font-bold text-brand-navy">Delivery address</h3>
          <LocationTypeToggle value={locationType} onChange={setLocationType} className="mb-3" />

          {locationType === 'hostel' ? (
            <>
              <div>
                <label className="label-text" htmlFor="edit-order-hostel">Hostel</label>
                <HostelSelect id="edit-order-hostel" icon={MapPin} value={hostelName} onChange={(e) => setHostelName(e.target.value)} required />
              </div>
              <div className="mt-3">
                <label className="label-text" htmlFor="edit-order-room">Block / Room (optional)</label>
                <input
                  id="edit-order-room"
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
                <label className="label-text" htmlFor="edit-order-zone">Delivery zone</label>
                <DeliveryZoneSelect id="edit-order-zone" icon={MapPin} value={deliveryZoneId} onChange={(e) => setDeliveryZoneId(e.target.value)} required />
              </div>
              <div className="mt-3">
                <label className="label-text" htmlFor="edit-order-address">Delivery address</label>
                <textarea
                  id="edit-order-address"
                  placeholder="e.g. 12 Adeola Street, Yaba, Lagos"
                  value={offCampusAddress}
                  onChange={(e) => setOffCampusAddress(e.target.value)}
                  rows={3}
                  required
                  className="input-field min-h-[5.5rem] resize-y"
                />
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-base font-bold text-brand-navy">Shop items</h3>
            <button type="button" onClick={() => setAddToDeliveryOpen(true)} className="btn-outline !py-1.5 text-sm">
              <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
              {cart.itemCount > 0 ? `Edit cart (${cart.itemCount})` : 'Add items'}
            </button>
          </div>

          {willBundleFreshCart ? (
            <div className="rounded-xl bg-brand-bg px-4 py-3 text-sm">
              <p className="text-slate-600">
                {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} from your cart will be bundled into this
                order, replacing anything shopped here before.
              </p>
              <div className="mt-2 flex items-center justify-between font-medium text-brand-navy">
                <span>Shop subtotal</span>
                <span className="figure">{formatNaira(cart.subtotal)}</span>
              </div>
              {cartEazyMarketSubtotal > 0 && (
                <div className="mt-1 flex items-center justify-between text-slate-600">
                  <span>Eazy Market delivery</span>
                  <span className="figure">{formatNaira(cartEazyMarketFee)}</span>
                </div>
              )}
              {cartGasServicesSubtotal > 0 && (
                <div className="mt-1 flex items-center justify-between text-slate-600">
                  <span>Gas accessories delivery</span>
                  <span className="figure text-brand-teal">Free</span>
                </div>
              )}
              <button type="button" onClick={() => cart.clear()} className="mt-2 text-xs font-medium text-red-600 hover:underline">
                Clear cart
              </button>
            </div>
          ) : bundledCart ? (
            <div className="flex items-center justify-between rounded-xl bg-brand-bg px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-brand-navy">Shopped with this order</p>
                <p className="text-slate-500">{bundledCart.items?.length || 0} item(s) — {formatNaira(bundledCart.total_amount)}</p>
              </div>
              <button
                type="button"
                onClick={() => setBundledCart(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-red-600"
                aria-label="Remove from this order"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nothing shopped with this order yet.</p>
          )}

          {attachableOrders.length > 0 && (
            <div className="mt-4">
              <label className="label-text" htmlFor="edit-order-attach">Attach an already-paid cart (optional)</label>
              <select
                id="edit-order-attach"
                value={selectedAttachId}
                onChange={(e) => setSelectedAttachId(e.target.value)}
                className="input-field"
              >
                <option value="">None</option>
                {attachedCart && !attachableOrders.some((po) => po.id === attachedCart.id) && (
                  <option value={attachedCart.id}>{formatNaira(attachedCart.total_amount)} (currently attached)</option>
                )}
                {attachableOrders.map((po) => (
                  <option key={po.id} value={po.id}>{formatNaira(po.total_amount)} — paid cart</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="mb-4 font-heading text-base font-bold text-brand-navy">Summary</h3>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Gas cost{kgValid ? ` (${kg} kg)` : ''}</span>
              <span className="figure font-medium text-brand-navy">{gasCost !== null ? formatNaira(gasCost) : '—'}</span>
            </div>
            {loyaltyDiscount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-brand-teal">Loyalty discount</span>
                <span className="figure font-medium text-brand-teal">&minus;{formatNaira(loyaltyDiscount)}</span>
              </div>
            )}
            {referralDiscount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-brand-teal">Referral discount ({referralPercentUsed}%)</span>
                <span className="figure font-medium text-brand-teal">&minus;{formatNaira(referralDiscount)}</span>
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
            {shopChargeNow > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Shop items</span>
                <span className="figure font-medium text-brand-navy">{formatNaira(shopChargeNow)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="font-medium text-slate-600">Total</span>
              <span className="figure text-base font-bold text-brand-navy">{total !== null ? formatNaira(total) : '—'}</span>
            </div>
          </div>

          {error && <p className="alert-error mt-4">{error}</p>}

          <button onClick={handleSave} disabled={!canSave} className="btn-primary mt-5 w-full">
            {saving ? 'Saving…' : 'Save & continue to payment'}
          </button>
        </div>
      </div>

      <AddToDeliveryModal
        open={addToDeliveryOpen}
        onClose={() => setAddToDeliveryOpen(false)}
        onContinue={() => setAddToDeliveryOpen(false)}
      />
      <PaymentGatewayModal open={pickerOpen} busy={pickerBusy} onChoose={chooseGateway} onCancel={cancelPicker} />
    </div>
  )
}

function round2(value) {
  return Math.round(value * 100) / 100
}

export default EditOrder
