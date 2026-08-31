import { useState, useEffect } from 'react'
import { UserPlus, User, Mail, Home, Phone, GraduationCap, Briefcase } from 'lucide-react'
import { apiFetch } from '../api'
import PageHeader from '../components/PageHeader'
import PasswordInput from '../components/PasswordInput'

const DEFAULT_PASSWORD = '123456789'

const EMPTY_FORM = { name: '', email: '', phone: '', hostel: '', password: '' }

function AdminUsers({ token, isSuperAdmin }) {
  const [accountType, setAccountType] = useState('student')
  const [form, setForm] = useState(EMPTY_FORM)
  const [useDefaultPassword, setUseDefaultPassword] = useState(false)
  const [userTypes, setUserTypes] = useState([])
  const [permissions, setPermissions] = useState([])
  const [userTypeId, setUserTypeId] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([])
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isSuperAdmin) return

    Promise.all([apiFetch('/admin/user-types', { token }), apiFetch('/admin/permissions', { token })])
      .then(async ([typesRes, permsRes]) => {
        if (typesRes.ok) setUserTypes(await typesRes.json())
        if (permsRes.ok) setPermissions(await permsRes.json())
      })
      .catch(() => {})
  }, [token, isSuperAdmin])

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleUserTypeChange = (id) => {
    setUserTypeId(id)
    const type = userTypes.find((t) => String(t.id) === String(id))
    setSelectedPermissionIds(type ? type.permissions.map((p) => p.id) : [])
  }

  const togglePermission = (id) => {
    setSelectedPermissionIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setCreated(null)
    setSaving(true)

    const passwordUsed = useDefaultPassword ? DEFAULT_PASSWORD : form.password
    const isEmployee = isSuperAdmin && accountType === 'admin'

    try {
      const response = await apiFetch('/admin/users', {
        method: 'POST',
        token,
        body: {
          account_type: isEmployee ? 'admin' : 'student',
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          hostel: isEmployee ? null : form.hostel || null,
          use_default_password: useDefaultPassword,
          password: useDefaultPassword ? undefined : form.password,
          user_type_id: isEmployee ? userTypeId || null : undefined,
          permission_ids: isEmployee ? selectedPermissionIds : undefined,
        },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'Could not create the user.')
        return
      }

      setCreated({
        name: data.name,
        email: data.email,
        password: passwordUsed,
        permissions: data.permissions?.map((p) => p.label) || [],
      })
      setForm(EMPTY_FORM)
      setUseDefaultPassword(false)
      setUserTypeId('')
      setSelectedPermissionIds([])
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  const isEmployee = isSuperAdmin && accountType === 'admin'

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add User"
        subtitle={isSuperAdmin ? 'Create a student or employee account directly — no email OTP needed.' : 'Create a verified student account directly — no email OTP needed.'}
        icon={UserPlus}
      />

      <div className="card">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSuperAdmin && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType('student')}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors ${
                  accountType === 'student' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <GraduationCap className="h-4 w-4" strokeWidth={1.8} />
                Student
              </button>
              <button
                type="button"
                onClick={() => setAccountType('admin')}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors ${
                  accountType === 'admin' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <Briefcase className="h-4 w-4" strokeWidth={1.8} />
                Employee
              </button>
            </div>
          )}

          <div>
            <label className="label-text" htmlFor="user-name">Full Name</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
              <input
                id="user-name"
                type="text"
                placeholder="Jane Doe"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                className="input-field pl-9"
                required
              />
            </div>
          </div>

          <div>
            <label className="label-text" htmlFor="user-email">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
              <input
                id="user-email"
                type="email"
                placeholder="student@example.com"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                className="input-field pl-9"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-text" htmlFor="user-phone">Phone (optional)</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
                <input
                  id="user-phone"
                  type="tel"
                  placeholder="080…"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className="input-field pl-9"
                />
              </div>
            </div>

            {!isEmployee && (
              <div>
                <label className="label-text" htmlFor="user-hostel">Hostel (optional)</label>
                <div className="relative">
                  <Home className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
                  <input
                    id="user-hostel"
                    type="text"
                    placeholder="Hostel A"
                    value={form.hostel}
                    onChange={(e) => set({ hostel: e.target.value })}
                    className="input-field pl-9"
                  />
                </div>
              </div>
            )}
          </div>

          {isEmployee && (
            <>
              <div>
                <label className="label-text" htmlFor="user-type">User Type (optional — prefills permissions below)</label>
                <select
                  id="user-type"
                  value={userTypeId}
                  onChange={(e) => handleUserTypeChange(e.target.value)}
                  className="input-field"
                >
                  <option value="">— Custom, no type —</option>
                  {userTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-semibold text-brand-navy">Permissions</p>
                <div className="flex flex-col gap-2.5">
                  {permissions.map((permission) => (
                    <label key={permission.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedPermissionIds.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                        className="h-4 w-4 flex-shrink-0 accent-brand-teal"
                      />
                      <span className="text-slate-600">{permission.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-brand-bg px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              checked={useDefaultPassword}
              onChange={(e) => setUseDefaultPassword(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-brand-teal"
            />
            <span className="text-slate-600">
              <span className="font-medium text-brand-navy">Use default password ({DEFAULT_PASSWORD})</span> — skip
              typing one; the account is verified either way.
            </span>
          </label>

          {!useDefaultPassword && (
            <div>
              <label className="label-text" htmlFor="user-password">Password</label>
              <PasswordInput
                id="user-password"
                value={form.password}
                onChange={(e) => set({ password: e.target.value })}
                autoComplete="new-password"
                required={!useDefaultPassword}
              />
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary">
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            {saving ? 'Saving…' : 'Save User'}
          </button>

          {error && <p className="alert-error">{error}</p>}

          {created && (
            <div className="alert-success flex flex-col gap-1">
              <p className="font-medium">User created — share these details with {created.name}:</p>
              <p className="figure">Email: {created.email}</p>
              <p className="figure">Password: {created.password}</p>
              {created.permissions.length > 0 && <p>Permissions: {created.permissions.join(', ')}</p>}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default AdminUsers
