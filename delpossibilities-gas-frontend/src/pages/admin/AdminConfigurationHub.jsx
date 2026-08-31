import { Tag, ShoppingBag, Building2, Truck } from 'lucide-react'
import AdminHubTabs from './AdminHubTabs'
import { useHubTab } from './useHubTab'
import AdminSettings from '../AdminSettings'
import AdminProducts from '../AdminProducts'
import AdminHostels from '../AdminHostels'
import AdminDeliverySettings from '../AdminDeliverySettings'

// Configuration hub — Price Settings (`manage_settings`) plus the
// super-admin-only Products / Hostels / Delivery Settings pages. A regular
// admin with `manage_settings` sees only the first tab.
export default function AdminConfigurationHub({ token, isSuperAdmin, can }) {
  const tabs = [
    { slug: 'price', label: 'Price Settings', icon: Tag, show: can('manage_settings'), render: () => <AdminSettings token={token} /> },
    { slug: 'products', label: 'Products', icon: ShoppingBag, show: isSuperAdmin, render: () => <AdminProducts token={token} /> },
    { slug: 'hostels', label: 'Hostels', icon: Building2, show: isSuperAdmin, render: () => <AdminHostels token={token} /> },
    { slug: 'delivery', label: 'Delivery Settings', icon: Truck, show: isSuperAdmin, render: () => <AdminDeliverySettings token={token} /> },
  ].filter((t) => t.show)

  const { active, setTab } = useHubTab(tabs)

  return (
    <div>
      <AdminHubTabs tabs={tabs} activeSlug={active?.slug} onSelect={setTab} />
      {active?.render()}
    </div>
  )
}
