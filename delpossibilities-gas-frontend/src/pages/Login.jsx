import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { apiFetch, resolveRole, resolvePermissions } from '../api'
import { takePostAuthRedirect } from '../authRedirect'
import PasswordInput from '../components/PasswordInput'
import AuthLayout, { AuthField } from '../components/auth/AuthLayout'

function Login({ setToken, setRole, setPermissions }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const successMessage = location.state?.message
  const from = location.state?.from

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await apiFetch('/login', {
        method: 'POST',
        body: { email, password },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message || 'Login failed. Check your email and password.')
        return
      }

      const data = await response.json()
      const role = await resolveRole(data.token, data)
      const permissions = await resolvePermissions(data.token, data)

      setToken(data.token)
      localStorage.setItem('token', data.token)
      localStorage.setItem('loginAt', String(Date.now()))
      setRole(role)
      localStorage.setItem('role', role || '')
      setPermissions(permissions)
      // `from` (router state) wins when present; otherwise fall back to the
      // persisted redirect set by whoever sent us here ("Log in to invest",
      // "Log In to Order", …), then to Home ("/home", the order form).
      const stored = takePostAuthRedirect()
      navigate(role === 'admin' || role === 'super_admin' ? '/admin' : from || stored || '/home', { replace: true })
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Log In"
      maxWidth="md"
      onSubmit={handleLogin}
      success={successMessage}
      error={error}
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" state={from ? { from } : undefined} className="font-medium text-brand-teal hover:underline">
            Register
          </Link>
        </>
      }
    >
      <AuthField
        id="email"
        label="Email"
        icon={Mail}
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />

      <div>
        <div className="flex items-center justify-between">
          <label className="label-text" htmlFor="password">
            Password
          </label>
          <Link to="/forgot-password" className="text-xs font-medium text-brand-teal hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary mt-2">
        {submitting ? 'Logging in…' : 'Log In'}
      </button>
    </AuthLayout>
  )
}

export default Login
