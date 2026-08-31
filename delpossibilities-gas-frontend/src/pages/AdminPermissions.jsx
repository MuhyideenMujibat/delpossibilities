import { useState, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'
import { apiFetch } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'

function AdminPermissions({ token }) {
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/admin/permissions', { token })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setPermissions)
      .catch(() => setError('Could not load permissions.'))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Permissions"
        subtitle="The fixed set of access areas you can grant to an employee — assigned from the Add User or User Types pages."
        icon={ShieldCheck}
      />

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && permissions.length === 0 && !error && (
        <EmptyState icon={ShieldCheck} title="No permissions found" />
      )}

      {!loading && permissions.length > 0 && (
        <div className="card">
          <div className="flex flex-col divide-y divide-slate-100">
            {permissions.map((permission) => (
              <div key={permission.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <span className="text-sm font-medium text-brand-navy">{permission.label}</span>
                <span className="figure rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{permission.key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPermissions
