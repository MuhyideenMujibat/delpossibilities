// Shared tab strip for the consolidated admin hubs. Each hub passes the set
// of tabs the current admin is actually allowed to see (already filtered by
// permission); the active one is tracked in the URL via useHubTab.
//
// The pages rendered inside each tab are the original, untouched admin
// pages — this only groups them so the sidebar isn't 18 entries long.
export default function AdminHubTabs({ tabs, activeSlug, onSelect }) {
  if (tabs.length <= 1) return null

  return (
    <div className="mb-6 flex flex-wrap gap-x-1 gap-y-0 border-b border-slate-200">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.slug === activeSlug
        return (
          <button
            key={tab.slug}
            type="button"
            onClick={() => onSelect(tab.slug)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? 'border-brand-teal text-brand-navy'
                : 'border-transparent text-slate-400 hover:text-brand-navy'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" strokeWidth={1.8} />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
