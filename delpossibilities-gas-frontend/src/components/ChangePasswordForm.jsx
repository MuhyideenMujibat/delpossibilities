import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { apiFetch } from '../api'
import PasswordInput from './PasswordInput'

function firstValidationError(data) {
  if (!data?.errors) return null
  const first = Object.values(data.errors)[0]
  return Array.isArray(first) ? first[0] : null
}

function ChangePasswordForm({ token }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const response = await apiFetch('/profile/password', {
        method: 'PATCH',
        token,
        body: {
          current_password: currentPassword,
          password,
          password_confirmation: passwordConfirmation,
        },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(firstValidationError(data) || data?.message || 'Could not update your password.')
        return
      }

      setMessage('Password updated successfully!')
      setCurrentPassword('')
      setPassword('')
      setPasswordConfirmation('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label-text" htmlFor="current-password">Current Password</label>
        <PasswordInput
          id="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <div>
        <label className="label-text" htmlFor="new-password">New Password</label>
        <PasswordInput
          id="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      <div>
        <label className="label-text" htmlFor="confirm-password">Confirm New Password</label>
        <PasswordInput
          id="confirm-password"
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        <KeyRound className="h-4 w-4" strokeWidth={2} />
        {saving ? 'Updating…' : 'Update Password'}
      </button>

      {message && <p className="alert-success">{message}</p>}
      {error && <p className="alert-error">{error}</p>}
    </form>
  )
}

export default ChangePasswordForm
