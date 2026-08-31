import { NavLink } from 'react-router-dom'
import { STUDENT_NAV_TABS } from './studentNavTabs'

// Phone-app style bottom tab bar — mobile only (md:hidden), sticky to the
// bottom of the viewport regardless of scroll, with safe-area padding for
// devices with a home-indicator/notch. StudentHeader keeps the persistent
// top strip (price/fee/cart/notifications/user-menu) on every breakpoint;
// this bar is purely the six primary destinations.
function MobileTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-100 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {STUDENT_NAV_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
              isActive ? 'text-brand-teal' : 'text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
              {tab.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default MobileTabBar
