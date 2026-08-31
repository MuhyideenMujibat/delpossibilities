import { ChevronDown } from 'lucide-react'
import { useHostels } from './hooks/useHostels'

// Controlled <select> of admin-managed hostel names — dropped in wherever a
// free-text hostel field used to be (Register, Profile, Create Order) so
// admin's search-by-hostel always matches an exact, consistent name.
function HostelSelect({ id, value, onChange, icon: Icon, required = false, className = '' }) {
  const { hostels, loading } = useHostels()

  // Legacy/free-text values that predate the hostel list (or a hostel an
  // admin has since deactivated) still need to show up as the current
  // selection instead of silently blanking the field.
  const hasCurrentValue = value && hostels.some((h) => h.name === value)

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
          {loading ? 'Loading hostels…' : 'Select your hostel'}
        </option>
        {value && !hasCurrentValue && (
          <option value={value}>{value}</option>
        )}
        {hostels.map((hostel) => (
          <option key={hostel.id} value={hostel.name}>
            {hostel.name}
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

export default HostelSelect
