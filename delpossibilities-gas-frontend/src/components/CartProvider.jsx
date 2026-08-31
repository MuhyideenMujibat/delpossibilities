import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartContext } from '../cartContext'

const STORAGE_KEY = 'cart'

function lineKey(productId, variantId) {
  return `${productId}:${variantId ?? 'base'}`
}

function loadInitialItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Client-side cart, backed by localStorage — this app has no persisted
// "carts" table (see Phase 2 plan): guests can browse and add to cart
// pre-login on the landing page, and only at checkout time does a cart
// convert into a real server-side ProductOrder (see ProductOrderController).
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitialItems)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Storage full/unavailable — cart just won't persist across reloads.
    }
  }, [items])

  const addItem = useCallback((product, variant, quantity = 1) => {
    const productId = product.id
    const variantId = variant?.id ?? null
    const key = lineKey(productId, variantId)

    setItems((prev) => {
      const existing = prev.find((item) => lineKey(item.productId, item.variantId) === key)
      if (existing) {
        return prev.map((item) =>
          lineKey(item.productId, item.variantId) === key
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }

      return [
        ...prev,
        {
          productId,
          variantId,
          quantity,
          snapshot: {
            name: product.name,
            price: variant ? variant.price : product.price,
            image_url: product.image_url,
            group: product.group,
            category: product.category,
            variant_label: variant?.label ?? null,
          },
        },
      ]
    })
  }, [])

  const removeItem = useCallback((productId, variantId) => {
    const key = lineKey(productId, variantId)
    setItems((prev) => prev.filter((item) => lineKey(item.productId, item.variantId) !== key))
  }, [])

  const updateQuantity = useCallback((productId, variantId, quantity) => {
    const key = lineKey(productId, variantId)

    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => lineKey(item.productId, item.variantId) !== key))
      return
    }

    setItems((prev) =>
      prev.map((item) => (lineKey(item.productId, item.variantId) === key ? { ...item, quantity } : item))
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.snapshot.price) * item.quantity, 0),
    [items]
  )

  const subtotalByGroup = useMemo(() => {
    const totals = { gas_services: 0, eazy_market: 0 }
    items.forEach((item) => {
      totals[item.snapshot.group] = (totals[item.snapshot.group] || 0) + Number(item.snapshot.price) * item.quantity
    })
    return totals
  }, [items])

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQuantity, clear, subtotal, subtotalByGroup, itemCount }),
    [items, addItem, removeItem, updateQuantity, clear, subtotal, subtotalByGroup, itemCount]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
