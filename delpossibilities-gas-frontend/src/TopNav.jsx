import { Link } from 'react-router-dom'
import logo from './assets/delpossibilitiesprofile.jpeg'

// Landing-page header. `token`/`isAdmin` come down from Landing so a visitor
// who's already signed in doesn't get pointless "Log In / Register" buttons
// — they get a single link back into the app instead. The brand mark always
// links to /home (this same page), matching every other header in the app.
function TopNav({ token, isAdmin }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/home" className="flex items-center gap-3">
          <img src={logo} alt="D'EL-Possibilities logo" className="h-9 w-9 rounded-full object-cover shadow-sm" />
          <span className="text-sm font-semibold text-brand-navy sm:text-base">D&apos;EL-POSSIBILITIES</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 lg:flex">
          <a href="#home" className="hover:text-brand-teal">Home</a>
          <a href="#services" className="hover:text-brand-teal">Our Services</a>
          <a href="#subscriptions" className="hover:text-brand-teal">Subscriptions</a>
          <a href="#about" className="hover:text-brand-teal">About Us</a>
          <a href="#contact" className="hover:text-brand-teal">Contact Us</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {token ? (
            <Link to={isAdmin ? '/admin' : '/'} className="btn-primary px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">
              {isAdmin ? 'Go to Dashboard' : 'Go to App'}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn-outline px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">
                Log In
              </Link>
              <Link to="/register" className="btn-primary px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default TopNav
