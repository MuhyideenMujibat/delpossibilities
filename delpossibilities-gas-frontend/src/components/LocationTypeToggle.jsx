// Segmented on-campus / off-campus switch — shared by Register, Profile, and
// Create Order so students choose the same way everywhere whether they pick
// a hostel from the admin-managed list or type in their own address.
function LocationTypeToggle({ value, onChange, className = '' }) {
  const options = [
    { value: 'hostel', label: 'On Campus' },
    { value: 'off_campus', label: 'Off Campus' },
  ]

  return (
    <div className={`inline-flex rounded-lg bg-brand-bg p-1 ${className}`} role="radiogroup" aria-label="Delivery location type">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === option.value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default LocationTypeToggle
