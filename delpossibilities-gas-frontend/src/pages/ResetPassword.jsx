import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { apiFetch } from '../api'
import PasswordInput from '../components/PasswordInput'
import AuthLayout, { AuthField } from '../components/auth/AuthLayout'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const email = searchParams.get('email') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await apiFetch('/reset-password', {
        method: 'POST',
        body: {
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
        },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.message || 'This reset link is invalid or has expired.')
        return
      }

      navigate('/login', { state: { message: data?.message || 'Your password has been reset. Please log in.' } })
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Reset Password"
      onSubmit={handleSubmit}
      error={error}
      footer={
        <>
          Back to{' '}
          <Link to="/login" className="font-medium text-brand-teal hover:underline">
            Log In
          </Link>
        </>
      }
    >
      <AuthField id="email" label="Email" icon={Mail} type="email" value={email} disabled />

      <div>
        <label className="label-text" htmlFor="password">
          New Password
        </label>
        <PasswordInput
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      <div>
        <label className="label-text" htmlFor="password-confirmation">
          Confirm New Password
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

      <button type="submit" disabled={submitting} className="btn-primary mt-2">
        {submitting ? 'Resetting…' : 'Reset Password'}
      </button>
    </AuthLayout>
  )
}

export default ResetPassword
