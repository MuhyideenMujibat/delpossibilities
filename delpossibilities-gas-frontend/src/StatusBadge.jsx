const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-brand-teal/10 text-brand-teal',
  picked_up: 'bg-brand-accent/15 text-brand-accent',
  delivered: 'bg-green-100 text-green-700',
}

function StatusBadge({ status, label }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'

  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  )
}

export default StatusBadge
