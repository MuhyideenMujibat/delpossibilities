import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

// Shared by Create Order (off-campus delivery-fee picker) so students pick
// from the same admin-managed zone list everywhere instead of a flat fee.
export function useDeliveryZones() {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    apiFetch('/delivery-zones')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setZones(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { zones, loading }
}
