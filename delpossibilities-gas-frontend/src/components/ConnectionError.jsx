import { WifiOff } from 'lucide-react'

export const CONNECTION_ERROR_MESSAGE = 'Check your internet connection.'

// Shown when a request failed because the network is down or too weak — as
// opposed to the server answering with an error. `onRetry` re-runs the load.
function ConnectionError({ message = CONNECTION_ERROR_MESSAGE, onRetry, className = 'mb-6' }) {
  return (
    <div className={`alert-error flex flex-wrap items-center justify-between gap-3 ${className}`} role="alert">
      <span className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
        {message}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-outline bg-white px-3 py-1.5 text-xs">
          Try again
        </button>
      )}
    </div>
  )
}

export default ConnectionError
