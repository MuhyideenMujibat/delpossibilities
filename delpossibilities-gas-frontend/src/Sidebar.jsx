import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import logo from './assets/delpossibilitiesprofile.jpeg'

const STUDENT_LINKS = [
  { to: '/orders', label: 'My Orders' },
  { to: '/create-order', label: 'Create Order' },
  { to: '/upload-cylinder-image', label: 'Upload Cylinder Image' },
  { to: '/profile', label: 'Profile' },
]

const ADMIN_LINKS = [
  { to: '/admin', label: 'Admin Dashboard' },
  { to: '/admin/settings', label: 'Price Settings' },
  { to: '/admin/profile', label: 'Profile' },
]

function BrandMark({ compact }) {
  return (
    <div className="flex items-center gap-3 px-5 py-6">
      <img
        src={logo}
        alt="D'EL-Possibilities logo"
        className={compact ? 'h-8 w-8 rounded-full object-cover' : 'h-11 w-11 rounded-full object-cover ring-2 ring-white/20'}
      />
      <span className={compact ? 'text-sm font-semibold text-white' : 'text-base font-semibold leading-tight text-white'}>
        D&apos;EL-POSSIBILITIES
      </span>
    </div>
  )
}

function SidebarLinks({ links, onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            `rounded-r-lg border-l-4 px-4 py-3 text-sm font-medium transition-colors ${
              isActive
                ? 'border-brand-accent bg-white/10 text-white'
                : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarContent({ links, onLogout, onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-brand-navy">
      <BrandMark />
      <SidebarLinks links={links} onNavigate={onNavigate} />
      <div className="border-t border-white/10 p-4">
        <button onClick={onLogout} className="w-full rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:border-white/40 hover:bg-white/5 hover:text-white">
          Log Out
        </button>
      </div>
    </div>
  )
}

function Sidebar({ token, role, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!token) return null

  const links = role === 'admin' ? ADMIN_LINKS : STUDENT_LINKS

  return (
    <>
      <div className="flex items-center justify-between bg-brand-navy px-4 py-3 md:hidden">
        <BrandMark compact />
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <aside className="hidden md:flex md:w-64 md:flex-shrink-0">
        <SidebarContent links={links} onLogout={onLogout} />
      </aside>

      <div className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[80%] transform shadow-xl transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <SidebarContent links={links} onLogout={onLogout} onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>
    </>
  )
}

export default Sidebar
