const TONES = {
  navy: { icon: 'bg-brand-navy/10 text-brand-navy', band: '#0b1e33' },
  teal: { icon: 'bg-brand-teal/10 text-brand-teal', band: '#1b6ca8' },
  accent: { icon: 'bg-brand-accent/15 text-brand-accent', band: '#8a9a5b' },
  amber: { icon: 'bg-amber-100 text-amber-700', band: '#d97706' },
  green: { icon: 'bg-green-100 text-green-700', band: '#22c55e' },
}

function StatCard({ label, value, hint, icon: Icon, tone = 'navy' }) {
  const colors = TONES[tone] || TONES.navy

  return (
    <div className="stat-card">
      {Icon && (
        <span className={`stat-icon ${colors.icon}`}>
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      )}
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <p className="figure mt-1 truncate text-xl font-semibold text-brand-navy">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}

export default StatCard
