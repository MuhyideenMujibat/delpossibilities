import { useState, useEffect, useMemo } from 'react'
import { MessageSquareText, Search, Star, Megaphone, MessageSquareQuote, X } from 'lucide-react'
import { apiFetch, formatDate } from '../api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'

const TYPE_LABELS = { suggestion: 'Suggestion', review: 'Review' }

const EMPTY_FILTERS = { search: '', type: 'all' }

function TypeBadge({ type }) {
  const isReview = type === 'review'
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
        isReview ? 'bg-brand-teal/10 text-brand-teal' : 'bg-brand-accent/15 text-brand-accent'
      }`}
    >
      {isReview ? <MessageSquareQuote className="h-3 w-3" strokeWidth={2} /> : <Megaphone className="h-3 w-3" strokeWidth={2} />}
      {TYPE_LABELS[type] || type}
    </span>
  )
}

function Stars({ rating }) {
  if (!rating) return <span className="text-xs text-slate-400">—</span>
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`h-3.5 w-3.5 ${star <= rating ? 'fill-brand-ember text-brand-ember' : 'text-slate-200'}`} strokeWidth={1.8} />
      ))}
    </div>
  )
}

function filterSubmissions(submissions, filters) {
  const term = filters.search.trim().toLowerCase()

  return submissions.filter((submission) => {
    if (filters.type !== 'all' && submission.type !== filters.type) return false

    if (term) {
      const haystack = `${submission.message} ${submission.user?.name || ''} ${submission.user?.email || ''}`.toLowerCase()
      if (!haystack.includes(term)) return false
    }

    return true
  })
}

function AdminFeedback({ token }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  useEffect(() => {
    apiFetch('/admin/feedback', { token })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setSubmissions(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load suggestions and reviews.'))
      .finally(() => setLoading(false))
  }, [token])

  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }))

  const filteredSubmissions = useMemo(() => filterSubmissions(submissions, filters), [submissions, filters])

  const stats = useMemo(() => {
    const suggestions = submissions.filter((s) => s.type === 'suggestion').length
    const reviews = submissions.filter((s) => s.type === 'review')
    const rated = reviews.filter((r) => r.rating)
    const avgRating = rated.length ? rated.reduce((sum, r) => sum + Number(r.rating), 0) / rated.length : null

    return { total: submissions.length, suggestions, reviewCount: reviews.length, avgRating }
  }, [submissions])

  const isFilterActive = filters.search || filters.type !== 'all'

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Suggestions &amp; Reviews"
        subtitle="Everything submitted through the site's feedback widget, newest first."
        icon={MessageSquareText}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Submissions" value={stats.total} icon={MessageSquareText} tone="navy" />
        <StatCard label="Suggestions" value={stats.suggestions} icon={Megaphone} tone="accent" />
        <StatCard label="Reviews" value={stats.reviewCount} icon={MessageSquareQuote} tone="teal" />
        <StatCard label="Average Rating" value={stats.avgRating ? `${stats.avgRating.toFixed(1)} / 5` : '—'} icon={Star} tone="amber" />
      </div>

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && submissions.length === 0 && !error && (
        <EmptyState icon={MessageSquareText} title="Nothing submitted yet" description="Suggestions and reviews from the feedback widget will show up here." />
      )}

      {!loading && submissions.length > 0 && (
        <>
          <div className="filter-bar">
            <div className="relative flex-1 sm:min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => set({ search: e.target.value })}
                placeholder="Search by message or submitter…"
                className="filter-field pl-9"
              />
            </div>

            <select value={filters.type} onChange={(e) => set({ type: e.target.value })} className="filter-field sm:w-44">
              <option value="all">All types</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {isFilterActive && (
              <button onClick={() => set(EMPTY_FILTERS)} className="btn-ghost">
                <X className="h-3.5 w-3.5" strokeWidth={2} />
                Clear
              </button>
            )}

            <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
              Showing {filteredSubmissions.length} of {submissions.length}
            </span>
          </div>

          {filteredSubmissions.length === 0 && (
            <EmptyState icon={Search} title="No submissions match your filters" description="Try clearing a filter to see more results." />
          )}

          {filteredSubmissions.length > 0 && (
            <div className="flex flex-col gap-3">
              {filteredSubmissions.map((submission) => (
                <div key={submission.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <TypeBadge type={submission.type} />
                      {submission.type === 'review' && <Stars rating={submission.rating} />}
                    </div>
                    <span className="whitespace-nowrap text-xs text-slate-400">{formatDate(submission.created_at)}</span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{submission.message}</p>

                  <p className="mt-3 text-xs text-slate-400">
                    {submission.user ? `${submission.user.name} · ${submission.user.email}` : 'Anonymous (not logged in)'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AdminFeedback
