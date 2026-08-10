import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

function AdminSettings({ token }) {
  const [price, setPrice] = useState(null)
  const [newPrice, setNewPrice] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await apiFetch('/settings/price', { token })

        if (!response.ok) {
          setError('Could not load the current price.')
          return
        }

        const data = await response.json()
        const currentPrice = data.price_per_kg ?? data.data?.price_per_kg
        setPrice(currentPrice)
        setNewPrice(currentPrice ?? '')
      } catch {
        setError('Could not reach the server.')
      }
    }

    fetchPrice()
  }, [token])

  const handleSubmit = async () => {
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const response = await apiFetch('/settings/price', {
        method: 'PATCH',
        token,
        body: { price_per_kg: newPrice },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message || 'Could not update the price.')
        return
      }

      const data = await response.json()
      const updatedPrice = data.price_per_kg ?? data.data?.price_per_kg ?? newPrice
      setPrice(updatedPrice)
      setNewPrice(updatedPrice)
      setMessage('Price updated successfully!')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-6 text-2xl font-semibold text-brand-navy">Price Settings</h2>

      <div className="card">
        {price !== null && (
          <div className="mb-6 rounded-xl bg-brand-bg px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current Price</p>
            <p className="mt-1 text-2xl font-semibold text-brand-navy">₦{price} <span className="text-sm font-normal text-slate-500">/ kg</span></p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="label-text" htmlFor="new-price">New Price (per kg)</label>
            <input
              id="new-price"
              type="number"
              placeholder="e.g. 1200"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="input-field"
            />
          </div>

          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Update Price'}
          </button>

          {message && <p className="alert-success">{message}</p>}
          {error && <p className="alert-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export default AdminSettings
