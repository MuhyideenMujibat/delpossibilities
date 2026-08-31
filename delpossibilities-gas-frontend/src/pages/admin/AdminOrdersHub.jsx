import { LayoutDashboard, ShoppingBag } from 'lucide-react'
import AdminHubTabs from './AdminHubTabs'
import { useHubTab } from './useHubTab'
import AdminDashboard from '../AdminDashboard'
import AdminShopOrders from '../AdminShopOrders'

// Orders hub — folds the former "Dashboard" and "Shop Orders" sidebar
// entries into one. Both need `manage_orders`, which the route guard has
// already checked, so both tabs always show here.
export default function AdminOrdersHub({ token, can }) {
  const tabs = [
    { slug: 'overview', label: 'Gas Orders', icon: LayoutDashboard },
    { slug: 'shop-orders', label: 'Shop Orders', icon: ShoppingBag },
  ]
  const { active, setTab } = useHubTab(tabs)

  return (
    <div>
      <AdminHubTabs tabs={tabs} activeSlug={active?.slug} onSelect={setTab} />
      {active?.slug === 'shop-orders' ? (
        <AdminShopOrders token={token} />
      ) : (
        <AdminDashboard token={token} canViewRefills={can('manage_subscriptions')} />
      )}
    </div>
  )
}
