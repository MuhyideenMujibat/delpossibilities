import { ChevronDown } from 'lucide-react'
import { useDeliveryZones } from './hooks/useDeliveryZones'
import { formatNaira } from './api'

// Controlled <select> of admin-managed off-campus delivery zones — value is
// the zone id (not name), since the fee needs to be looked up numerically.
function DeliveryZoneSelect({ id, value, onChange, icon: Icon, required = false, className = '' }) {
  const { zones, loading } = useDeliveryZones()

  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      )}
      <select
        id={id}
        value={value || ''}
        onChange={onChange}
        required={required}
        disabled={loading}
        className={`input-field appearance-none pr-9 ${Icon ? 'pl-9' : ''} ${className}`}
      >
        <option value="" disabled>
          {loading ? 'Loading delivery zones…' : 'Select your delivery zone'}
        </option>
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name} — {formatNaira(zone.fee)}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        strokeWidth={1.8}
        aria-hidden="true"
      />
    </div>
  )
}

export default DeliveryZoneSelect
