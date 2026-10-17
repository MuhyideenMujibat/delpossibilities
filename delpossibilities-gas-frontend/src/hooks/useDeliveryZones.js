import { useState, useEffect } from 'react'
import { publicFetch, peekPublicData } from '../publicData'

// Shared by Create Order (off-campus delivery-fee picker) so students pick
// from the same admin-managed zone list everywhere instead of a flat fee.
export function useDeliveryZones() {
  const [zones, setZones] = useState(() => peekPublicData('/delivery-zones') || [])
  const [loading, setLoading] = useState(() => !peekPublicData('/delivery-zones'))

  useEffect(() => {
    let cancelled = false

    publicFetch('/delivery-zones')
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
