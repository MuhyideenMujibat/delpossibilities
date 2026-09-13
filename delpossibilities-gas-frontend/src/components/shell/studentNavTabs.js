import { Home, Package, CalendarCheck, ShoppingBag, TrendingUp, UserCircle } from 'lucide-react'

// Single source of truth for the student nav — both StudentHeader (desktop,
// inline links) and MobileTabBar (bottom icons) map over this same list, so
// the six destinations and their icons never drift apart between breakpoints.
export const STUDENT_NAV_TABS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/orders', label: 'Track', icon: Package },
  { to: '/subscription', label: 'Subscription', icon: CalendarCheck },
  { to: '/shop', label: 'Shop', icon: ShoppingBag },
  { to: '/my-investments', label: 'Investment', icon: TrendingUp },
  { to: '/profile', label: 'You', icon: UserCircle },
]
