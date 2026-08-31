import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, ShieldCheck, ArrowLeft } from 'lucide-react'
import { apiFetch } from '../api'
import PasswordInput from '../components/PasswordInput'
import AuthLayout, { AuthField } from '../components/auth/AuthLayout'

function ForgotPassword() {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const navigate = useNavigate()

  const handleSendCode = async (e) => {
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
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'Could not send the code.')
        return
      }

      setOtp('')
      setStep('otp')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setMessage('')
    setResending(true)

    try {
      const response = await apiFetch('/forgot-password', {
        method: 'POST',
        body: { email },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'Could not resend the code.')
        return
      }

      setMessage('A new code has been sent to your email.')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setResending(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await apiFetch('/reset-password', {
        method: 'POST',
        body: {
          email,
          otp,
          password,
          password_confirmation: passwordConfirmation,
        },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'That code is invalid or has expired.')
        return
      }

      navigate('/login', { state: { message: data?.message || 'Your password has been reset. Please log in.' } })
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'otp') {
    return (
      <AuthLayout
        title="Reset Password"
        description={`Enter the 6-digit code we sent to ${email}, then choose a new password.`}
        onSubmit={handleReset}
        success={message}
        error={error}
        footer={
          <button
            type="button"
            onClick={() => {
              setError('')
              setMessage('')
              setStep('email')
            }}
            className="inline-flex items-center gap-1.5 font-medium text-brand-teal hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Back to edit email
          </button>
        }
      >
        <AuthField
          id="otp"
          label="Verification Code"
          icon={ShieldCheck}
          type="text"
          inputMode="numeric"
          placeholder="123456"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoComplete="one-time-code"
          required
        />

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

        <button type="submit" disabled={submitting || otp.length !== 6} className="btn-primary mt-2">
          {submitting ? 'Resetting…' : 'Reset Password'}
        </button>

        <button type="button" onClick={handleResend} disabled={resending} className="btn-outline">
          {resending ? 'Resending…' : 'Resend Code'}
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot Password"
      description="Enter your account email and we'll send you a 6-digit code to reset your password."
      onSubmit={handleSendCode}
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
        {submitting ? 'Sending…' : 'Send Code'}
      </button>
    </AuthLayout>
  )
}

export default ForgotPassword
