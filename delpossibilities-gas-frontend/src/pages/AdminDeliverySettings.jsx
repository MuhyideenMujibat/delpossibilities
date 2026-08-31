import { useState, useEffect } from 'react'
import { Truck, Trash2 } from 'lucide-react'
import { apiFetch, formatNaira } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../toastContext'

const TABS = [
  { value: 'zones', label: 'Delivery Zones' },
  { value: 'tiers', label: 'Eazy Market Tiers' },
]

function DeliveryZonesTab({ token }) {
  const { show } = useToast()
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [fee, setFee] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchZones = async () => {
    try {
      const response = await apiFetch('/admin/delivery-zones', { token })
      if (!response.ok) {
        setError('Could not load delivery zones.')
        return
      }
      setZones(await response.json())
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchZones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await apiFetch('/admin/delivery-zones', {
        method: 'POST',
        token,
        body: { name, fee },
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'Could not save this zone.')
        return
      }

      setName('')
      setFee('')
      await fetchZones()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (zone) => {
    setTogglingId(zone.id)
    try {
      const response = await apiFetch(`/admin/delivery-zones/${zone.id}`, {
        method: 'PATCH',
        token,
        body: { is_active: !zone.is_active },
      })
      if (!response.ok) {
        show('Could not update this zone.', { type: 'error' })
        return
      }
      const updated = await response.json()
      setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)))
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const response = await apiFetch(`/admin/delivery-zones/${deleteTarget.id}`, { method: 'DELETE', token })
      if (!response.ok) {
        show('Could not remove this zone.', { type: 'error' })
        return
      }
      setZones((prev) => prev.filter((z) => z.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="card mb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label-text" htmlFor="zone-name">Zone name</label>
            <input
              id="zone-name"
              type="text"
              placeholder="e.g. Tanke"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div className="sm:w-40">
            <label className="label-text" htmlFor="zone-fee">Fee (min ₦300)</label>
            <input
              id="zone-fee"
              type="number"
              min="300"
              step="0.01"
              placeholder="e.g. 300"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Adding…' : 'Add Zone'}
          </button>
        </form>
        {error && <p className="alert-error mt-4">{error}</p>}
      </div>

      {loading && <div className="skeleton h-40 w-full" />}

      {!loading && zones.length === 0 && (
        <EmptyState icon={Truck} title="No delivery zones yet" description="Add one above so off-campus orders can pick a zone at checkout." />
      )}

      {!loading && zones.length > 0 && (
        <div className="flex flex-col gap-3">
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-brand-navy">{zone.name}</p>
                <p className="figure mt-0.5 text-xs text-slate-400">
                  {formatNaira(zone.fee)} · {zone.is_active ? 'Visible to students' : 'Hidden from students'}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  onClick={() => toggleActive(zone)}
                  disabled={togglingId === zone.id}
                  className={zone.is_active ? 'btn-outline px-3' : 'btn-primary px-3'}
                >
                  {togglingId === zone.id ? '…' : zone.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setDeleteTarget(zone)}
                  aria-label={`Delete ${zone.name}`}
                  className="btn-ghost px-2.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ''}
        message="Off-campus students can no longer pick this zone at checkout."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

function TierForm({ token, onSaved }) {
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [noUpperLimit, setNoUpperLimit] = useState(false)
  const [fee, setFee] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await apiFetch('/admin/eazy-market-delivery-tiers', {
        method: 'POST',
        token,
        body: { min_amount: minAmount, max_amount: noUpperLimit ? null : maxAmount, fee },
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'Could not save this tier.')
        return
      }

      setMinAmount('')
      setMaxAmount('')
      setNoUpperLimit(false)
      setFee('')
      onSaved()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label-text" htmlFor="tier-min">From (₦)</label>
          <input
            id="tier-min"
            type="number"
            min="0"
            step="0.01"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="label-text" htmlFor="tier-max">Up to (₦)</label>
          <input
            id="tier-max"
            type="number"
            min="0"
            step="0.01"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="input-field"
            disabled={noUpperLimit}
            required={!noUpperLimit}
          />
          <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={noUpperLimit} onChange={(e) => setNoUpperLimit(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-teal" />
            No upper limit
          </label>
        </div>
        <div>
          <label className="label-text" htmlFor="tier-fee">Delivery fee (₦)</label>
          <input
            id="tier-fee"
            type="number"
            min="0"
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="input-field"
            required
          />
        </div>
      </div>

      {error && <p className="alert-error">{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary w-fit">
        {saving ? 'Adding…' : 'Add Tier'}
      </button>
    </form>
  )
}

function EazyMarketTiersTab({ token }) {
  const { show } = useToast()
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTiers = async () => {
    try {
      const response = await apiFetch('/admin/eazy-market-delivery-tiers', { token })
      if (!response.ok) {
        setError('Could not load delivery tiers.')
        return
      }
      setTiers(await response.json())
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTiers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const toggleActive = async (tier) => {
    setTogglingId(tier.id)
    try {
      // gt:min_amount needs min_amount present in the same request, so the
      // full row is always submitted together, never a bare {is_active} patch.
      const response = await apiFetch(`/admin/eazy-market-delivery-tiers/${tier.id}`, {
        method: 'PATCH',
        token,
        body: { min_amount: tier.min_amount, max_amount: tier.max_amount, is_active: !tier.is_active },
      })
      if (!response.ok) {
        show('Could not update this tier.', { type: 'error' })
        return
      }
      const updated = await response.json()
      setTiers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const response = await apiFetch(`/admin/eazy-market-delivery-tiers/${deleteTarget.id}`, { method: 'DELETE', token })
      if (!response.ok) {
        show('Could not remove this tier.', { type: 'error' })
        return
      }
      setTiers((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="card mb-6">
        <TierForm token={token} onSaved={fetchTiers} />
      </div>

      {error && <p className="alert-error mb-4">{error}</p>}

      {loading && <div className="skeleton h-40 w-full" />}

      {!loading && tiers.length === 0 && (
        <EmptyState icon={Truck} title="No delivery tiers yet" description="Add one above so Eazy Market checkout can compute a delivery fee by cart value." />
      )}

      {!loading && tiers.length > 0 && (
        <div className="flex flex-col gap-3">
          {tiers.map((tier) => (
            <div key={tier.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <p className="figure truncate font-medium text-brand-navy">
                  {formatNaira(tier.min_amount)} – {tier.max_amount ? formatNaira(tier.max_amount) : 'and above'}
                </p>
                <p className="figure mt-0.5 text-xs text-slate-400">
                  {formatNaira(tier.fee)} delivery · {tier.is_active ? 'Active' : 'Hidden'}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  onClick={() => toggleActive(tier)}
                  disabled={togglingId === tier.id}
                  className={tier.is_active ? 'btn-outline px-3' : 'btn-primary px-3'}
                >
                  {togglingId === tier.id ? '…' : tier.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setDeleteTarget(tier)}
                  aria-label="Delete tier"
                  className="btn-ghost px-2.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this tier?"
        message="Eazy Market checkout will no longer offer this delivery-fee range."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

function AdminDeliverySettings({ token }) {
  const [tab, setTab] = useState('zones')

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Delivery Settings"
        subtitle="Off-campus gas delivery zones and Eazy Market delivery-fee tiers."
        icon={Truck}
      />

      <div className="mb-6 inline-flex rounded-lg bg-brand-bg p-1" role="radiogroup" aria-label="Delivery settings section">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'zones' ? <DeliveryZonesTab token={token} /> : <EazyMarketTiersTab token={token} />}
    </div>
  )
}

export default AdminDeliverySettings
