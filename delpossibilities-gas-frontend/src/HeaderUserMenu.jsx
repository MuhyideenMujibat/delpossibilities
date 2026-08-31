import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, UserCircle, LogOut } from 'lucide-react'
import { useCurrentUser } from './userContext'
import ConfirmDialog from './components/ConfirmDialog'

function initialsOf(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase()
}

function HeaderUserMenu({ role, onLogout }) {
  const { user } = useCurrentUser()
  const name = user?.name || ''
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const profilePath = role === 'admin' || role === 'super_admin' ? '/admin/profile' : '/profile'

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-navy font-mono text-xs font-semibold text-white">
          {initialsOf(name)}
        </span>
        <span className="hidden text-sm font-medium text-slate-600 sm:inline">{name || '—'}</span>
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white py-1.5 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate(profilePath)
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50"
          >
            <UserCircle className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
            Profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setConfirmOpen(true)
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.8} />
            Log Out
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Log out?"
        message="You'll need to log in again to access your account."
        confirmLabel="Log Out"
        tone="danger"
        onConfirm={onLogout}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

export default HeaderUserMenu
