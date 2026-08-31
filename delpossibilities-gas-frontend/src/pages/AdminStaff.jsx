import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, UserPlus, Pencil, Trash2, X } from 'lucide-react'
import { apiFetch, formatDate } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

function AdminStaff({ token }) {
  const [staff, setStaff] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editPermissionIds, setEditPermissionIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = async () => {
    try {
      const [staffRes, permsRes] = await Promise.all([
        apiFetch('/admin/staff', { token }),
        apiFetch('/admin/permissions', { token }),
      ])

      if (!staffRes.ok || !permsRes.ok) {
        setError('Could not load staff.')
        return
      }

      setStaff(await staffRes.json())
      setPermissions(await permsRes.json())
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const startEdit = (member) => {
    setEditingId(member.id)
    setEditPermissionIds(member.permissions.map((p) => p.id))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditPermissionIds([])
  }

  const togglePermission = (id) => {
    setEditPermissionIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const saveEdit = async (id) => {
    setSaving(true)
    setError('')

    try {
      const response = await apiFetch(`/admin/staff/${id}`, {
        method: 'PATCH',
        token,
        body: { permission_ids: editPermissionIds },
      })

      if (!response.ok) {
        setError('Could not update this employee.')
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
      const response = await apiFetch(`/admin/staff/${deleteTarget.id}`, { method: 'DELETE', token })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.message || 'Could not remove this employee.')
        return
      }

      setStaff((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Staff"
        subtitle="Every employee/admin account and what they have access to."
        icon={Briefcase}
        action={
          <Link to="/admin/people?tab=add-user" className="btn-primary">
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Add User
          </Link>
        }
      />

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && staff.length === 0 && !error && (
        <EmptyState
          icon={Briefcase}
          title="No staff yet"
          description="Employee accounts you add from the Add User page will show up here."
          action={
            <Link to="/admin/people?tab=add-user" className="btn-primary mt-2">
              <UserPlus className="h-4 w-4" strokeWidth={2} />
              Add User
            </Link>
          }
        />
      )}

      {!loading && staff.length > 0 && (
        <div className="flex flex-col gap-3">
          {staff.map((member) => {
            const isEditing = editingId === member.id

            return (
              <div key={member.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-brand-navy">{member.name}</p>
                    <p className="truncate text-sm text-slate-500">{member.email}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {member.user_type?.name || 'No user type'} · Joined {formatDate(member.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1.5">
                    {isEditing ? (
                      <button onClick={cancelEdit} aria-label="Cancel" className="btn-ghost px-2.5">
                        <X className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    ) : (
                      <button onClick={() => startEdit(member)} aria-label={`Edit ${member.name}`} className="btn-ghost px-2.5">
                        <Pencil className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(member)}
                      aria-label={`Remove ${member.name}`}
                      className="btn-ghost px-2.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 p-3.5">
                    <div className="flex flex-col gap-2">
                      {permissions.map((permission) => (
                        <label key={permission.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                          <input
                            type="checkbox"
                            checked={editPermissionIds.includes(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                            className="h-4 w-4 flex-shrink-0 accent-brand-teal"
                          />
                          <span className="text-slate-600">{permission.label}</span>
                        </label>
                      ))}
                    </div>
                    <button onClick={() => saveEdit(member.id)} disabled={saving} className="btn-primary">
                      {saving ? 'Saving…' : 'Save Permissions'}
                    </button>
                  </div>
                ) : (
                  member.permissions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {member.permissions.map((permission) => (
                        <span key={permission.id} className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-medium text-brand-teal">
                          {permission.label}
                        </span>
                      ))}
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Remove ${deleteTarget.name}?` : ''}
        message="This deletes their account entirely — they'll lose access immediately."
        confirmLabel="Remove Employee"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default AdminStaff
