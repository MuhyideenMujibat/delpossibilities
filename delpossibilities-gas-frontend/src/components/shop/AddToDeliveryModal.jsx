import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Wrench, ShoppingBasket } from 'lucide-react'
import ShopSection from '../landing/ShopSection'
import { useCart } from '../../cartContext'

const SHOP_TABS = [
  { value: 'gas_services', label: 'Gas Services' },
  { value: 'eazy_market', label: 'Eazy Market' },
]

// Shown when a student reaches checkout (gas order or subscriber refill
// request) with an empty cart — since a rider is already coming, this is
// the natural moment to ask if they want to add Eazy Market or gas
// accessories to the same delivery. Reuses ShopSection exactly as it
// appears on Shop.jsx, just inside a scrollable dialog instead of a page.
function AddToDeliveryModal({ open, onClose, onContinue }) {
  const [tab, setTab] = useState('gas_services')
  const cart = useCart()

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-heading text-base font-bold text-brand-navy">Add something to this delivery?</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Since a rider's already coming, want to add Eazy Market or gas accessories?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="inline-flex rounded-lg bg-brand-bg p-1" role="radiogroup" aria-label="Shop section">
            {SHOP_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={tab === t.value}
                onClick={() => setTab(t.value)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t.value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {tab === 'gas_services' ? (
            <ShopSection
              group="gas_services"
              title="Gas Services Shop"
              subtitle="Cylinders, accessories & repairs"
              icon={Wrench}
              variant="modal"
            />
          ) : (
            <ShopSection
              group="eazy_market"
              title="Eazy Market & Errands"
              subtitle="Groceries and market runs, delivered"
              icon={ShoppingBasket}
              variant="modal"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-outline">
            Skip
          </button>
          <button type="button" onClick={onContinue} className="btn-primary">
            {cart.itemCount > 0 ? `Continue with ${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}` : 'Continue without adding'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default AddToDeliveryModal
