import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Wrench, ShoppingBasket, ArrowRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ShopSection from '../components/landing/ShopSection'

const SHOP_TABS = [
  { value: 'gas_services', label: 'Gas Services' },
  { value: 'eazy_market', label: 'Eazy Market' },
]

// Nav/UI shell only — both tabs render the existing ShopSection component
// unmodified, which fetches real products from /products?group=... (the
// same catalog already public on the landing page). No placeholder data.
function Shop({ token }) {
  const [tab, setTab] = useState('gas_services')

  return (
    <div>
      <PageHeader
        title="Shop"
        subtitle="Gas accessories and Eazy Market essentials, delivered with your next pickup."
        icon={ShoppingBag}
        action={
          token && (
            <Link to="/my-shop-orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-teal hover:underline">
              My Shop Orders
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          )
        }
      />

      <div className="mb-2 inline-flex rounded-lg bg-brand-bg p-1" role="radiogroup" aria-label="Shop section">
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

      <div className="-mx-4 sm:-mx-6 md:-mx-10">
        {tab === 'gas_services' ? (
          <ShopSection
            group="gas_services"
            title="Gas Services Shop"
            subtitle="Cylinders, accessories & repairs"
            icon={Wrench}
            tone="brand-bg"
          />
        ) : (
          <ShopSection
            group="eazy_market"
            title="Eazy Market & Errands"
            subtitle="Groceries and market runs, delivered"
            icon={ShoppingBasket}
          />
        )}
      </div>
    </div>
  )
}

export default Shop
