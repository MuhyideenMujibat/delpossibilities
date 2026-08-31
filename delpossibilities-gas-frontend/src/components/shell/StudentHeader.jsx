import { useState, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { apiFetch, formatNaira } from '../../api'
import HeaderUserMenu from '../../HeaderUserMenu'
import NotificationBell from '../../NotificationBell'
import GuestUserMenu from './GuestUserMenu'
import { useCart } from '../../cartContext'
import { useCurrentUser } from '../../userContext'
import { STUDENT_NAV_TABS } from './studentNavTabs'
import logo from '../../assets/delpossibilitiesprofile.jpeg'

function todayLabel() {
  return new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}

// The student/guest counterpart to DashboardTopbar (which stays admin-only,
// untouched) — same persistent date/price/delivery-fee + cart/notifications/
// user-menu strip, plus an inline desktop nav row, and a guest-safe right
// cluster (DashboardTopbar hard-returns null without a token; this can't,
// since guests browsing Home/Shop still need the strip).
function StudentHeader({ token, role, onLogout }) {
  const [price, setPrice] = useState(null)
  const [deliveryFeeHostel, setDeliveryFeeHostel] = useState(null)
  const cart = useCart()
  const { user } = useCurrentUser()

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

  const locationType = user?.location_type || 'hostel'
  const deliveryFee = locationType === 'hostel' ? deliveryFeeHostel : null

  return (
    <header className="sticky top-0 z-30 flex-shrink-0 border-b border-slate-100 bg-white/85 backdrop-blur">
      <div className="flex h-[52px] items-center justify-between px-4 sm:px-6 md:px-10">
        <div className="flex items-center gap-3">
          <Link to="/home" className="flex items-center gap-2">
            <img src={logo} alt="D'EL-Possibilities logo" className="h-7 w-7 rounded-full object-cover" />
            <span className="hidden font-heading text-sm font-bold text-brand-navy lg:inline">D&apos;EL-POSSIBILITIES</span>
          </Link>
          <span className="eyebrow hidden sm:inline">{todayLabel()}</span>
          {price !== null ? (
            <span className="figure inline-flex items-center gap-1.5 rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-semibold text-brand-teal">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" aria-hidden="true" />
              {formatNaira(price)} / kg
            </span>
          ) : (
            <span className="skeleton hidden h-6 w-24 sm:inline-block" />
          )}
          {token && deliveryFee !== null && (
            <span className="figure hidden items-center gap-1.5 rounded-full bg-brand-accent/15 px-3 py-1 text-xs font-semibold text-brand-accent lg:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" aria-hidden="true" />
              {formatNaira(deliveryFee)} delivery
            </span>
          )}
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {STUDENT_NAV_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-teal/10 text-brand-teal' : 'text-slate-500 hover:bg-slate-100 hover:text-brand-navy'
                }`
              }
            >
              <tab.icon className="h-4 w-4" strokeWidth={1.8} />
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
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
          {token ? (
            <>
              <NotificationBell token={token} />
              <HeaderUserMenu role={role} onLogout={onLogout} />
            </>
          ) : (
            <GuestUserMenu />
          )}
        </div>
      </div>
    </header>
  )
}

export default StudentHeader
