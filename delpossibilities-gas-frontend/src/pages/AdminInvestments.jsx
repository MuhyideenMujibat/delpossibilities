import { useState, useEffect } from 'react'
import { TrendingUp, CheckCircle2, XCircle, Download } from 'lucide-react'
import { apiFetch, formatNaira, formatDate } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../toastContext'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'payment_confirmed', label: 'Payment Confirmed' },
  { value: 'signed', label: 'Signed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  payment_confirmed: 'bg-brand-teal/10 text-brand-teal',
  signed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

function InvestmentsTab({ token }) {
  const { show } = useToast()
  const [investments, setInvestments] = useState([])
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  const fetchInvestments = async (statusFilter) => {
    setLoading(true)
    try {
      const response = await apiFetch(`/admin/investments?status=${statusFilter}`, { token })
      if (!response.ok) {
        setError('Could not load investments.')
        return
      }
      setInvestments(await response.json())
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInvestments(status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status])

  const handleConfirmPayment = async (investment) => {
    setActingId(investment.id)
    try {
      const response = await apiFetch(`/admin/investments/${investment.id}/confirm-payment`, { method: 'PATCH', token })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        show(data?.message || 'Could not confirm this payment.', { type: 'error' })
        return
      }
      setInvestments((prev) => prev.filter((inv) => inv.id !== investment.id || status === 'all'))
      show('Payment confirmed — contract generated.', { type: 'success' })
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setActingId(null)
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      const response = await apiFetch(`/admin/investments/${cancelTarget.id}/cancel`, { method: 'PATCH', token })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        show(data?.message || 'Could not cancel this investment.', { type: 'error' })
        return
      }
      setInvestments((prev) => prev.filter((inv) => inv.id !== cancelTarget.id || status === 'all'))
      setCancelTarget(null)
      show('Investment cancelled.', { type: 'success' })
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              status === opt.value ? 'bg-brand-navy text-white' : 'bg-brand-bg text-slate-500 hover:text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="alert-error mb-4">{error}</p>}

      {loading && <div className="skeleton h-40 w-full" />}

      {!loading && investments.length === 0 && (
        <EmptyState icon={TrendingUp} title="Nothing here" description="No investments match this filter right now." />
      )}

      {!loading && investments.length > 0 && (
        <div className="flex flex-col gap-3">
          {investments.map((investment) => (
            <div key={investment.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-navy">{investment.investor_name}</p>
                  <p className="text-xs text-slate-400">{investment.investor_email} · {investment.investor_phone}</p>
                  <p className="figure mt-2 text-sm text-slate-600">
                    {formatNaira(investment.capital_amount)} · {investment.tenure_months} months ·{' '}
                    {formatNaira(investment.monthly_return)}/mo
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Registered {formatDate(investment.created_at)}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[investment.status] || 'bg-slate-100 text-slate-500'}`}>
                  {STATUS_OPTIONS.find((o) => o.value === investment.status)?.label || investment.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {investment.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleConfirmPayment(investment)}
                    disabled={actingId === investment.id}
                    className="btn-primary"
                  >
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    {actingId === investment.id ? 'Confirming…' : 'Confirm Payment Received'}
                  </button>
                )}

                {investment.status !== 'signed' && investment.status !== 'cancelled' && (
                  <button type="button" onClick={() => setCancelTarget(investment)} className="btn-outline">
                    <XCircle className="h-4 w-4" strokeWidth={1.8} />
                    Cancel
                  </button>
                )}

                {investment.contract_url && (
                  <a href={investment.contract_url} target="_blank" rel="noreferrer" className="btn-outline">
                    <Download className="h-4 w-4" strokeWidth={1.8} />
                    View Contract
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this investment?"
        message={cancelTarget ? `${cancelTarget.investor_name}'s ${formatNaira(cancelTarget.capital_amount)} investment will be marked cancelled.` : ''}
        confirmLabel="Cancel Investment"
        tone="danger"
        busy={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </>
  )
}

// The rate/minimum/tenures/bank-details/WhatsApp side of this feature now
// lives on the Price Settings page (AdminSettings.jsx's "Investment
// Settings" card) — this page is purely the confirm-payment queue.
function AdminInvestments({ token }) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Investments" subtitle="Confirm investor payments and track signed contracts." icon={TrendingUp} />

      <InvestmentsTab token={token} />
    </div>
  )
}

export default AdminInvestments
