import { useSearchParams } from 'react-router-dom'

// Reads/writes the active hub tab via `?tab=` so a tab is linkable and
// survives a refresh. Falls back to the first allowed tab when the query is
// missing or points at something the current admin can't see. `tabs` is the
// already permission-filtered list each hub builds.
export function useHubTab(tabs) {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const active = tabs.find((t) => t.slug === requested) || tabs[0] || null

  const setTab = (slug) => {
    const next = new URLSearchParams(params)
    next.set('tab', slug)
    setParams(next)
  }

  return { active, setTab }
}
