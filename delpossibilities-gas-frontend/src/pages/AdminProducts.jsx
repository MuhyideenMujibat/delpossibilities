import { useState, useEffect, useMemo } from 'react'
import { Package, ShoppingBasket, Plus, Trash2, Pencil, X } from 'lucide-react'
import { apiFetch, formatNaira, resolveImageUrl } from '../api'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import PaginationControls from '../components/PaginationControls'
import { paginate } from '../pagination'
import { useToast } from '../toastContext'

const GROUP_TABS = [
  { value: 'gas_services', label: 'Gas Services' },
  { value: 'eazy_market', label: 'Eazy Market' },
]

// Mirrors Product::CATEGORIES on the backend — kept in sync manually, same
// as TIER_LABELS/STATUS_LABELS elsewhere in this app.
const CATEGORY_LABELS = {
  gas_services: {
    cylinder_sales: 'Gas Cylinder Sales',
    accessories_burners: 'Gas Accessories & Burners',
    repair_maintenance: 'Cylinder Repair & Maintenance',
    repainting: 'Cylinder Repainting',
    cylinder_cleaning: 'Free Cylinder Cleaning',
  },
  eazy_market: {
    groceries: 'Groceries',
    fresh_produce: 'Fresh Fruits & Vegetables',
    frozen_foods: 'Frozen Foods',
    market_errands: 'Market Errands',
    peanuts: 'Peanuts',
  },
}

function emptyDraft(group) {
  return {
    group,
    category: Object.keys(CATEGORY_LABELS[group])[0],
    name: '',
    description: '',
    price: '',
    is_active: true,
    sort_order: 0,
  }
}

let nextTempId = -1

function ProductFormDialog({ open, group, product, onClose, onSaved, token }) {
  const { show } = useToast()
  const [draft, setDraft] = useState(() => emptyDraft(group))
  const [imageFile, setImageFile] = useState(null)
  const [variants, setVariants] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    if (product) {
      setDraft({
        group: product.group,
        category: product.category,
        name: product.name,
        description: product.description || '',
        price: product.price,
        is_active: Boolean(product.is_active),
        sort_order: product.sort_order || 0,
      })
      setVariants((product.variants || []).map((v) => ({ ...v, _deleted: false })))
    } else {
      setDraft(emptyDraft(group))
      setVariants([])
    }
    setImageFile(null)
    setError('')
  }, [open, product, group])

  if (!open) return null

  const previewUrl = imageFile ? URL.createObjectURL(imageFile) : resolveImageUrl(product?.image_url)

  const addVariant = () => {
    setVariants((prev) => [...prev, { id: nextTempId--, label: '', price: '', _deleted: false, _new: true }])
  }

  const updateVariant = (id, fields) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...fields } : v)))
  }

  const removeVariant = (id) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, _deleted: true } : v)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('group', draft.group)
      formData.append('category', draft.category)
      formData.append('name', draft.name)
      formData.append('description', draft.description || '')
      formData.append('price', draft.price)
      formData.append('is_active', draft.is_active ? '1' : '0')
      formData.append('sort_order', draft.sort_order || 0)
      if (imageFile) formData.append('image', imageFile)

      const response = await apiFetch(product ? `/admin/products/${product.id}` : '/admin/products', {
        method: 'POST', // both create and update use POST — update isn't PATCH because it may carry a file
        token,
        body: formData,
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'Could not save this product.')
        return
      }

      const productId = data.id

      // Variants are saved as separate calls after the parent product
      // resolves, since they're their own nested resource on the backend.
      for (const variant of variants) {
        if (variant._deleted) {
          if (!variant._new) {
            await apiFetch(`/admin/product-variants/${variant.id}`, { method: 'DELETE', token })
          }
          continue
        }

        if (variant._new) {
          await apiFetch(`/admin/products/${productId}/variants`, {
            method: 'POST',
            token,
            body: { label: variant.label, price: variant.price },
          })
        } else {
          await apiFetch(`/admin/product-variants/${variant.id}`, {
            method: 'PATCH',
            token,
            body: { label: variant.label, price: variant.price },
          })
        }
      }

      show(product ? 'Product updated.' : 'Product added.', { type: 'success' })
      onSaved()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-brand-navy">{product ? 'Edit Product' : 'Add Product'}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label-text">Category</label>
            <select
              value={draft.category}
              onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
              className="input-field"
            >
              {Object.entries(CATEGORY_LABELS[draft.group]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-text">Name</label>
            <input
              type="text"
              required
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="label-text">Description (optional)</label>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              className="input-field resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={draft.price}
                onChange={(e) => setDraft((prev) => ({ ...prev, price: e.target.value }))}
                className="input-field"
              />
              {variants.filter((v) => !v._deleted).length > 0 && (
                <p className="mt-1 text-xs text-slate-400">Ignored while this product has variants below — each variant's own price applies.</p>
              )}
            </div>
            <div>
              <label className="label-text">Sort order</label>
              <input
                type="number"
                min="0"
                value={draft.sort_order}
                onChange={(e) => setDraft((prev) => ({ ...prev, sort_order: e.target.value }))}
                className="input-field"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-brand-teal"
            />
            Active (visible to students)
          </label>

          <div>
            <label className="label-text">Image</label>
            {previewUrl ? (
              <div className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img src={previewUrl} alt="" className="h-36 w-full object-cover" />
              </div>
            ) : (
              <div className="mb-2 flex h-36 w-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
                No image
              </div>
            )}
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0] || null)} className="file-input" />
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-brand-navy">Variants (optional)</span>
              <button type="button" onClick={addVariant} className="btn-outline !py-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add Variant
              </button>
            </div>

            {variants.filter((v) => !v._deleted).length === 0 && (
              <p className="text-xs text-slate-400">No variants — this product sells at its own price above.</p>
            )}

            <div className="flex flex-col gap-2">
              {variants.filter((v) => !v._deleted).map((variant) => (
                <div key={variant.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Label (e.g. Pack)"
                    required
                    value={variant.label}
                    onChange={(e) => updateVariant(variant.id, { label: e.target.value })}
                    className="input-field flex-1"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    required
                    value={variant.price}
                    onChange={(e) => updateVariant(variant.id, { price: e.target.value })}
                    className="input-field w-28"
                  />
                  <button type="button" onClick={() => removeVariant(variant.id)} className="btn-ghost px-2.5 text-red-500 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="alert-error">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : product ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdminProducts({ token }) {
  const { show } = useToast()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [groupTab, setGroupTab] = useState('gas_services')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [formTarget, setFormTarget] = useState(null) // null closed, {} create, product edit
  const [togglingId, setTogglingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchProducts = async () => {
    try {
      const response = await apiFetch('/admin/products', { token })

      if (!response.ok) {
        setError('Could not load products.')
        return
      }

      setProducts(await response.json())
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => p.group === groupTab)
      .filter((p) => categoryFilter === 'all' || p.category === categoryFilter)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [products, groupTab, categoryFilter])

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const visibleProducts = useMemo(
    () => paginate(filteredProducts, Math.min(page, pageCount), pageSize),
    [filteredProducts, page, pageCount, pageSize]
  )

  const toggleActive = async (product) => {
    setTogglingId(product.id)

    try {
      const formData = new FormData()
      formData.append('is_active', product.is_active ? '0' : '1')

      const response = await apiFetch(`/admin/products/${product.id}`, { method: 'POST', token, body: formData })

      if (!response.ok) {
        show('Could not update this product.', { type: 'error' })
        return
      }

      const updated = await response.json()
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      const response = await apiFetch(`/admin/products/${deleteTarget.id}`, { method: 'DELETE', token })

      if (!response.ok) {
        show('Could not remove this product.', { type: 'error' })
        return
      }

      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setDeleteTarget(null)
      show('Product removed.', { type: 'success' })
    } catch {
      show('Could not reach the server.', { type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Products"
        subtitle="Gas Services and Eazy Market catalog items — price, image, and active status."
        icon={Package}
        action={
          <button onClick={() => setFormTarget({})} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add Product
          </button>
        }
      />

      <div className="mb-6 inline-flex rounded-lg bg-brand-bg p-1" role="radiogroup" aria-label="Product group">
        {GROUP_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="radio"
            aria-checked={groupTab === tab.value}
            onClick={() => {
              setGroupTab(tab.value)
              setCategoryFilter('all')
              setPage(1)
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              groupTab === tab.value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value)
            setPage(1)
          }}
          className="filter-field sm:w-64"
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS[groupTab]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
          Showing {filteredProducts.length} of {products.filter((p) => p.group === groupTab).length}
        </span>
      </div>

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && filteredProducts.length === 0 && !error && (
        <EmptyState icon={groupTab === 'gas_services' ? Package : ShoppingBasket} title="No products yet" description="Add one above to start building this catalog." />
      )}

      {!loading && filteredProducts.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product) => (
              <div key={product.id} className="card flex flex-col p-4">
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />
                ) : (
                  <div className="mb-3 flex h-32 w-full items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                    No image
                  </div>
                )}

                <span className="eyebrow mb-1">{CATEGORY_LABELS[product.group][product.category] || product.category}</span>
                <p className="truncate font-medium text-brand-navy">{product.name}</p>
                <p className="figure mt-1 text-sm text-slate-600">
                  {product.variants?.length > 0
                    ? `${product.variants.length} variant${product.variants.length === 1 ? '' : 's'} from ${formatNaira(Math.min(...product.variants.map((v) => Number(v.price))))}`
                    : formatNaira(product.price)}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(product)}
                    disabled={togglingId === product.id}
                    className={`flex-1 ${product.is_active ? 'btn-outline' : 'btn-primary'} !py-1.5 text-xs`}
                  >
                    {togglingId === product.id ? '…' : product.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => setFormTarget(product)} className="btn-ghost px-2.5">
                    <Pencil className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(product)}
                    className="btn-ghost px-2.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <PaginationControls
            page={Math.min(page, pageCount)}
            pageSize={pageSize}
            total={filteredProducts.length}
            onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
            onPageSizeChange={(next) => {
              setPageSize(next)
              setPage(1)
            }}
          />
        </>
      )}

      <ProductFormDialog
        open={!!formTarget}
        group={groupTab}
        product={formTarget && formTarget.id ? formTarget : null}
        token={token}
        onClose={() => setFormTarget(null)}
        onSaved={() => {
          setFormTarget(null)
          fetchProducts()
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ''}
        message="This removes the product and any variants it has. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default AdminProducts
