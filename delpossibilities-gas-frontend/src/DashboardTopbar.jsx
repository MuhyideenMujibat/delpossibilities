import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { apiFetch, formatNaira } from './api'
import HeaderUserMenu from './HeaderUserMenu'
import NotificationBell from './NotificationBell'
import { useCart } from './cartContext'

function todayLabel() {
  return new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Persistent strip above every dashboard page. Also the single home for the
// profile/logout menu, top-right, on every breakpoint — the sidebar no
// longer carries its own logout control.
function DashboardTopbar({ token, role, onLogout }) {
  const [price, setPrice] = useState(null)
  const [deliveryFeeHostel, setDeliveryFeeHostel] = useState(null)
  const [locationType, setLocationType] = useState('hostel')
  const isAdmin = role === 'admin' || role === 'super_admin'
  // Always called (Rules of Hooks) — the badge below just isn't rendered
  // for admins, who never buy anything.
  const cart = useCart()

  useEffect(() => {
    let cancelled = false

    apiFetch('/price')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (data.price_per_kg !== undefined && data.price_per_kg !== null) setPrice(Number(data.price_per_kg))
        if (data.delivery_fee !== undefined && data.delivery_fee !== null) setDeliveryFeeHostel(Number(data.delivery_fee))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  // The student's own location type decides which delivery fee is actually
  // relevant to them — admins/employees just fall back to the on-campus rate
  // since they aren't placing personal orders.
  useEffect(() => {
    if (!token) return undefined
    let cancelled = false

    apiFetch('/user', { token })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.location_type) setLocationType(data.location_type)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) return null

  // Off-campus delivery is zone-based now (see DeliveryZoneSelect) — there's
  // no single flat fee to summarize here the way on-campus still has, so
  // this badge is on-campus only.
  const deliveryFee = locationType === 'hostel' ? deliveryFeeHostel : null

  return (
    <header className="sticky top-0 z-30 flex h-[52px] flex-shrink-0 items-center justify-between border-b border-slate-100 bg-white/85 px-4 backdrop-blur sm:px-6 md:px-10">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="eyebrow hidden sm:inline">{todayLabel()}</span>
        {price !== null ? (
          <span className="figure inline-flex items-center gap-1.5 rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-semibold text-brand-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" aria-hidden="true" />
            {formatNaira(price)} / kg
          </span>
        ) : (
          <span className="skeleton hidden h-6 w-24 sm:inline-block" />
        )}
        {deliveryFee !== null && (
          <span className="figure hidden items-center gap-1.5 rounded-full bg-brand-accent/15 px-3 py-1 text-xs font-semibold text-brand-accent sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" aria-hidden="true" />
            {formatNaira(deliveryFee)} delivery
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {!isAdmin && (
          <Link
            to="/cart"
            className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-navy"
            aria-label="Cart"
          >
            <ShoppingCart className="h-4.5 w-4.5" strokeWidth={1.8} />
            {cart.itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-ember px-1 text-[10px] font-bold text-white">
                {cart.itemCount}
              </span>
            )}
          </Link>
        )}
        <NotificationBell token={token} />
        <HeaderUserMenu role={role} onLogout={onLogout} />
      </div>
    </header>
  )
}

export default DashboardTopbar
