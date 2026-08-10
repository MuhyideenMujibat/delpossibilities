import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { apiFetch } from '../api'
import AuthLayout, { AuthField } from '../components/auth/AuthLayout'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    try {
      const response = await apiFetch('/forgot-password', {
        method: 'POST',
        body: { email },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.message || 'Could not send the reset link.')
        return
      }

      setMessage(data?.message || 'If an account exists for that email, a password reset link has been sent.')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Forgot Password"
      description="Enter your account email and we'll send you a link to reset your password."
      onSubmit={handleSubmit}
      success={message}
      error={error}
      footer={
        <>
          Remembered your password?{' '}
          <Link to="/login" className="font-medium text-brand-teal hover:underline">
            Log In
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

      <button type="submit" disabled={submitting} className="btn-primary mt-2">
        {submitting ? 'Sending…' : 'Send Reset Link'}
      </button>
    </AuthLayout>
  )
}

export default ForgotPassword
