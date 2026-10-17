import { useState, useEffect } from 'react'
import { publicFetch, peekPublicData } from '../publicData'

// Shared by Register, Profile, and Create Order so students pick from the
// same admin-managed list everywhere instead of typing a hostel name freehand.
// Starts from the last list we saw (instant), then swaps in the fresh one.
export function useHostels() {
  const [hostels, setHostels] = useState(() => peekPublicData('/hostels') || [])
  const [loading, setLoading] = useState(() => !peekPublicData('/hostels'))

  useEffect(() => {
    let cancelled = false

    publicFetch('/hostels')
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
