const STATUS_STYLES = {
  pending: { badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  approved: { badge: 'bg-brand-teal/10 text-brand-teal', dot: 'bg-brand-teal' },
  picked_up: { badge: 'bg-brand-accent/15 text-brand-accent', dot: 'bg-brand-accent' },
  delivered: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
}

function StatusBadge({ status, label }) {
  const style = STATUS_STYLES[status] || { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} />
      {label}
    </span>
  )
}

export default StatusBadge
