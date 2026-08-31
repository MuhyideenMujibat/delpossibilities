import { useState, useEffect } from 'react'
import { TrendingUp, FileSignature, Download, MessageCircle, PenLine } from 'lucide-react'
import { apiFetch, formatNaira, formatDate } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../toastContext'
import InvestmentPreview from '../components/landing/InvestmentPreview'

const STATUS_LABELS = {
  pending: 'Awaiting your transfer',
  payment_confirmed: 'Payment confirmed — ready to sign',
  signed: 'Signed',
  cancelled: 'Cancelled',
}

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  payment_confirmed: 'bg-brand-teal/10 text-brand-teal',
  signed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-500'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function SignModal({ investment, token, onClose, onSigned }) {
  const [signatureName, setSignatureName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { show } = useToast()

  const handleSign = async () => {
    if (!signatureName.trim()) {
      setError('Please type your full name to sign.')
      return
    }

    setError('')
    setSaving(true)

    try {
      const response = await apiFetch(`/investments/${investment.id}/sign`, {
        method: 'POST',
        token,
        body: { signature_name: signatureName },
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.message || 'Could not sign this contract.')
        return
      }

      show('Contract signed successfully.', { type: 'success' })
      onSigned(data)
      onClose()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ConfirmDialog
      open
      title="Sign your investment contract"
      message={
        <span>
          Type your full name below as your signature for the {formatNaira(investment.capital_amount)},
          {' '}{investment.tenure_months}-month investment contract. This confirms you agree to the terms in the contract PDF.
          <input
            type="text"
            placeholder="Your full name"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            className="input-field mt-3"
            autoFocus
          />
          {error && <span className="alert-error mt-2 block">{error}</span>}
        </span>
      }
      confirmLabel={saving ? 'Signing…' : 'Sign Contract'}
      busy={saving}
      onConfirm={handleSign}
      onCancel={onClose}
    />
  )
}

function InvestmentCard({ investment, token, onSigned }) {
  const [signing, setSigning] = useState(false)

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-heading text-base font-bold text-brand-navy">{formatNaira(investment.capital_amount)}</p>
          <p className="figure mt-0.5 text-sm text-slate-500">
            {investment.tenure_months} month term · {formatNaira(investment.monthly_return)}/mo · {formatNaira(investment.total_payout)} at maturity
          </p>
        </div>
        <StatusBadge status={investment.status} />
      </div>

      <div className="mt-4 flex flex-col gap-1.5 text-xs text-slate-400">
        <span>Registered {formatDate(investment.created_at)}</span>
        {investment.payment_confirmed_at && <span>Payment confirmed {formatDate(investment.payment_confirmed_at)}</span>}
        {investment.signed_at && <span>Signed {formatDate(investment.signed_at)}</span>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {investment.status === 'pending' && (
          <a
            href="https://wa.me/2348103217371"
            target="_blank"
            rel="noreferrer"
            className="btn-outline"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
            Message us to arrange payment
          </a>
        )}

        {investment.status === 'payment_confirmed' && (
          <button type="button" onClick={() => setSigning(true)} className="btn-primary">
            <PenLine className="h-4 w-4" strokeWidth={2} />
            Sign Contract
          </button>
        )}

        {investment.contract_url && (
          <a href={investment.contract_url} target="_blank" rel="noreferrer" className="btn-outline">
            <Download className="h-4 w-4" strokeWidth={1.8} />
            {investment.status === 'signed' ? 'Download Signed Contract' : 'View Contract'}
          </a>
        )}
      </div>

      {signing && (
        <SignModal
          investment={investment}
          token={token}
          onClose={() => setSigning(false)}
          onSigned={onSigned}
        />
      )}
    </div>
  )
}

function MyInvestments({ token }) {
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = token
      ? apiFetch('/my-investments', { token }).then((res) => (res.ok ? res.json() : []))
      : Promise.resolve([])

    load
      .then((data) => setInvestments(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [token])

  const handleCreated = (investment) => setInvestments((prev) => [investment, ...prev])
  const handleSigned = (updated) => setInvestments((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)))

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Investments" subtitle="Track your investment plans and contracts." icon={TrendingUp} />
        <div className="skeleton h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Investments" subtitle="Track your investment plans and contracts." icon={TrendingUp} />

      {/* The one investment component — same calculator as the public landing
          page, but here it carries `token` so its button is the real
          "Apply to Invest" POST and `onCreated` prepends the new record to
          the list below. Cancels <main>'s padding the same way Shop.jsx does
          for ShopSection. */}
      <div className="-mx-4 sm:-mx-6 md:-mx-10">
        <InvestmentPreview token={token} onCreated={handleCreated} />
      </div>

      {token && (
        <div className="mt-6">
          {investments.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No investments yet"
              description="Apply above once you're ready to invest — you'll transfer the funds outside the app, and a contract will appear here to sign once we confirm it."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {investments.map((investment) => (
                <InvestmentCard key={investment.id} investment={investment} token={token} onSigned={handleSigned} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MyInvestments
