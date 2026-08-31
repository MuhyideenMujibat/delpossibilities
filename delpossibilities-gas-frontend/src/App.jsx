import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { SESSION_DURATION_MS } from './api'
import { peekPostAuthRedirect } from './authRedirect'
import { UserProvider } from './components/UserProvider'
import Sidebar from './Sidebar'
import DashboardTopbar from './DashboardTopbar'
import StudentHeader from './components/shell/StudentHeader'
import MobileTabBar from './components/shell/MobileTabBar'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import UploadCylinderImage from './pages/UploadCylinderImage'
import Home from './pages/Home'
import MyOrders from './pages/MyOrders'
import OrderDetail from './pages/OrderDetail'
import PaymentCallback from './pages/PaymentCallback'
import MySubscription from './pages/MySubscription'
import Cart from './pages/Cart'
import Shop from './pages/Shop'
import MyShopOrders from './pages/MyShopOrders'
import AdminPayments from './pages/AdminPayments'
import AdminReports from './pages/AdminReports'
import AdminFeedback from './pages/AdminFeedback'
import AdminStudentDetail from './pages/AdminStudentDetail'
import AdminInvestments from './pages/AdminInvestments'
import AdminOrdersHub from './pages/admin/AdminOrdersHub'
import AdminSubscriptionsHub from './pages/admin/AdminSubscriptionsHub'
import AdminPeopleHub from './pages/admin/AdminPeopleHub'
import AdminConfigurationHub from './pages/admin/AdminConfigurationHub'
import MyInvestments from './pages/MyInvestments'
import Profile from './pages/Profile'
import AdminProfile from './pages/AdminProfile'
import Landing from './pages/Landing'
import FeedbackWidget from './components/FeedbackWidget'

function readPermissions() {
  try {
    return JSON.parse(localStorage.getItem('permissions') || '[]')
  } catch {
    return []
  }
}

// Priority order for where an admin/employee lands after login — the first
// area they actually have permission for.
const HOME_PRIORITY = [
  ['manage_orders', '/admin'],
  ['manage_payments', '/admin/payments'],
  ['manage_reports', '/admin/reports'],
  ['manage_students', '/admin/people'],
  ['manage_settings', '/admin/configuration'],
]

// The /login and /register routes carry an "already signed in" guard. It can
// briefly render right after login — token is already set but the URL is
// still /login for one render, before the Login component's own navigate()
// commits — so it must resolve to the SAME destination Login would pick:
//   1. router state `from` (still on the URL at this point — "Log in to
//      invest" / "Log In to Order" both pass it), then
//   2. the persisted post-auth redirect (peeked, not consumed — Login's
//      handler does the actual clearing), then
//   3. the student home, or the admin home for staff.
function AuthedRedirect({ isAdmin, adminHome }) {
  const location = useLocation()
  if (isAdmin) return <Navigate to={adminHome} replace />
  return <Navigate to={location.state?.from || peekPostAuthRedirect() || '/'} replace />
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [role, setRole] = useState(() => localStorage.getItem('role'))
  const [permissions, setPermissionsState] = useState(readPermissions)

  const setPermissions = (next) => {
    setPermissionsState(next || [])
    localStorage.setItem('permissions', JSON.stringify(next || []))
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('permissions')
    localStorage.removeItem('loginAt')
    setToken(null)
    setRole(null)
    setPermissionsState([])
  }

  // Auto-logout 60 days after login — mirrors the backend's Sanctum token
  // expiration (config/sanctum.php) so the UI doesn't sit on stale state
  // waiting for the next API call to 401. Also catches the 401 directly, in
  // case the tab was open across the expiry and a request lands first.
  useEffect(() => {
    if (!token) return undefined

    const checkExpiry = () => {
      const loginAt = Number(localStorage.getItem('loginAt'))
      if (loginAt && Date.now() - loginAt >= SESSION_DURATION_MS) {
        handleLogout()
      }
    }

    checkExpiry()
    const intervalId = setInterval(checkExpiry, 60 * 1000)
    window.addEventListener('auth:unauthorized', handleLogout)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('auth:unauthorized', handleLogout)
    }
  }, [token])

  const isSuperAdmin = role === 'super_admin'
  const isAdmin = role === 'admin' || isSuperAdmin
  const can = (key) => isSuperAdmin || permissions.includes(key)

  const adminHome = HOME_PRIORITY.find(([key]) => can(key))?.[1] || '/admin/profile'
  // "/" is Home for everyone non-admin (guest or student) — CreateOrder is
  // guest-viewable now, login is only enforced at the final pay step.
  const homePath = isAdmin ? adminHome : '/'

  const adminRoute = (permissionKey, element) =>
    !token ? (
      <Navigate to="/login" />
    ) : !isAdmin ? (
      <Navigate to="/" />
    ) : !can(permissionKey) ? (
      <Navigate to={homePath} />
    ) : (
      element
    )

  const superAdminRoute = (element) =>
    !token ? <Navigate to="/login" /> : !isSuperAdmin ? <Navigate to={isAdmin ? homePath : '/'} /> : element

  return (
    <BrowserRouter>
      <UserProvider token={token}>
        <AppShell
          token={token}
          role={role}
          permissions={permissions}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          can={can}
          adminHome={adminHome}
          adminRoute={adminRoute}
          superAdminRoute={superAdminRoute}
          setToken={setToken}
          setRole={setRole}
          setPermissions={setPermissions}
          handleLogout={handleLogout}
        />
      </UserProvider>
    </BrowserRouter>
  )
}

// Split out so it can call useLocation() (needs to be inside BrowserRouter).
function AppShell({
  token,
  role,
  permissions,
  isAdmin,
  isSuperAdmin,
  can,
  adminHome,
  adminRoute,
  superAdminRoute,
  setToken,
  setRole,
  setPermissions,
  handleLogout,
}) {
  const location = useLocation()

  // Landing is a fully self-contained page — its own header and footer —
  // never meant to sit inside the app shell's chrome. Before this
  // restructure it worked "bare" for guests only because Sidebar and
  // DashboardTopbar both silently no-op'd without a token; StudentHeader
  // deliberately doesn't do that anymore (guests need it on Home/Shop), so
  // /home has to opt out of the shell explicitly instead.
  if (location.pathname === '/home') {
    return (
      <>
        <Landing token={token} isAdmin={isAdmin} />
        {!isAdmin && <FeedbackWidget token={token} />}
      </>
    )
  }

  return (
    <>
      {isAdmin ? (
        // Admin shell — unchanged from before this restructure. Sidebar and
        // DashboardTopbar are the real, untouched components; this branch is
        // only reachable once role is actually 'admin'/'super_admin'.
        <div className="flex min-h-screen flex-col bg-brand-bg md:flex-row">
          <Sidebar token={token} role={role} permissions={permissions} />
          <div className="flex min-w-0 flex-1 flex-col">
            <DashboardTopbar token={token} role={role} onLogout={handleLogout} />
            <main className="flex-1 p-4 sm:p-6 md:p-10">
              <Routes>
                {/* Consolidated hubs — each fuses several former sidebar
                    entries into one tabbed page. Every original admin page
                    is reused untouched inside a tab; per-tab permission
                    gating lives in the hub components. */}
                <Route
                  path="/admin"
                  element={adminRoute('manage_orders', <AdminOrdersHub token={token} can={can} />)}
                />
                <Route
                  path="/admin/subscriptions"
                  element={adminRoute('manage_subscriptions', <AdminSubscriptionsHub token={token} isSuperAdmin={isSuperAdmin} />)}
                />
                <Route
                  path="/admin/people"
                  element={adminRoute('manage_students', <AdminPeopleHub token={token} isSuperAdmin={isSuperAdmin} can={can} />)}
                />
                <Route
                  path="/admin/configuration"
                  element={adminRoute('manage_settings', <AdminConfigurationHub token={token} isSuperAdmin={isSuperAdmin} can={can} />)}
                />

                {/* Standalone pages that don't group with anything else. */}
                <Route path="/admin/payments" element={adminRoute('manage_payments', <AdminPayments token={token} />)} />
                <Route path="/admin/reports" element={adminRoute('manage_reports', <AdminReports token={token} />)} />
                <Route path="/admin/students/:id" element={adminRoute('manage_students', <AdminStudentDetail token={token} />)} />
                <Route path="/admin/investments" element={superAdminRoute(<AdminInvestments token={token} />)} />
                <Route path="/admin/feedback" element={superAdminRoute(<AdminFeedback token={token} />)} />
                <Route path="/admin/profile" element={<AdminProfile token={token} />} />

                {/* Bookmarked / linked old URLs → their new hub + tab. */}
                <Route path="/admin/shop-orders" element={<Navigate to="/admin?tab=shop-orders" replace />} />
                <Route path="/admin/subscribers" element={<Navigate to="/admin/subscriptions?tab=subscribers" replace />} />
                <Route path="/admin/refills" element={<Navigate to="/admin/subscriptions?tab=refills" replace />} />
                <Route path="/admin/subscription-plans" element={<Navigate to="/admin/subscriptions?tab=plans" replace />} />
                <Route path="/admin/students" element={<Navigate to="/admin/people?tab=students" replace />} />
                <Route path="/admin/users" element={<Navigate to="/admin/people?tab=add-user" replace />} />
                <Route path="/admin/staff" element={<Navigate to="/admin/people?tab=staff" replace />} />
                <Route path="/admin/user-types" element={<Navigate to="/admin/people?tab=user-types" replace />} />
                <Route path="/admin/permissions" element={<Navigate to="/admin/people?tab=permissions" replace />} />
                <Route path="/admin/settings" element={<Navigate to="/admin/configuration?tab=price" replace />} />
                <Route path="/admin/products" element={<Navigate to="/admin/configuration?tab=products" replace />} />
                <Route path="/admin/hostels" element={<Navigate to="/admin/configuration?tab=hostels" replace />} />
                <Route path="/admin/delivery-settings" element={<Navigate to="/admin/configuration?tab=delivery" replace />} />

                <Route path="*" element={<Navigate to={adminHome} />} />
              </Routes>
            </main>
          </div>
        </div>
      ) : (
        // Student/guest shell — top header (nav inline on desktop) + bottom
        // tab bar (mobile only). "/" and "/shop" are reachable without a
        // token; everything else keeps the same login gate as before.
        <div className="flex min-h-screen flex-col bg-brand-bg">
          <StudentHeader token={token} role={role} onLogout={handleLogout} />
          <main className="flex-1 p-4 pb-24 sm:p-6 md:p-10 md:pb-10">
            <Routes>
              <Route path="/" element={<Home token={token} />} />
              <Route path="/shop" element={<Shop token={token} />} />
              <Route
                path="/login"
                element={
                  token ? (
                    <AuthedRedirect isAdmin={isAdmin} adminHome={adminHome} />
                  ) : (
                    <Login setToken={setToken} setRole={setRole} setPermissions={setPermissions} />
                  )
                }
              />
              <Route
                path="/register"
                element={
                  token ? (
                    <AuthedRedirect isAdmin={isAdmin} adminHome={adminHome} />
                  ) : (
                    <Register setToken={setToken} setRole={setRole} setPermissions={setPermissions} />
                  )
                }
              />
              <Route path="/forgot-password" element={token ? <Navigate to="/" /> : <ForgotPassword />} />
              <Route path="/create-order" element={<Navigate to="/" replace />} />
              <Route path="/upload-cylinder-image" element={!token ? <Navigate to="/login" /> : <UploadCylinderImage token={token} />} />
              <Route path="/orders" element={!token ? <Navigate to="/login" /> : <MyOrders token={token} />} />
              <Route path="/orders/:id" element={!token ? <Navigate to="/login" /> : <OrderDetail token={token} />} />
              <Route path="/payment/callback" element={!token ? <Navigate to="/login" /> : <PaymentCallback token={token} />} />
              <Route path="/subscriptions" element={<Navigate to="/subscription" replace />} />
              <Route path="/subscription" element={<MySubscription token={token} />} />
              <Route path="/cart" element={<Cart token={token} />} />
              <Route path="/my-shop-orders" element={!token ? <Navigate to="/login" /> : <MyShopOrders token={token} />} />
              <Route path="/my-investments" element={<MyInvestments token={token} />} />
              <Route path="/profile" element={!token ? <Navigate to="/login" /> : <Profile token={token} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
          <MobileTabBar />
        </div>
      )}

      {!isAdmin && <FeedbackWidget token={token} />}
    </>
  )
}

export default App
