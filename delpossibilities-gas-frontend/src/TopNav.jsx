import { Link } from 'react-router-dom'
import logo from './assets/delpossibilitiesprofile.jpeg'

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="D'EL-Possibilities logo" className="h-9 w-9 rounded-full object-cover shadow-sm" />
          <span className="text-sm font-semibold text-brand-navy sm:text-base">D&apos;EL-POSSIBILITIES</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login" className="btn-outline px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">
            Log In
          </Link>
          <Link to="/register" className="btn-primary px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">
            Register
          </Link>
        </div>
      </div>
    </header>
  )
}

export default TopNav
