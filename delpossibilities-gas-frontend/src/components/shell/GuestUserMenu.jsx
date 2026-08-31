import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, UserCircle, LogIn, UserPlus } from 'lucide-react'

// Occupies the same visual slot as HeaderUserMenu, so the header's right
// cluster doesn't jump around between guest and logged-in states — just a
// generic avatar (no initials to show yet) with Log In / Register instead of
// Profile / Log Out.
function GuestUserMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
          <UserCircle className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <span className="hidden text-sm font-medium text-slate-600 sm:inline">Guest</span>
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white py-1.5 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/login')
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogIn className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
            Log In
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/register')
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-brand-teal hover:bg-brand-teal/5"
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.8} />
            Register
          </button>
        </div>
      )}
    </div>
  )
}

export default GuestUserMenu
