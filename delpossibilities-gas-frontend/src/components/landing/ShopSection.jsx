import { useState, useEffect, useMemo } from 'react'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import { apiFetch, formatNaira, resolveImageUrl } from '../../api'
import { useCart } from '../../cartContext'
import { useToast } from '../../toastContext'
import Reveal, { RevealItem } from '../motion/Reveal'

function cheapestPrice(product) {
  if (product.variants && product.variants.length > 0) {
    return Math.min(...product.variants.map((v) => Number(v.price)))
  }
  return Number(product.price)
}

function ProductCard({ product }) {
  const cart = useCart()
  const { show } = useToast()
  const hasVariants = product.variants && product.variants.length > 0
  const [variantId, setVariantId] = useState(hasVariants ? product.variants[0].id : null)
  const [quantity, setQuantity] = useState(1)

  const selectedVariant = hasVariants ? product.variants.find((v) => v.id === variantId) : null
  const price = selectedVariant ? Number(selectedVariant.price) : Number(product.price)

  // Already-carted state for whichever variant is currently selected — lets
  // a returning visitor (including one who just logged in mid-flow, since
  // the cart is localStorage-backed and survives that) see and adjust what
  // they already added instead of a fresh "Add" that resets to qty 1.
  const cartedItem = cart.items.find(
    (item) => item.productId === product.id && item.variantId === (selectedVariant?.id ?? null)
  )

  const handleAdd = () => {
    cart.addItem(product, selectedVariant, quantity)
    show(`Added ${quantity} × ${product.name}${selectedVariant ? ` (${selectedVariant.label})` : ''} to your next pickup.`, {
      type: 'success',
      duration: 2000,
    })
    setQuantity(1)
  }

  return (
    <RevealItem
      as="div"
      className="card flex flex-col p-4"
    >
      {product.image_url ? (
        <img src={resolveImageUrl(product.image_url)} alt={product.name} className="mb-3 h-28 w-full rounded-lg object-cover sm:h-32" />
      ) : (
        <div className="mb-3 flex h-28 w-full items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 sm:h-32">
          No image
        </div>
      )}

      <p className="truncate font-medium text-brand-navy">{product.name}</p>

      {hasVariants ? (
        <select
          value={variantId}
          onChange={(e) => setVariantId(Number(e.target.value))}
          className="input-field mt-2 !py-1.5 text-xs"
        >
          {product.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} — {formatNaira(v.price)}
            </option>
          ))}
        </select>
      ) : (
        <p className="figure mt-1 text-sm font-semibold text-brand-navy">{formatNaira(price)}</p>
      )}

      {/* Action row: stacks on the narrowest cards (2-up on a phone) so the
          quantity stepper and the Add button never fight for width and clip;
          side by side from `sm` up where there's room. */}
      {cartedItem ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-teal/10 p-1 pl-3">
          <span className="text-xs font-semibold text-brand-teal">In your next pickup</span>
          <div className="flex items-center gap-1 rounded-lg bg-white p-1">
            <button
              type="button"
              onClick={() => cart.updateQuantity(product.id, cartedItem.variantId, cartedItem.quantity - 1)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-brand-bg"
            >
              <Minus className="h-3 w-3" strokeWidth={2} />
            </button>
            <span className="figure w-5 text-center text-xs font-semibold text-brand-navy">{cartedItem.quantity}</span>
            <button
              type="button"
              onClick={() => cart.updateQuantity(product.id, cartedItem.variantId, cartedItem.quantity + 1)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-brand-bg"
            >
              <Plus className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex shrink-0 items-center gap-1 self-start rounded-lg bg-brand-bg p-1 sm:self-auto">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white"
            >
              <Minus className="h-3 w-3" strokeWidth={2} />
            </button>
            <span className="figure w-5 text-center text-xs font-semibold text-brand-navy">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white"
            >
              <Plus className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="btn-primary w-full min-w-0 !px-3 !py-1.5 text-xs sm:flex-1"
          >
            <ShoppingCart className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Add
          </button>
        </div>
      )}
    </RevealItem>
  )
}

// Shared by the landing-page shop sections (Gas Services, Eazy Market), the
// Shop page, and the "add to this delivery" modal — same public catalog
// fetch + card grid, differing only in which group they show and their
// copy/icon. Public: works fully logged out, checkout is what's login-gated
// (see Cart.jsx / CreateOrder.jsx).
//
// `variant`:
//   'page'  — full-bleed section with its own background and generous
//             vertical rhythm; grid steps 2 → 3 → 4 → 6 across breakpoints.
//   'modal' — no section chrome, tight padding, and a grid capped at
//             3-up (2-up on mobile) so it stays readable inside the narrow
//             AddToDeliveryModal and wraps/scrolls instead of overflowing.
function ShopSection({ group, title, subtitle, icon: Icon, tone = 'white', variant = 'page' }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')

  const isModal = variant === 'modal'

  useEffect(() => {
    let cancelled = false

    apiFetch(`/products?group=${group}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setProducts(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [group])

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products])
  const visibleProducts = useMemo(
    () =>
      products
        .filter((p) => categoryFilter === 'all' || p.category === categoryFilter)
        .sort((a, b) => a.sort_order - b.sort_order || cheapestPrice(a) - cheapestPrice(b)),
    [products, categoryFilter]
  )

  if (!loading && products.length === 0) return null

  const Wrapper = isModal ? 'div' : 'section'

  const gridClass = isModal
    ? 'mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3'
    : 'mt-8 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'

  return (
    <Wrapper className={isModal ? '' : tone === 'brand-bg' ? 'bg-brand-bg' : 'bg-white'}>
      <div className={isModal ? 'px-4 py-5 sm:px-5' : 'mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20'}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
              {subtitle}
            </p>
            <h2
              className={
                isModal
                  ? 'mt-1 font-heading text-lg font-bold text-brand-navy'
                  : 'mt-2 font-heading text-3xl font-bold text-brand-navy sm:text-4xl'
              }
            >
              {title}
            </h2>
          </div>

          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  categoryFilter === 'all' ? 'bg-brand-teal text-white' : 'bg-brand-bg text-slate-500 hover:text-slate-700'
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    categoryFilter === category ? 'bg-brand-teal text-white' : 'bg-brand-bg text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {category.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="skeleton mt-8 h-64 w-full" />
        ) : (
          <Reveal as="div" className={gridClass} stagger>
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </Reveal>
        )}
      </div>
    </Wrapper>
  )
}

export default ShopSection
