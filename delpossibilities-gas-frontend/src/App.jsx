import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import UploadCylinderImage from './pages/UploadCylinderImage'
import CreateOrder from './pages/CreateOrder'
import MyOrders from './pages/MyOrders'
import AdminDashboard from './pages/AdminDashboard'
import AdminSettings from './pages/AdminSettings'
import Profile from './pages/Profile'
import AdminProfile from './pages/AdminProfile'
import Landing from './pages/Landing'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [role, setRole] = useState(() => localStorage.getItem('role'))

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setToken(null)
    setRole(null)
  }

  const isAdmin = role === 'admin'
  const homePath = isAdmin ? '/admin' : '/orders'

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-brand-bg md:flex-row">
        <Sidebar token={token} role={role} onLogout={handleLogout} />
        <main className="flex-1 p-4 sm:p-6 md:p-10">
          <Routes>
            <Route
              path="/"
              element={token ? <Navigate to={homePath} /> : <Landing />}
            />
            <Route
              path="/login"
              element={token ? <Navigate to={homePath} /> : <Login setToken={setToken} setRole={setRole} />}
            />
            <Route
              path="/register"
              element={token ? <Navigate to={homePath} /> : <Register setToken={setToken} setRole={setRole} />}
            />
            <Route
              path="/forgot-password"
              element={token ? <Navigate to={homePath} /> : <ForgotPassword />}
            />
            <Route
              path="/reset-password"
              element={token ? <Navigate to={homePath} /> : <ResetPassword />}
            />
            <Route
              path="/upload-cylinder-image"
              element={
                !token ? <Navigate to="/login" /> : isAdmin ? <Navigate to="/admin" /> : <UploadCylinderImage token={token} />
              }
            />
            <Route
              path="/create-order"
              element={
                !token ? <Navigate to="/login" /> : isAdmin ? <Navigate to="/admin" /> : <CreateOrder token={token} />
              }
            />
            <Route
              path="/orders"
              element={
                !token ? <Navigate to="/login" /> : isAdmin ? <Navigate to="/admin" /> : <MyOrders token={token} />
              }
            />
            <Route
              path="/profile"
              element={
                !token ? <Navigate to="/login" /> : isAdmin ? <Navigate to="/admin" /> : <Profile token={token} />
              }
            />
            <Route
              path="/admin"
              element={
                !token ? <Navigate to="/login" /> : !isAdmin ? <Navigate to="/orders" /> : <AdminDashboard token={token} />
              }
            />
            <Route
              path="/admin/settings"
              element={
                !token ? <Navigate to="/login" /> : !isAdmin ? <Navigate to="/orders" /> : <AdminSettings token={token} />
              }
            />
            <Route
              path="/admin/profile"
              element={
                !token ? <Navigate to="/login" /> : !isAdmin ? <Navigate to="/orders" /> : <AdminProfile token={token} />
              }
            />
            <Route path="*" element={<Navigate to={token ? homePath : '/login'} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
