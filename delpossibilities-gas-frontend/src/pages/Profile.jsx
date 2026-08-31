import { useState, useEffect } from 'react'
import { UserCircle, MapPin, Gift, Copy, Check } from 'lucide-react'
import { apiFetch } from '../api'
import CylinderImageUpload from '../CylinderImageUpload'
import ChangePasswordForm from '../components/ChangePasswordForm'
import PageHeader from '../components/PageHeader'
import HostelSelect from '../HostelSelect'
import LocationTypeToggle from '../components/LocationTypeToggle'

function Profile({ token }) {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [locationType, setLocationType] = useState('hostel')
  const [hostel, setHostel] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [cylinderImageUrl, setCylinderImageUrl] = useState(null)
  const [referralBalance, setReferralBalance] = useState(0)
  const [customerId, setCustomerId] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await apiFetch('/user', { token })
        if (!response.ok) {
          setError('Could not load your profile.')
          return
        }

        const data = await response.json()
        const type = data.location_type || 'hostel'
        setEmail(data.email || '')
        setName(data.name || '')
        setLocationType(type)
        if (type === 'off_campus') setAddress(data.hostel || '')
        else setHostel(data.hostel || '')
        setPhone(data.phone || '')
        setCylinderImageUrl(data.cylinder_image_url || null)
        setReferralBalance(Number(data.referral_credit_balance || 0))
      } catch {
        setError('Could not reach the server.')
      } finally {
        setLoading(false)
      }
    }

    const fetchSubscription = async () => {
      try {
        const response = await apiFetch('/my-subscription', { token })
        if (!response.ok) return
        const data = await response.json().catch(() => null)
        setCustomerId(data?.customer_id || null)
      } catch {
        // Non-essential — the referral card just won't show a Customer ID.
      }
    }

    fetchUser()
    fetchSubscription()
  }, [token])

  const handleCopyCustomerId = async () => {
    if (!customerId) return
    try {
      await navigator.clipboard.writeText(customerId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied — nothing to do, the ID is still visible to copy manually.
    }
  }

  const handleSubmit = async () => {
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const response = await apiFetch('/profile', {
        method: 'PATCH',
        token,
        body: {
          name,
          location_type: locationType,
          hostel: locationType === 'hostel' ? hostel : address,
          phone,
        },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message || 'Could not update your profile.')
        return
      }

      const data = await response.json()
      setName(data.name ?? name)
      setLocationType(data.location_type ?? locationType)
      if (locationType === 'off_campus') setAddress(data.hostel ?? address)
      else setHostel(data.hostel ?? hostel)
      setPhone(data.phone ?? phone)
      setMessage('Profile updated successfully!')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Profile" subtitle="Manage your account details." icon={UserCircle} />
        <div className="skeleton h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile" subtitle="Manage your account details." icon={UserCircle} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card mb-6 lg:col-span-3 lg:mb-0">
          <div className="flex flex-col gap-4">
            <div>
              <label className="label-text" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                disabled
                className="input-field bg-slate-50 text-slate-500"
              />
            </div>

            <div>
              <label className="label-text" htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="label-text">Delivery Location</label>
              <LocationTypeToggle value={locationType} onChange={setLocationType} className="mb-3" />

              {locationType === 'hostel' ? (
                <HostelSelect id="hostel" value={hostel} onChange={(e) => setHostel(e.target.value)} />
              ) : (
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} aria-hidden="true" />
                  <textarea
                    id="address"
                    placeholder="e.g. 12 Adeola Street, Yaba, Lagos"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    className="input-field min-h-[4.5rem] resize-y pl-9"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="label-text" htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
              />
            </div>

            <button onClick={handleSubmit} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

            {message && <p className="alert-success">{message}</p>}
            {error && <p className="alert-error">{error}</p>}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-brand-navy">Cylinder Image</h3>
          <CylinderImageUpload
            token={token}
            initialImageUrl={cylinderImageUrl}
            description="This image is used by default when you create an order."
            onUploaded={setCylinderImageUrl}
          />
        </div>

        <div className="card lg:col-span-3">
          <h3 className="mb-4 text-lg font-semibold text-brand-navy">Change Password</h3>
          <ChangePasswordForm token={token} />
        </div>

        {(customerId || referralBalance > 0) && (
          <div className="card lg:col-span-5">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-5 w-5 text-brand-teal" strokeWidth={1.8} />
              <h3 className="text-lg font-semibold text-brand-navy">Refer & Earn</h3>
            </div>

            {customerId && (
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">
                  Share your Customer ID with a new student. When they register with it and pay for
                  their first gas refill or subscription, you earn a delivery-fee credit automatically.
                </p>
                <div className="flex items-center gap-2">
                  <code className="input-field flex-1 font-mono text-sm bg-slate-50">{customerId}</code>
                  <button
                    type="button"
                    onClick={handleCopyCustomerId}
                    className="btn-outline whitespace-nowrap"
                  >
                    {copied ? (
                      <span className="flex items-center gap-1.5"><Check className="h-4 w-4" strokeWidth={2} /> Copied</span>
                    ) : (
                      <span className="flex items-center gap-1.5"><Copy className="h-4 w-4" strokeWidth={1.8} /> Copy</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {referralBalance > 0 && (
              <p className="alert-success">
                You have &#8358;{referralBalance.toLocaleString()} in referral credit — it's applied
                automatically as an option at checkout on your next gas refill or Eazy Market order.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile
