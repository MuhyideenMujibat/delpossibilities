import { createPortal } from 'react-dom'
import { Wallet } from 'lucide-react'

// Only shown when the admin has BOTH gateways enabled (see
// usePaymentCheckout) — with just one on, checkout skips straight to it and
// this never renders.
function PaymentGatewayModal({ open, busy = false, onChoose, onCancel }) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onCancel} aria-hidden="true" />

      <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
            <Wallet className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="font-heading text-base font-bold text-brand-navy">Choose how to pay</h3>
            <p className="mt-1 text-sm text-slate-500">You'll be redirected to complete payment.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => onChoose('paystack')} disabled={busy} className="btn-primary w-full">
            {busy ? 'Please wait…' : 'Pay with Paystack'}
          </button>
          <button type="button" onClick={() => onChoose('flutterwave')} disabled={busy} className="btn-outline w-full">
            {busy ? 'Please wait…' : 'Pay with Flutterwave'}
          </button>
          <button type="button" onClick={onCancel} disabled={busy} className="mt-1 text-sm text-slate-500 hover:underline">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PaymentGatewayModal
