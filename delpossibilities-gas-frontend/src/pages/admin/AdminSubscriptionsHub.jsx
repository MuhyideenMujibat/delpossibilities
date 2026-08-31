import { CalendarCheck, Droplets, CircleDollarSign } from 'lucide-react'
import AdminHubTabs from './AdminHubTabs'
import { useHubTab } from './useHubTab'
import AdminSubscribers from '../AdminSubscribers'
import AdminRefills from '../AdminRefills'
import AdminSubscriptionPlans from '../AdminSubscriptionPlans'

// Subscriptions hub — Subscribers + Refills + Plan Pricing. All three sat
// behind `manage_subscriptions` before and still do (the route guard checks
// it); Plan Pricing renders read-only for a non-super admin on its own.
export default function AdminSubscriptionsHub({ token, isSuperAdmin }) {
  const tabs = [
    { slug: 'subscribers', label: 'Subscribers', icon: CalendarCheck },
    { slug: 'refills', label: 'Refills', icon: Droplets },
    { slug: 'plans', label: 'Plan Pricing', icon: CircleDollarSign },
  ]
  const { active, setTab } = useHubTab(tabs)

  return (
    <div>
      <AdminHubTabs tabs={tabs} activeSlug={active?.slug} onSelect={setTab} />
      {active?.slug === 'refills' && <AdminRefills token={token} />}
      {active?.slug === 'plans' && <AdminSubscriptionPlans token={token} isSuperAdmin={isSuperAdmin} />}
      {active?.slug === 'subscribers' && <AdminSubscribers token={token} />}
    </div>
  )
}
