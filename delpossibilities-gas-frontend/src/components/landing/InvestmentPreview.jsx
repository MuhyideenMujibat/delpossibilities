import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, ShieldCheck, CalendarRange, MessageCircle, Landmark, Copy, Check } from 'lucide-react'
import { apiFetch, formatNaira, whatsappUrl } from '../../api'
import { setPostAuthRedirect } from '../../authRedirect'
import Reveal from '../motion/Reveal'

const HIGHLIGHTS = [
  { icon: TrendingUp, title: 'Fixed Monthly Returns', description: 'Earn a steady, fixed percentage straight to your account every month.' },
  { icon: ShieldCheck, title: '100% Asset-Backed', description: "Your capital is directly backed by our physical gas inventory and delivery equipment." },
  { icon: CalendarRange, title: 'Flexible Tenures', description: 'Choose a term that fits your semester or session, from a minimum amount that works for you.' },
]

const FALLBACK_TENURES = [6, 12]

// Where a logged-out visitor who entered numbers here is sent to log in, and
// where the values they typed are stashed so they're waiting when the visitor
// comes back signed in (see the restore step in the /price effect below).
const PENDING_DRAFT_KEY = 'pendingInvestmentDraft'
const RETURN_TO = '/my-investments'

function readPendingDraft() {
  try {
    const raw = sessionStorage.getItem(PENDING_DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// The single investment section for the whole app: an advert-style calculator
// on the public landing page AND the real application form on /my-investments.
// It always lets a visitor work out real numbers for their own capital; the
// submit button then adapts to who's looking:
//   - no `token` (logged-out landing visitor) -> "Log in to invest", which
//     stashes the entered capital/tenure and routes to /login so they can pick
//     up where they left off.
//   - with `token` -> "Apply to Invest", a real POST /investments; `onCreated`
//     receives the created record so a caller (MyInvestments) can prepend it to
//     its list.
// Investing is still finished off-platform — transfer the capital by bank app
// using the details below, an admin confirms it, then a contract appears to
// sign. Every number here (rate, minimum, tenures, bank details, WhatsApp
// number) comes from Setting via the same /price payload used for public
// pricing — never hardcoded, so an admin edit shows up immediately.
function InvestmentPreview({ token, onCreated }) {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [capitalInput, setCapitalInput] = useState('')
  const [tenureMonths, setTenureMonths] = useState(null)
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false

    apiFetch('/price')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return

        const tenures = Array.isArray(data.investment_tenures_months) && data.investment_tenures_months.length > 0
          ? data.investment_tenures_months
          : FALLBACK_TENURES
        const minimumAmount = Number(data.investment_minimum_amount ?? 50000)

        setSettings({
          ratePercent: Number(data.investment_monthly_rate_percent ?? 2.5),
          minimumAmount,
          tenures,
          whatsappNumber: data.investment_whatsapp_number || null,
          bankDetails: data.investment_bank_name && data.investment_account_number
            ? {
                bankName: data.investment_bank_name,
                accountName: data.investment_account_name,
                accountNumber: data.investment_account_number,
              }
            : null,
        })

        // Restore what a visitor typed before being sent to log in, if any —
        // otherwise fall back to the sensible defaults.
        const pending = readPendingDraft()
        if (pending) {
          try { sessionStorage.removeItem(PENDING_DRAFT_KEY) } catch { /* ignore */ }
        }
        const pendingTenure = pending?.tenure != null ? Number(pending.tenure) : null
        setTenureMonths(pendingTenure && tenures.includes(pendingTenure) ? pendingTenure : tenures[0])
        setCapitalInput(
          pending?.capital != null && pending.capital !== '' ? String(pending.capital) : String(minimumAmount)
        )
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [])

  const capitalValue = Number(capitalInput)
  const capitalValid = capitalInput !== '' && !Number.isNaN(capitalValue) && capitalValue >= (settings?.minimumAmount ?? 0)

  const { monthlyReturn, totalPayout } = useMemo(() => {
    if (!settings || !capitalValid || !tenureMonths) return { monthlyReturn: null, totalPayout: null }
    const monthly = capitalValue * (settings.ratePercent / 100)
    return { monthlyReturn: monthly, totalPayout: capitalValue + monthly * tenureMonths }
  }, [settings, capitalValid, capitalValue, tenureMonths])

  const handleCopyAccountNumber = async () => {
    if (!settings?.bankDetails?.accountNumber) return
    try {
      await navigator.clipboard.writeText(settings.bankDetails.accountNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied — the number is still visible to copy manually.
    }
  }

  // Logged-out: keep the entered numbers and go log in. They land back on
  // /my-investments where this same component restores them.
  const goLoginToInvest = () => {
    try {
      sessionStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify({ capital: capitalInput, tenure: tenureMonths }))
    } catch {
      // Storage full/unavailable — worst case they re-enter the numbers.
    }
    // Both the router state AND the persisted redirect — see authRedirect.js
    // for why the second one is needed to actually land back here.
    setPostAuthRedirect(RETURN_TO)
    navigate('/login', { state: { from: RETURN_TO } })
  }

  // Logged-in: the real application — same request shape the old
  // NewInvestmentForm used.
  const handleApply = async () => {
    if (submitting || !capitalValid || !tenureMonths) return

    setSubmitError('')
    setSubmitted(false)
    setSubmitting(true)

    try {
      const response = await apiFetch('/investments', {
        method: 'POST',
        token,
        body: { capital_amount: capitalInput, tenure_months: tenureMonths },
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setSubmitError(firstError || data?.message || 'Could not register this investment.')
        return
      }

      setSubmitted(true)
      onCreated?.(data)
    } catch {
      setSubmitError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  const whatsappMessage = settings && capitalValid && tenureMonths
    ? `Hi, I'd like to invest ${formatNaira(capitalValue)} for ${tenureMonths} months (${formatNaira(monthlyReturn)}/month, ${formatNaira(totalPayout)} total at maturity).`
    : "Hi, I'd like to know more about your investment plan."
  const whatsappLink = settings?.whatsappNumber
    ? whatsappUrl(settings.whatsappNumber, whatsappMessage)
    : 'https://wa.me/2348103217371'

  if (!loading && !settings) return null

  return (
    <section id="invest" className="bg-brand-bg">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        {/* The dark navy panel — inset from the page edges with a generous
            radius, a soft outer shadow and a teal glow, so it reads as a
            distinct card rather than a full-width band. */}
        <div className="relative overflow-hidden rounded-3xl bg-brand-navy px-5 py-12 shadow-2xl shadow-brand-navy/25 ring-1 ring-white/10 sm:rounded-[2.5rem] sm:px-10 sm:py-16">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-teal/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-brand-teal/10 blur-3xl" aria-hidden="true" />

          <div className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-brand-teal">Invest with us</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl">Grow your money with D&apos;EL-Possibilities</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            We also run an investment plan for people who want their money working, backed by real gas inventory and
            delivery equipment — not just a promise on paper.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/5">
              <Icon className="h-5 w-5 text-brand-teal" strokeWidth={1.8} />
              <p className="mt-3 font-semibold text-white">{title}</p>
              <p className="mt-1 text-sm text-white/60">{description}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="skeleton mx-auto mt-10 h-80 max-w-2xl bg-white/5" />
        ) : (
          <Reveal as="div" className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <p className="eyebrow text-brand-teal">Calculate your returns</p>
            <p className="mt-1 text-sm text-white/60">
              {rtrim(settings.ratePercent)}% fixed monthly return, minimum {formatNaira(settings.minimumAmount)}.
            </p>

            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="invest-capital">
                Capital amount
              </label>
              <input
                id="invest-capital"
                type="number"
                min={settings.minimumAmount}
                step="1000"
                value={capitalInput}
                onChange={(e) => { setCapitalInput(e.target.value); setSubmitted(false); setSubmitError('') }}
                className="w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-lg font-semibold text-white placeholder-white/30 focus:border-brand-teal focus:outline-none"
              />
              {!capitalValid && capitalInput !== '' && (
                <p className="mt-1.5 text-xs text-brand-ember">
                  Minimum investment is {formatNaira(settings.minimumAmount)}.
                </p>
              )}
            </div>

            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">Tenure</span>
              <div className="flex flex-wrap gap-2">
                {settings.tenures.map((months) => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => { setTenureMonths(months); setSubmitted(false); setSubmitError('') }}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition-colors ${
                      tenureMonths === months
                        ? 'border-brand-teal bg-brand-teal/15 text-brand-teal'
                        : 'border-white/15 text-white/70 hover:border-white/30'
                    }`}
                  >
                    {months} Months
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-white/10 p-4">
              <div>
                <p className="text-xs text-white/50">Monthly payout</p>
                <p className="figure mt-1 text-xl font-bold text-brand-teal">
                  {monthlyReturn !== null ? formatNaira(monthlyReturn) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50">Total at maturity</p>
                <p className="figure mt-1 text-xl font-bold text-white">
                  {totalPayout !== null ? formatNaira(totalPayout) : '—'}
                </p>
              </div>
            </div>
            {totalPayout !== null && (
              <p className="mt-3 text-xs text-white/50">
                Includes your {formatNaira(capitalValue)} capital back in full at the end of the {tenureMonths}-month term,
                on top of the monthly payouts already received.
              </p>
            )}

            <button
              type="button"
              onClick={token ? handleApply : goLoginToInvest}
              disabled={token ? (submitting || !capitalValid || !tenureMonths) : false}
              className="btn-primary mt-6 w-full justify-center bg-brand-teal px-6 py-3 text-sm hover:bg-brand-teal/90 disabled:opacity-60"
            >
              {token ? (submitting ? 'Submitting…' : 'Apply to Invest') : 'Log in to invest'}
            </button>

            {submitError && <p className="alert-error mt-3">{submitError}</p>}
            {submitted && (
              <p className="mt-3 rounded-lg bg-brand-teal/15 px-3.5 py-2.5 text-sm text-brand-teal">
                Application received. Transfer your capital using the details below — we&apos;ll confirm it and a
                contract will appear on this page for you to sign.
              </p>
            )}
          </Reveal>
        )}

        {!loading && settings && (
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl bg-white/5 p-6 text-center ring-1 ring-white/5">
            <p className="text-sm text-white/70">
              No in-app payment for this one — meet us physically to discuss and pay, or reach us on WhatsApp to get
              started. Once your transfer is confirmed on our side, we generate a contract for you to sign.
            </p>

            {token && settings.bankDetails && (
              <div className="mx-auto mt-5 flex max-w-sm items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-3 text-left">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Landmark className="h-4 w-4 flex-shrink-0 text-brand-teal" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-white/50">{settings.bankDetails.bankName} · {settings.bankDetails.accountName}</p>
                    <p className="figure font-semibold text-white">{settings.bankDetails.accountNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAccountNumber}
                  aria-label="Copy account number"
                  className="flex-shrink-0 rounded-md p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.8} />}
                </button>
              </div>
            )}

            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-6 inline-flex bg-brand-teal px-6 py-3 text-sm hover:bg-brand-teal/90"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
              Message us on WhatsApp
            </a>
          </div>
        )}
          </div>
        </div>
      </div>
    </section>
  )
}

// Trims a trailing ".00"/".50" etc. down to the shortest readable form (2.5,
// not 2.50; 3, not 3.00) — mirrors the trim already used for plan percentages
// elsewhere in this app.
function rtrim(percent) {
  return Number(percent).toFixed(2).replace(/\.?0+$/, '')
}

export default InvestmentPreview
