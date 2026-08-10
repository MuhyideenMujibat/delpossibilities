import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

// Keeps the student's profile image in sync whenever they attach an image on
// an order, so future orders default to it too. Best-effort: a failure here
// shouldn't block the order, since the image is also sent directly with it.
function syncProfileImage(token, file) {
  const formData = new FormData()
  formData.append('cylinder_image', file)
  return apiFetch('/profile/cylinder-image', { method: 'POST', token, body: formData }).catch(() => null)
}

function formatNaira(amount) {
  return `₦${new Intl.NumberFormat('en-NG').format(amount)}`
}

function CreateOrder({ token }) {
  const navigate = useNavigate()
  const [kg, setKg] = useState('')
  const [hostelAddress, setHostelAddress] = useState('')
  const [cylinderImage, setCylinderImage] = useState(null)
  const [error, setError] = useState('')
  const [needsProfileImage, setNeedsProfileImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [pricePerKg, setPricePerKg] = useState(null)

  // GET /api/settings/price is currently admin-only, so this silently hides
  // the preview for students instead of breaking the page if it 403s.
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await apiFetch('/settings/price', { token })
        if (!response.ok) return

        const data = await response.json()
        const value = data?.price_per_kg ?? data?.data?.price_per_kg
        if (value !== undefined && value !== null) {
          setPricePerKg(Number(value))
        }
      } catch {
        // Silently hide the price preview if it can't be fetched.
      }
    }

    fetchPrice()
  }, [token])

  // Pre-fill the hostel address from the student's profile so they don't
  // have to retype it on every order.
  useEffect(() => {
    const fetchHostel = async () => {
      try {
        const response = await apiFetch('/user', { token })
        if (!response.ok) return

        const data = await response.json()
        if (data?.hostel) {
          setHostelAddress(data.hostel)
        }
      } catch {
        // Leave the field blank if it can't be fetched.
      }
    }

    fetchHostel()
  }, [token])

  const kgValue = Number(kg)
  const total = pricePerKg !== null && kg !== '' && !Number.isNaN(kgValue) ? pricePerKg * kgValue : null

  const handleFileChange = (e) => {
    setCylinderImage(e.target.files[0])
  }

  const submitOrder = async (imageFile) => {
    if (imageFile) {
      await syncProfileImage(token, imageFile)
    }

    const formData = new FormData()
    formData.append('kg', kg)
    formData.append('hostel_address', hostelAddress)
    if (imageFile) {
      formData.append('cylinder_image', imageFile)
    }

    const response = await apiFetch('/orders', {
      method: 'POST',
      token,
      body: formData,
    })

    const data = await response.json().catch(() => null)

    if (response.status === 422) {
      const message = data?.message || 'Please add a cylinder image to your profile before ordering.'
      setError(message)
      setNeedsProfileImage(true)
      return
    }

    if (!response.ok) {
      setError(data?.message || 'Could not create the order.')
      return
    }

    setError('')
    setNeedsProfileImage(false)
    navigate('/orders')
  }

  const handleCreateOrder = async () => {
    setError('')
    setNeedsProfileImage(false)
    setSubmitting(true)

    try {
      await submitOrder(cylinderImage)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecoveryFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setError('')
    setRecovering(true)

    try {
      await submitOrder(file)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setRecovering(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-6 text-2xl font-semibold text-brand-navy">Create Order</h2>

      <div className="card">
        <div className="flex flex-col gap-4">
          <div>
            <label className="label-text" htmlFor="kg">Kg</label>
            <input
              id="kg"
              type="number"
              placeholder="e.g. 12.5"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              className="input-field"
            />
          </div>

          {pricePerKg !== null && (
            <div className="rounded-xl bg-brand-bg px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Price per kg</span>
                <span className="font-medium text-brand-navy">{formatNaira(pricePerKg)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-500">Total</span>
                <span className="font-semibold text-brand-navy">{total !== null ? formatNaira(total) : '—'}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Estimated only — the final amount is calculated when you submit.</p>
            </div>
          )}

          <div>
            <label className="label-text" htmlFor="hostel-address">Hostel Address</label>
            <input
              id="hostel-address"
              type="text"
              placeholder="Hostel, Block, Room"
              value={hostelAddress}
              onChange={(e) => setHostelAddress(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label-text">
              Cylinder image <span className="font-normal text-slate-400">(optional, overrides your profile image for this order)</span>
            </label>
            <input type="file" accept="image/*" onChange={handleFileChange} className="file-input" />
          </div>

          <button onClick={handleCreateOrder} disabled={submitting} className="btn-primary mt-2">
            {submitting ? 'Creating…' : 'Create Order'}
          </button>

          {error && (
            <div className="alert-error flex flex-col gap-3">
              <p>{error}</p>

              {needsProfileImage && (
                <div>
                  <label className="label-text text-red-700">Upload a cylinder image now to continue:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleRecoveryFileChange}
                    disabled={recovering}
                    className="file-input"
                  />
                </div>
              )}

              {recovering && <p className="animate-pulse text-red-600">Uploading image and retrying your order…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateOrder
