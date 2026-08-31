import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Check, Flame } from 'lucide-react'
import { apiFetch, formatNaira } from '../../api'
import Reveal, { RevealItem } from '../motion/Reveal'

const PACKAGE_TABS = [
  { value: 'session', label: 'Session Package' },
  { value: 'semester', label: 'Semester Package' },
]

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }

const TIER_STYLES = {
  bronze: { ring: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  silver: { ring: 'border-slate-300', badge: 'bg-slate-100 text-slate-600' },
  gold: { ring: 'border-brand-teal', badge: 'bg-brand-teal/10 text-brand-teal' },
}

function perksFor(plan) {
  const perks = ['Refill anytime, any amount — no delivery fee, ever']

  if (plan.foodstuff_pack_value) perks.push(`Free foodstuff pack worth ${formatNaira(plan.foodstuff_pack_value)}`)
  if (plan.has_souvenir) perks.push('Customised souvenir at session end')
  if (plan.has_publicity) perks.push('Online business publicity (once weekly)')
  perks.push('Price locked in for the whole duration')
  perks.push('Transferable customer ID')

  return perks
}

// Shared by the public landing page AND /subscription (MySubscription.jsx) —
// same fetch, same cards, same everything, just parameterized: the landing
// page mounts this with no props (every tier links to /register, nothing
// ever highlighted). MySubscription.jsx passes `activePlanId` (highlights
// the viewer's own tier instead of a Subscribe button) and `onSubscribe`
// (runs the real subscribe-and-pay flow instead of linking to /register,
// since that viewer may already be logged in).
function SubscriptionPreview({ activePlanId = null, onSubscribe = null, disableSubscribe = false, submittingPlanId = null, defaultPackageType = 'session' }) {
  const [packageType, setPackageType] = useState(defaultPackageType)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  // defaultPackageType often arrives async (MySubscription.jsx only knows
  // the viewer's own package type once their subscriber row has loaded) —
  // sync it once that happens, without fighting a manual tab click after.
  useEffect(() => {
    setPackageType(defaultPackageType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPackageType])

  useEffect(() => {
    let cancelled = false

    apiFetch('/subscription-plans')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setPlans(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [])

  const tierPlans = useMemo(
    () =>
      plans
        .filter((plan) => plan.package_type === packageType)
        .sort((a, b) => Number(a.price) - Number(b.price)),
    [plans, packageType]
  )

  if (!loading && plans.length === 0) return null

  return (
    <section id="subscriptions" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Subscriptions</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-brand-navy sm:text-4xl">Lock in a price for the whole session</h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Pay once for a session or semester, then refill anytime — no delivery fee, no re-checking prices, no repeat card payments.
          </p>
        </div>

        <div className="mx-auto mt-8 flex w-fit rounded-lg bg-brand-bg p-1" role="radiogroup" aria-label="Package type">
          {PACKAGE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="radio"
              aria-checked={packageType === tab.value}
              onClick={() => setPackageType(tab.value)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                packageType === tab.value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="skeleton mx-auto mt-10 h-64 max-w-5xl" />
        ) : (
          <Reveal
            as="div"
            className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            stagger
          >
            {tierPlans.map((plan) => {
              const style = TIER_STYLES[plan.tier] || TIER_STYLES.bronze
              const isOwn = activePlanId === plan.id
              return (
                <RevealItem
                  key={plan.id}
                  as="div"
                  className={`card flex flex-col border-2 ${isOwn ? 'border-brand-teal ring-2 ring-brand-teal/30' : style.ring}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`eyebrow inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] ${style.badge}`}>
                      {TIER_LABELS[plan.tier] || plan.tier}
                    </span>
                    {isOwn && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal px-2.5 py-1 text-[10px] font-bold text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                        Your Plan
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <Flame className="h-4 w-4 text-brand-ember" strokeWidth={2} />
                    <span className="figure text-sm font-medium text-slate-500">{Number(plan.cylinder_kg)} kg total allowance</span>
                  </div>
                  <p className="figure mt-2 font-heading text-3xl font-bold text-brand-navy">{formatNaira(plan.price)}</p>

                  <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-slate-600">
                    {perksFor(plan).map((perk) => (
                      <li key={perk} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" strokeWidth={2.5} />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  {isOwn ? (
                    <button type="button" disabled className="btn-primary mt-6 w-full bg-brand-teal !opacity-100 disabled:cursor-default">
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                      Active
                    </button>
                  ) : onSubscribe ? (
                    <button
                      type="button"
                      onClick={() => onSubscribe(plan)}
                      disabled={disableSubscribe}
                      className="btn-primary mt-6 w-full"
                    >
                      {submittingPlanId === plan.id ? 'Processing…' : 'Subscribe'}
                    </button>
                  ) : (
                    <Link to="/register" className="btn-primary mt-6 w-full">
                      Subscribe
                    </Link>
                  )}
                </RevealItem>
              )
            })}
          </Reveal>
        )}
      </div>
    </section>
  )
}

export default SubscriptionPreview
