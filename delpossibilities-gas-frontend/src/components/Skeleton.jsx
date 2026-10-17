// Placeholder blocks shown while data loads, so the page keeps its shape
// instead of flashing blank. Built on the shared .skeleton utility.
export function SkeletonRows({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16 w-full" />
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 3 }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton h-24 w-full" />
      ))}
    </div>
  )
}

// Fallback for lazy-loaded route chunks.
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Loading page">
      <div className="skeleton mb-6 h-10 w-56" />
      <SkeletonStats />
      <SkeletonRows rows={4} />
    </div>
  )
}
