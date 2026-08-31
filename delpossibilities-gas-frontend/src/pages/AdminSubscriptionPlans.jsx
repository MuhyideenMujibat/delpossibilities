import { useState, useEffect } from 'react'
import { CircleDollarSign, Flame } from 'lucide-react'
import { apiFetch, formatNaira } from '../api'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../toastContext'

const PACKAGE_TABS = [
  { value: 'session', label: 'Session Package' },
  { value: 'semester', label: 'Semester Package' },
]

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }

// Editable-field shape shared by drafts and the dirty-check — keeps both in
// sync with whatever fields a super admin is allowed to touch.
function draftFor(plan) {
  return {
    package_type: plan.package_type,
    tier: plan.tier,
    cylinder_kg: plan.cylinder_kg,
    price: plan.price,
    foodstuff_pack_value: plan.foodstuff_pack_value ?? '',
    has_souvenir: Boolean(plan.has_souvenir),
    has_publicity: Boolean(plan.has_publicity),
  }
}

function isDirty(draft, plan) {
  const base = draftFor(plan)
  return Object.keys(base).some((key) => String(draft[key] ?? '') !== String(base[key] ?? ''))
}

function PlanCard({ plan, draft, onChange, onSave, saving, isSuperAdmin }) {
  const dirty = isDirty(draft, plan)
  const patch = (fields) => onChange(plan.id, fields)

  if (!isSuperAdmin) {
    return (
      <div className="card flex flex-col">
        <span className="eyebrow mb-2 inline-flex w-fit items-center rounded-full bg-brand-bg px-2.5 py-1 text-[10px] text-brand-navy">
          {TIER_LABELS[plan.tier] || plan.tier}
        </span>
        <div className="flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-brand-ember" strokeWidth={2} />
          <span className="figure text-sm font-medium text-slate-500">{Number(plan.cylinder_kg)} kg total allowance</span>
        </div>

        <label className="label-text mt-4" htmlFor={`price-${plan.id}`}>Price</label>
        <input
          id={`price-${plan.id}`}
          type="number"
          min="0.01"
          step="0.01"
          value={draft.price}
          onChange={(e) => patch({ price: e.target.value })}
          className="input-field"
        />

        <button type="button" onClick={() => onSave(plan)} disabled={!dirty || saving} className="btn-primary mt-4 w-full">
          {saving ? 'Saving…' : 'Save Price'}
        </button>
      </div>
    )
  }

  return (
    <div className="card flex flex-col">
      <span className="eyebrow mb-2 inline-flex w-fit items-center rounded-full bg-brand-bg px-2.5 py-1 text-[10px] text-brand-navy">
        {TIER_LABELS[plan.tier] || plan.tier}
      </span>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-text" htmlFor={`package-${plan.id}`}>Package</label>
          <select
            id={`package-${plan.id}`}
            value={draft.package_type}
            onChange={(e) => patch({ package_type: e.target.value })}
            className="input-field"
          >
            <option value="session">Session</option>
            <option value="semester">Semester</option>
          </select>
        </div>
        <div>
          <label className="label-text" htmlFor={`tier-${plan.id}`}>Tier</label>
          <select id={`tier-${plan.id}`} value={draft.tier} onChange={(e) => patch({ tier: e.target.value })} className="input-field">
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
        </div>
        <div>
          <label className="label-text" htmlFor={`kg-${plan.id}`}>Total kg allowance</label>
          <input
            id={`kg-${plan.id}`}
            type="number"
            min="0.01"
            step="0.01"
            value={draft.cylinder_kg}
            onChange={(e) => patch({ cylinder_kg: e.target.value })}
            className="input-field"
          />
        </div>
        <div>
          <label className="label-text" htmlFor={`price-${plan.id}`}>Price</label>
          <input
            id={`price-${plan.id}`}
            type="number"
            min="0.01"
            step="0.01"
            value={draft.price}
            onChange={(e) => patch({ price: e.target.value })}
            className="input-field"
          />
        </div>
        <div className="col-span-2">
          <label className="label-text" htmlFor={`foodstuff-${plan.id}`}>Foodstuff pack value</label>
          <input
            id={`foodstuff-${plan.id}`}
            type="number"
            min="0"
            step="0.01"
            placeholder="Leave blank for none"
            value={draft.foodstuff_pack_value}
            onChange={(e) => patch({ foodstuff_pack_value: e.target.value })}
            className="input-field"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={draft.has_souvenir}
            onChange={(e) => patch({ has_souvenir: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-teal"
          />
          Includes souvenir
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={draft.has_publicity}
            onChange={(e) => patch({ has_publicity: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-teal"
          />
          Includes online publicity
        </label>
      </div>

      <button type="button" onClick={() => onSave(plan)} disabled={!dirty || saving} className="btn-primary mt-4 w-full">
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}

function AdminSubscriptionPlans({ token, isSuperAdmin = false }) {
  const { show } = useToast()
  const [packageType, setPackageType] = useState('session')
  const [plans, setPlans] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingPlan, setPendingPlan] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch('/subscription-plans', { token })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setPlans(list)
        setDrafts(Object.fromEntries(list.map((plan) => [plan.id, draftFor(plan)])))
      })
      .catch(() => setError('Could not load subscription plans.'))
      .finally(() => setLoading(false))
  }, [token])

  const tierPlans = plans
    .filter((plan) => plan.package_type === packageType)
    .sort((a, b) => Number(a.price) - Number(b.price))

  const handleDraftChange = (planId, fields) => {
    setDrafts((prev) => ({ ...prev, [planId]: { ...prev[planId], ...fields } }))
  }

  const handleConfirmSave = async () => {
    if (!pendingPlan) return
    setSaving(true)

    const draft = drafts[pendingPlan.id]
    const body = isSuperAdmin
      ? { ...draft, foodstuff_pack_value: draft.foodstuff_pack_value === '' ? null : draft.foodstuff_pack_value }
      : { price: draft.price }

    try {
      const response = await apiFetch(`/admin/subscription-plans/${pendingPlan.id}`, {
        method: 'PATCH',
        token,
        body,
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        show(data?.message || 'Could not update this plan.', { type: 'error' })
        return
      }

      setPlans((prev) => prev.map((plan) => (plan.id === data.id ? data : plan)))
      setDrafts((prev) => ({ ...prev, [data.id]: draftFor(data) }))
      show(
        isSuperAdmin
          ? 'Plan updated.'
          : 'Price updated. Existing subscribers keep their locked-in price.',
        { type: 'success' }
      )
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setSaving(false)
      setPendingPlan(null)
    }
  }

  const pendingDraft = pendingPlan ? drafts[pendingPlan.id] : null

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Plan Pricing"
        subtitle={
          isSuperAdmin
            ? "Edit every detail of a plan — package, tier, cylinder size, perks, and price."
            : 'Edit what each tier costs going forward. Already-active subscribers keep the price they locked in at sign-up.'
        }
        icon={CircleDollarSign}
      />

      {error && <p className="alert-error mb-6">{error}</p>}

      <div className="mb-6 inline-flex rounded-lg bg-brand-bg p-1" role="radiogroup" aria-label="Package type">
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

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && (
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${isSuperAdmin ? '' : 'lg:grid-cols-3'}`}>
          {tierPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              draft={drafts[plan.id] || draftFor(plan)}
              onChange={handleDraftChange}
              onSave={setPendingPlan}
              saving={saving && pendingPlan?.id === plan.id}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingPlan}
        title={pendingPlan ? `Update ${TIER_LABELS[pendingPlan.tier]} ${pendingPlan.package_type === 'session' ? 'Session' : 'Semester'}?` : ''}
        message={
          pendingPlan && pendingDraft
            ? isSuperAdmin
              ? `New price: ${formatNaira(pendingDraft.price)}. Price changes only affect students who subscribe from now on — existing subscribers keep their locked-in price. Package, tier, and cylinder-size changes apply immediately to everyone already on this plan, including in-flight refills and activation calendars.`
              : `New price: ${formatNaira(pendingDraft.price)}. This only affects students who subscribe from now on — anyone already subscribed keeps their locked-in price of ${formatNaira(pendingPlan.price)}.`
            : ''
        }
        confirmLabel="Confirm & Save"
        busy={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => setPendingPlan(null)}
      />
    </div>
  )
}

export default AdminSubscriptionPlans
