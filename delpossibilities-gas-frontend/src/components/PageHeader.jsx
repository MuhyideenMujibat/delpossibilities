function PageHeader({ eyebrow, title, subtitle, icon: Icon, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {Icon && (
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-navy text-white">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
        )}
        <div>
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h2 className="font-heading text-2xl font-bold text-brand-navy">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export default PageHeader
