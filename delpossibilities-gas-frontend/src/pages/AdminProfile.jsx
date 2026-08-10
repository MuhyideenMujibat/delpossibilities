import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

function AdminProfile({ token }) {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await apiFetch('/user', { token })
        if (!response.ok) {
          setError('Could not load your profile.')
          return
        }

        const data = await response.json()
        setEmail(data.email || '')
        setName(data.name || '')
      } catch {
        setError('Could not reach the server.')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [token])

  const handleSubmit = async () => {
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const response = await apiFetch('/profile', {
        method: 'PATCH',
        token,
        body: { name },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message || 'Could not update your profile.')
        return
      }

      const data = await response.json()
      setName(data.name ?? name)
      setMessage('Profile updated successfully!')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md">
        <h2 className="mb-6 text-2xl font-semibold text-brand-navy">Profile</h2>
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-6 text-2xl font-semibold text-brand-navy">Profile</h2>

      <div className="card">
        <div className="flex flex-col gap-4">
          <div>
            <label className="label-text" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="input-field bg-slate-50 text-slate-500"
            />
          </div>

          <div>
            <label className="label-text" htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>

          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>

          {message && <p className="alert-success">{message}</p>}
          {error && <p className="alert-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export default AdminProfile
