import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', busy = false, onConfirm, onCancel }) {
  if (!open) return null

  const confirmClass = tone === 'danger' ? 'btn-primary bg-red-600 hover:bg-red-700' : 'btn-primary'

  // Rendered via a portal straight onto <body>: a fixed-position dialog
  // nested inside an ancestor with backdrop-blur/filter/transform would
  // otherwise center itself against that ancestor's box instead of the
  // viewport (that's how it ended up pinned under the blurred header).
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onCancel} aria-hidden="true" />

      <div role="alertdialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="font-heading text-base font-bold text-brand-navy">{title}</h3>
            {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-outline">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={confirmClass}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ConfirmDialog
