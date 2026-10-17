import { useState, useEffect, useRef } from 'react'
import { UserCircle, MapPin, Gift, Copy, Check, Crown, Gem, Wallet, Flame, BadgeCheck, Share2 } from 'lucide-react'
import { apiFetch, formatNaira } from '../api'
import { readCachedData, writeCachedData } from '../offlineCache'
import ConnectionError from '../components/ConnectionError'
import CylinderImageUpload from '../CylinderImageUpload'
import ChangePasswordForm from '../components/ChangePasswordForm'
import PageHeader from '../components/PageHeader'
import HostelSelect from '../HostelSelect'
import LocationTypeToggle from '../components/LocationTypeToggle'
import ReferralShareModal from '../components/ReferralShareModal'

// Mirrors User::TIER_VIP / TIER_VVIP (see AdminUsers.jsx's MEMBERSHIP_TIERS
// for the admin-side equivalent). 'none' renders nothing — most students
// have no tier.
const MEMBERSHIP_BADGES = {
  vip: {
    label: 'VIP Member',
    icon: Crown,
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    description: 'Free delivery on every order — gas refills, Eazy Market, and accessories.',
  },
  vvip: {
    label: 'VVIP Member',
    icon: Gem,
    className: 'border-violet-200 bg-violet-50 text-violet-700',
    description: 'Free delivery on everything, plus the gas cost itself is free on your gas orders. Shop goods are still paid for, just delivered free.',
  },
}

function Profile({ token }) {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [locationType, setLocationType] = useState('hostel')
  const [hostel, setHostel] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [cylinderImageUrl, setCylinderImageUrl] = useState(null)
  // A running PERCENT balance (not a coupon count — see
  // User::grantReferralReward), earned by referring students who qualify.
  // Can exceed 100% (e.g. two referrals at 70% each leaves 140%); an order
  // only ever spends up to 100 points of it, keeping the rest.
  const [referralPercentAvailable, setReferralPercentAvailable] = useState(0)
  // Flat cash commission balance, paid out by admin later — not spendable on
  // orders (see User::grantReferralCashCommission).
  const [referralCommissionBalance, setReferralCommissionBalance] = useState(0)
  // A kg credit, earned 3kg at a time whenever this account's referral
  // network hits the monthly ambassador milestone — spent automatically on
  // this account's own next gas order (see User::referral_free_kg_balance /
  // OrderController::referralFreeKgDiscount), same as loyalty's discount.
  const [referralFreeKgBalance, setReferralFreeKgBalance] = useState(0)
  const [isBrandAmbassador, setIsBrandAmbassador] = useState(false)
  // This calendar month's live standing toward that milestone (see
  // User::referralMonthlyProgress) — shown as a progress bar.
  const [referralMonthlyProgress, setReferralMonthlyProgress] = useState(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [customerId, setCustomerId] = useState(null)
  const [membershipTier, setMembershipTier] = useState('none')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  // Set once the person types anywhere on the page, so a slow refresh that
  // lands afterwards never overwrites what they're editing.
  const editedRef = useRef(false)
  const [offline, setOffline] = useState(false)

  const applyUser = (data, { includeForm }) => {
    if (includeForm) {
      const type = data.location_type || 'hostel'
      setEmail(data.email || '')
      setName(data.name || '')
      setLocationType(type)
      if (type === 'off_campus') setAddress(data.hostel || '')
      else setHostel(data.hostel || '')
      setPhone(data.phone || '')
    }
    setCylinderImageUrl(data.cylinder_image_url || null)
    setReferralPercentAvailable(Number(data.referral_discount_percent_available || 0))
    setReferralCommissionBalance(Number(data.referral_commission_balance || 0))
    setReferralFreeKgBalance(Number(data.referral_free_kg_balance || 0))
    setIsBrandAmbassador(Boolean(data.is_brand_ambassador))
    setReferralMonthlyProgress(data.referral_monthly_progress || null)
    // Every account carries a customer_id from signup now, so it comes
    // straight off /user — no separate subscription lookup needed.
    setCustomerId(data.customer_id || null)
    setMembershipTier(data.membership_tier || 'none')
  }

  const fetchUser = async () => {
    try {
      const response = await apiFetch('/user', { token })
      if (!response.ok) {
        setError('Could not load your profile.')
        return
      }

      const data = await response.json()
      writeCachedData('user', token, data)
      applyUser(data, { includeForm: !editedRef.current })
      setOffline(false)
      setError('')
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Show the last profile we saw straight away while fresh data loads.
    const cached = readCachedData('user', token)
    if (cached) {
      /* eslint-disable react-hooks/set-state-in-effect -- one-shot seed from
         the local cache on mount/token change, before the fetch below. */
      applyUser(cached, { includeForm: true })
      setLoading(false)
      /* eslint-enable react-hooks/set-state-in-effect */
    }

    fetchUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      writeCachedData('user', token, { ...(readCachedData('user', token) || {}), ...data })
      setMessage('Profile updated successfully!')
    } catch {
      setError('Check your internet connection.')
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

  // Nothing cached and the network is down: don't render an empty (and
  // saveable) form, just offer a retry.
  if (offline && !email) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Profile" subtitle="Manage your account details." icon={UserCircle} />
        <ConnectionError onRetry={fetchUser} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl" onInput={() => { editedRef.current = true }}>
      <PageHeader title="Profile" subtitle="Manage your account details." icon={UserCircle} />

      {offline && <ConnectionError onRetry={fetchUser} />}

      {MEMBERSHIP_BADGES[membershipTier] && (() => {
        const badge = MEMBERSHIP_BADGES[membershipTier]
        return (
          <div className={`mb-6 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${badge.className}`}>
            <badge.icon className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              <span className="font-semibold">{badge.label}</span> — {badge.description}
            </span>
          </div>
        )
      })()}

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

        {(customerId || referralPercentAvailable > 0) && (
          <div className="card lg:col-span-5">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-5 w-5 text-brand-teal" strokeWidth={1.8} />
              <h3 className="text-lg font-semibold text-brand-navy">Refer & Earn</h3>
            </div>

            {membershipTier === 'vvip' ? (
              <p className="text-sm text-slate-600">
                VVIP accounts can&apos;t refer other students — since every gas order is already free for you,
                there&apos;s no referral discount for you to earn or give.
              </p>
            ) : (
              <>
                {isBrandAmbassador && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} />
                    <span>
                      <span className="font-semibold">Official Brand Ambassador</span> — your ID card and executive
                      gift package will be issued by the team.
                    </span>
                  </div>
                )}

                {customerId && (
                  <div className="mb-4">
                    <p className="text-sm text-slate-600 mb-2">
                      Share your referral link with a new student. Once they register with it and pay for a gas
                      order, you earn cash commission — and once enough of your referrals have filled gas with
                      enough combined kg between them, you unlock free gas and Ambassador rewards too.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="input-field truncate font-mono text-sm bg-slate-50 sm:flex-1">{customerId}</code>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCopyCustomerId}
                          className="btn-outline flex-1 whitespace-nowrap sm:flex-none"
                        >
                          {copied ? (
                            <span className="flex items-center justify-center gap-1.5"><Check className="h-4 w-4" strokeWidth={2} /> Copied</span>
                          ) : (
                            <span className="flex items-center justify-center gap-1.5"><Copy className="h-4 w-4" strokeWidth={1.8} /> Copy</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShareModalOpen(true)}
                          className="btn-primary flex-1 whitespace-nowrap sm:flex-none"
                        >
                          <span className="flex items-center justify-center gap-1.5"><Share2 className="h-4 w-4" strokeWidth={1.8} /> Share & Earn</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {referralPercentAvailable > 0 && (
                  <p className="alert-success mb-2">
                    You have <strong>{referralPercentAvailable}% referral discount</strong> available (from before
                    this program changed). Up to 100% is applied to your next gas order automatically at checkout;
                    whatever isn&apos;t used stays on your account for later. It can also be applied to your
                    first-ever subscription, as long as that plan is ₦15,000 or less.
                  </p>
                )}

                <div className="mb-2 flex items-start gap-2.5 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                  <Wallet className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" strokeWidth={1.8} />
                  <span>
                    Cash commission earned so far: <strong>{formatNaira(referralCommissionBalance)}</strong>. Goes up
                    every time someone you referred pays for a gas order — not spendable on orders, the team pays it
                    out to you.
                  </span>
                </div>

                {referralFreeKgBalance > 0 && (
                  <p className="alert-success mb-2">
                    You have <strong>{referralFreeKgBalance}kg</strong> of free gas credit from your referrals — it's
                    applied automatically to your next gas order.
                  </p>
                )}

                {referralMonthlyProgress && (
                  <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
                    <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-brand-navy">
                      <Flame className="h-4 w-4 text-brand-teal" strokeWidth={1.8} />
                      Progress toward your next free 3kg
                    </div>
                    <p>
                      <strong>{referralMonthlyProgress.distinct_referred}</strong> / {referralMonthlyProgress.distinct_referred_target} friends
                      referred have filled gas so far · <strong>{referralMonthlyProgress.total_kg}kg</strong> / {referralMonthlyProgress.total_kg_target}kg combined.
                      Hit both and you get free 3kg plus, the first time, Ambassador status — any extra beyond
                      the targets carries straight into the next round.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {membershipTier !== 'vvip' && (
          <ReferralShareModal
            open={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            customerId={customerId}
          />
        )}
      </div>
    </div>
  )
}

export default Profile
