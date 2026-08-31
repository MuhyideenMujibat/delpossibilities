import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Package,
  PlusCircle,
  ImagePlus,
  LayoutDashboard,
  SlidersHorizontal,
  BarChart3,
  Wallet,
  Users,
  Menu,
  X,
  CalendarCheck,
  MessageSquareText,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'
import logo from './assets/delpossibilitiesprofile.jpeg'

// Browsing/subscribing to a plan now happens on the public landing page
// (see SubscriptionPreview) — "My Subscription" only belongs in the
// dashboard once someone has actually subscribed, gated below via
// `requiresSubscription`.
const STUDENT_LINKS = [
  { to: '/orders', label: 'My Orders', icon: Package },
  { to: '/create-order', label: 'Create Order', icon: PlusCircle },
  { to: '/cart', label: 'My Cart', icon: ShoppingCart },
  { to: '/my-shop-orders', label: 'My Shop Orders', icon: ShoppingBag },
  { to: '/subscription', label: 'My Subscription', icon: CalendarCheck, requiresSubscription: true },
  { to: '/my-investments', label: 'My Investments', icon: TrendingUp },
  { to: '/upload-cylinder-image', label: 'Cylinder Image', icon: ImagePlus },
]

// Related admin pages are now fused into tabbed hubs so this list stays
// short (see src/pages/admin/*Hub.jsx). `permission` gates a hub for
// regular admins/employees (super admins always see everything);
// `superAdminOnly` hides it entirely unless the account is the super admin.
// A hub only shows tabs the admin is actually allowed to see, so e.g. an
// admin with just `manage_settings` opens "Configuration" straight onto
// its lone Price Settings tab.
const ADMIN_LINKS = [
  { to: '/admin', label: 'Orders', icon: LayoutDashboard, permission: 'manage_orders' },
  { to: '/admin/payments', label: 'Payments', icon: Wallet, permission: 'manage_payments' },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CalendarCheck, permission: 'manage_subscriptions' },
  { to: '/admin/people', label: 'People', icon: Users, permission: 'manage_students' },
  { to: '/admin/configuration', label: 'Configuration', icon: SlidersHorizontal, permission: 'manage_settings' },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3, permission: 'manage_reports' },
  { to: '/admin/investments', label: 'Investments', icon: TrendingUp, superAdminOnly: true },
  { to: '/admin/feedback', label: 'Suggestions & Reviews', icon: MessageSquareText, superAdminOnly: true },
]

// The brand mark links to /home (the public landing page) from every
// header in the app — logged in or out, admin or student.
function BrandMark({ compact }) {
  if (compact) {
    return (
      <Link to="/home" className="flex min-w-0 items-center gap-3 px-4 py-3">
        <img src={logo} alt="D'EL-Possibilities logo" className="h-8 w-8 rounded-full object-cover" />
        <span className="truncate font-heading text-sm font-bold text-white">D&apos;EL-POSSIBILITIES</span>
      </Link>
    )
  }

  return (
    <Link to="/home" className="block min-w-0 px-5 pb-6 pt-7">
      <div className="flex min-w-0 items-center gap-2.5">
        <img src={logo} alt="D'EL-Possibilities logo" className="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-2 ring-white/15" />
        <p className="min-w-0 truncate font-heading text-sm font-black uppercase tracking-tight text-white">D&apos;EL-Possibilities</p>
      </div>
    </Link>
  )
}

// Nav items sit on a vertical "pipeline" — a literal line running through
// each stop, echoing the gas-line delivery route rather than a generic list
// of pill buttons. The active stop gets a shared-layout glow that glides
// between items on navigation (via framer-motion's layoutId).
function PipelineNav({ links, onNavigate }) {
  return (
    // min-h-0 is load-bearing here: without it a flex child won't shrink
    // below its content size, so overflow-y-auto never kicks in and the
    // ancestor's overflow-hidden just clips whatever doesn't fit instead of
    // scrolling to it — which is exactly how links past Staff went missing
    // once the nav list grew past one screen.
    <nav className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-4">
      <ul className="flex flex-col gap-1">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <li key={link.to} className="min-w-0">
              <NavLink
                to={link.to}
                end
                onClick={onNavigate}
                className="group relative flex min-w-0 items-center gap-4 rounded-xl px-1 py-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
              >
                {({ isActive }) => (
                  <>
                    <span className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center">
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-nav-glow"
                          className="absolute inset-0 rounded-lg bg-white/10"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <span
                        className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                          isActive ? 'bg-brand-teal text-white' : 'bg-white/5 text-white/55 group-hover:bg-white/10 group-hover:text-white'
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                      </span>
                    </span>
                    <span className={`min-w-0 truncate text-sm font-semibold transition-colors ${isActive ? 'text-white' : 'text-white/55 group-hover:text-white/85'}`}>
                      {link.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function SidebarContent({ links, onNavigate }) {
  return (
    <div className="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-brand-navy">
      <BrandMark />
      <PipelineNav links={links} onNavigate={onNavigate} />
    </div>
  )
}

function Sidebar({ token, role, permissions = [], hasSubscription = false }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!token) return null

  const isAdminRole = role === 'admin' || role === 'super_admin'
  const isSuperAdmin = role === 'super_admin'

  const links = isAdminRole
    ? ADMIN_LINKS.filter((link) => {
        if (link.superAdminOnly) return isSuperAdmin
        if (link.permission) return isSuperAdmin || permissions.includes(link.permission)
        return true
      })
    : STUDENT_LINKS.filter((link) => !link.requiresSubscription || hasSubscription)

  return (
    <>
      <div className="flex items-center justify-between bg-brand-navy px-4 py-3 md:hidden">
        <BrandMark compact />
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <Menu className="h-6 w-6" strokeWidth={1.8} />
        </button>
      </div>

      <aside className="hidden overflow-hidden md:sticky md:top-0 md:flex md:h-screen md:w-64 md:min-w-64 md:flex-shrink-0">
        <SidebarContent links={links} />
      </aside>

      <div className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] transform overflow-hidden shadow-xl transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <SidebarContent links={links} onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>
    </>
  )
}

export default Sidebar
