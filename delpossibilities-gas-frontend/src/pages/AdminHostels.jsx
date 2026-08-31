import { useState, useEffect } from 'react'
import { Building2, Trash2 } from 'lucide-react'
import { apiFetch } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

function AdminHostels({ token }) {
  const [hostels, setHostels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchHostels = async () => {
    try {
      const response = await apiFetch('/admin/hostels', { token })

      if (!response.ok) {
        setError('Could not load hostels.')
        return
      }

      setHostels(await response.json())
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHostels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await apiFetch('/admin/hostels', {
        method: 'POST',
        token,
        body: { name },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'Could not save this hostel.')
        return
      }

      setName('')
      await fetchHostels()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (hostel) => {
    setTogglingId(hostel.id)
    setError('')

    try {
      const response = await apiFetch(`/admin/hostels/${hostel.id}`, {
        method: 'PATCH',
        token,
        body: { is_active: !hostel.is_active },
      })

      if (!response.ok) {
        setError('Could not update this hostel.')
        return
      }

      const updated = await response.json()
      setHostels((prev) => prev.map((h) => (h.id === updated.id ? updated : h)))
    } catch {
      setError('Could not reach the server.')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      const response = await apiFetch(`/admin/hostels/${deleteTarget.id}`, { method: 'DELETE', token })

      if (!response.ok) {
        setError('Could not remove this hostel.')
        return
      }

      setHostels((prev) => prev.filter((h) => h.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Hostels"
        subtitle="The list students pick from at registration and checkout — keep names exactly how you want them to appear in searches."
        icon={Building2}
      />

      <div className="card mb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label-text" htmlFor="hostel-name">Hostel name</label>
            <input
              id="hostel-name"
              type="text"
              placeholder="e.g. Faith Hostel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Adding…' : 'Add Hostel'}
          </button>
        </form>

        {error && <p className="alert-error mt-4">{error}</p>}
      </div>

      {loading && <div className="skeleton h-40 w-full" />}

      {!loading && hostels.length === 0 && (
        <EmptyState icon={Building2} title="No hostels yet" description="Add one above so students can pick it during registration and checkout." />
      )}

      {!loading && hostels.length > 0 && (
        <div className="flex flex-col gap-3">
          {hostels.map((hostel) => (
            <div key={hostel.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-brand-navy">{hostel.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">{hostel.is_active ? 'Visible to students' : 'Hidden from students'}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  onClick={() => toggleActive(hostel)}
                  disabled={togglingId === hostel.id}
                  className={hostel.is_active ? 'btn-outline px-3' : 'btn-primary px-3'}
                >
                  {togglingId === hostel.id ? '…' : hostel.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setDeleteTarget(hostel)}
                  aria-label={`Delete ${hostel.name}`}
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
        message="Students who already have this hostel saved keep it, but it disappears from the picker."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default AdminHostels
