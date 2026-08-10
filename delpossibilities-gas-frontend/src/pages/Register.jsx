import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { User, Mail, Home, Phone } from 'lucide-react'
import { apiFetch, resolveRole } from '../api'
import PasswordInput from '../components/PasswordInput'
import AuthLayout, { AuthField } from '../components/auth/AuthLayout'

function Register({ setToken, setRole }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [hostel, setHostel] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await apiFetch('/register', {
        method: 'POST',
        body: {
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
          hostel,
          phone,
        },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message || 'Registration failed. Check your details.')
        return
      }

      const data = await response.json()

      if (data.token) {
        const role = await resolveRole(data.token, data)
        setToken(data.token)
        localStorage.setItem('token', data.token)
        setRole(role)
        localStorage.setItem('role', role || '')
        navigate(role === 'admin' ? '/admin' : '/orders')
        return
      }

      const loginResponse = await apiFetch('/login', {
        method: 'POST',
        body: { email, password },
      })

      if (!loginResponse.ok) {
        setError('Registered successfully, but automatic login failed. Please log in.')
        navigate('/login')
        return
      }

      const loginData = await loginResponse.json()
      const role = await resolveRole(loginData.token, loginData)
      setToken(loginData.token)
      localStorage.setItem('token', loginData.token)
      setRole(role)
      localStorage.setItem('role', role || '')
      navigate(role === 'admin' ? '/admin' : '/orders')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create Your Account"
      maxWidth="md"
      onSubmit={handleRegister}
      error={error}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-teal hover:underline">
            Log In
          </Link>
        </>
      }
    >
      <AuthField
        id="name"
        label="Full Name"
        icon={User}
        placeholder="Jane Doe"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        required
      />

      <AuthField
        id="reg-email"
        label="Email"
        icon={Mail}
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label-text" htmlFor="reg-password">
            Password
          </label>
          <PasswordInput
            id="reg-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <label className="label-text" htmlFor="password-confirmation">
            Confirm Password
          </label>
          <PasswordInput
            id="password-confirmation"
            placeholder="••••••••"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AuthField
          id="hostel"
          label="Hostel"
          icon={Home}
          placeholder="Hostel A"
          value={hostel}
          onChange={(e) => setHostel(e.target.value)}
          autoComplete="address-line1"
          required
        />

        <AuthField
          id="phone"
          label="Phone"
          icon={Phone}
          type="tel"
          placeholder="080…"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          required
        />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary mt-2">
        {submitting ? 'Creating account…' : 'Register'}
      </button>
    </AuthLayout>
  )
}

export default Register
