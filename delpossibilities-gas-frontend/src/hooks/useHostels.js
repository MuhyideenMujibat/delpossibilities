import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

// Shared by Register, Profile, and Create Order so students pick from the
// same admin-managed list everywhere instead of typing a hostel name freehand.
export function useHostels() {
  const [hostels, setHostels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    apiFetch('/hostels')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setHostels(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { hostels, loading }
}
