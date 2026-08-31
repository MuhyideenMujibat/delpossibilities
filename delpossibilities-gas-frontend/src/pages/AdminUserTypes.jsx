import { useState, useEffect } from 'react'
import { Layers, Pencil, Trash2, X } from 'lucide-react'
import { apiFetch } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

const EMPTY_FORM = { name: '', permissionIds: [] }

function AdminUserTypes({ token }) {
  const [types, setTypes] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = async () => {
    try {
      const [typesRes, permsRes] = await Promise.all([
        apiFetch('/admin/user-types', { token }),
        apiFetch('/admin/permissions', { token }),
      ])

      if (!typesRes.ok || !permsRes.ok) {
        setError('Could not load user types.')
        return
      }

      setTypes(await typesRes.json())
      setPermissions(await permsRes.json())
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  // fetchAll is also called after create/edit/delete to refresh the list,
  // so it's kept outside the effect rather than inlined.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const togglePermission = (id) => {
    setForm((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id)
        ? prev.permissionIds.filter((p) => p !== id)
        : [...prev.permissionIds, id],
    }))
  }

  const startEdit = (type) => {
    setEditingId(type.id)
    setForm({ name: type.name, permissionIds: type.permissions.map((p) => p.id) })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await apiFetch(editingId ? `/admin/user-types/${editingId}` : '/admin/user-types', {
        method: editingId ? 'PATCH' : 'POST',
        token,
        body: { name: form.name, permission_ids: form.permissionIds },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'Could not save this user type.')
        return
      }

      await fetchAll()
      cancelEdit()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      const response = await apiFetch(`/admin/user-types/${deleteTarget.id}`, { method: 'DELETE', token })

      if (!response.ok) {
        setError('Could not remove this user type.')
        return
      }

      setTypes((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setDeleteTarget(null)
      if (editingId === deleteTarget.id) cancelEdit()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="User Types"
        subtitle="Reusable permission bundles — pick one when adding an employee to prefill their access."
        icon={Layers}
      />

      <div className="card mb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-bold text-brand-navy">
              {editingId ? `Editing "${form.name}"` : 'New User Type'}
            </h3>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="btn-ghost">
                <X className="h-3.5 w-3.5" strokeWidth={2} />
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="label-text" htmlFor="type-name">Name</label>
            <input
              id="type-name"
              type="text"
              placeholder="e.g. Support Staff"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="input-field"
              required
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-brand-navy">Default permissions</p>
            <div className="flex flex-col gap-2.5">
              {permissions.map((permission) => (
                <label key={permission.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.permissionIds.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                    className="h-4 w-4 flex-shrink-0 accent-brand-teal"
                  />
                  <span className="text-slate-600">{permission.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update User Type' : 'Create User Type'}
          </button>

          {error && <p className="alert-error">{error}</p>}
        </form>
      </div>

      {loading && <div className="skeleton h-40 w-full" />}

      {!loading && types.length === 0 && (
        <EmptyState icon={Layers} title="No user types yet" description="Create one above to reuse when adding employees." />
      )}

      {!loading && types.length > 0 && (
        <div className="flex flex-col gap-3">
          {types.map((type) => (
            <div key={type.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-brand-navy">{type.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{type.users_count} employee{type.users_count === 1 ? '' : 's'}</p>
                </div>
                <div className="flex flex-shrink-0 gap-1.5">
                  <button onClick={() => startEdit(type)} aria-label={`Edit ${type.name}`} className="btn-ghost px-2.5">
                    <Pencil className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(type)}
                    aria-label={`Delete ${type.name}`}
                    className="btn-ghost px-2.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </div>

              {type.permissions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {type.permissions.map((permission) => (
                    <span key={permission.id} className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-medium text-brand-teal">
                      {permission.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ''}
        message={
          deleteTarget?.users_count
            ? `${deleteTarget.users_count} employee(s) currently have this type — they'll keep their existing permissions, just lose the label.`
            : 'This user type will be removed.'
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default AdminUserTypes
