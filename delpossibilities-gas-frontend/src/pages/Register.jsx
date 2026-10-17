import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom'
import { User, Mail, Home, MapPin, Phone, ShieldCheck, ArrowLeft, Gift } from 'lucide-react'
import { apiFetch, resolveRole, resolvePermissions } from '../api'
import { takePostAuthRedirect } from '../authRedirect'
import PasswordInput from '../components/PasswordInput'
import AuthLayout, { AuthField } from '../components/auth/AuthLayout'
import HostelSelect from '../HostelSelect'
import LocationTypeToggle from '../components/LocationTypeToggle'

function Register({ setToken, setRole, setPermissions }) {
  const [step, setStep] = useState('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [locationType, setLocationType] = useState('hostel')
  const [hostel, setHostel] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [referredByCustomerId, setReferredByCustomerId] = useState('')
  // The referral field is optional, so it stays tucked away behind a link
  // for people registering directly. Someone arriving through a referral
  // link (?ref=...) sees it open and pre-filled instead.
  const [showReferral, setShowReferral] = useState(() => Boolean(new URLSearchParams(window.location.search).get('ref')))
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from
  const [searchParams] = useSearchParams()

  // Lets a shared referral link (see ReferralShareModal.jsx) land here with
  // the code already filled in — e.g. /register?ref=DEL-2026-0001. Stays
  // editable, just pre-filled.
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      setReferredByCustomerId(ref.trim())
      setShowReferral(true)
    }
  }, [searchParams])

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password !== passwordConfirmation) {
      setError('Password and confirm password do not match.')
      return
    }

    setSubmitting(true)

    try {
      const response = await apiFetch('/register', {
        method: 'POST',
        body: {
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
          location_type: locationType,
          hostel: locationType === 'hostel' ? hostel : address,
          phone,
          referred_by_customer_id: referredByCustomerId || undefined,
        },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.message || 'Registration failed. Check your details.')
        return
      }

      setOtp('')
      setStep('otp')
    } catch {
      setError('Check your internet connection.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await apiFetch('/register/verify', {
        method: 'POST',
        body: { email, otp },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'That code is invalid or has expired.')
        return
      }

      const role = await resolveRole(data.token, data)
      const permissions = await resolvePermissions(data.token, data)
      setToken(data.token)
      localStorage.setItem('token', data.token)
      localStorage.setItem('loginAt', String(Date.now()))
      setRole(role)
      localStorage.setItem('role', role || '')
      setPermissions(permissions)
      const stored = takePostAuthRedirect()
      navigate(role === 'admin' || role === 'super_admin' ? '/admin' : from || stored || '/home', { replace: true })
    } catch {
      setError('Check your internet connection.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setMessage('')
    setResending(true)

    try {
      const response = await apiFetch('/register/resend-otp', {
        method: 'POST',
        body: { email },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.message || 'Could not resend the code.')
        return
      }

      setMessage(data?.message || 'A new code has been sent to your email.')
    } catch {
      setError('Check your internet connection.')
    } finally {
      setResending(false)
    }
  }

  if (step === 'otp') {
    return (
      <AuthLayout
        title="Verify Your Email"
        description={`Enter the 6-digit code we sent to ${email}.`}
        onSubmit={handleVerify}
        success={message}
        error={error}
        footer={
          <button
            type="button"
            onClick={() => {
              setError('')
              setMessage('')
              setStep('form')
            }}
            className="inline-flex items-center gap-1.5 font-medium text-brand-teal hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Back to edit details
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

        <button type="submit" disabled={submitting || otp.length !== 6} className="btn-primary mt-2">
          {submitting ? 'Verifying…' : 'Verify & Create Account'}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="btn-outline"
        >
          {resending ? 'Resending…' : 'Resend Code'}
        </button>
      </AuthLayout>
    )
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
          <Link to="/login" state={from ? { from } : undefined} className="font-medium text-brand-teal hover:underline">
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

      <div>
        <label className="label-text">Where should we deliver?</label>
        <LocationTypeToggle value={locationType} onChange={setLocationType} className="mb-3" />

        {locationType === 'hostel' ? (
          <HostelSelect id="hostel" icon={Home} value={hostel} onChange={(e) => setHostel(e.target.value)} required />
        ) : (
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} aria-hidden="true" />
            <textarea
              id="address"
              placeholder="e.g. 12 Adeola Street, Yaba, Lagos"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              required
              className="input-field min-h-[4.5rem] resize-y pl-9"
            />
          </div>
        )}
      </div>

      <AuthField
        id="phone"
        label="Phone"
        icon={Phone}
        type="tel"
        inputMode="numeric"
        placeholder="080…"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
        autoComplete="tel"
        required
      />

      {showReferral ? (
        <AuthField
          id="referred-by"
          label="Referred by (Customer ID) — optional"
          icon={Gift}
          placeholder="DEL-2026-0001"
          value={referredByCustomerId}
          onChange={(e) => setReferredByCustomerId(e.target.value.trim())}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowReferral(true)}
          className="flex items-center gap-1.5 self-start text-sm font-medium text-brand-teal hover:underline"
        >
          <Gift className="h-4 w-4" strokeWidth={1.8} />
          Do you want to add a referral code?
        </button>
      )}

      <button type="submit" disabled={submitting} className="btn-primary mt-2">
        {submitting ? 'Sending code…' : 'Register'}
      </button>
    </AuthLayout>
  )
}

export default Register
