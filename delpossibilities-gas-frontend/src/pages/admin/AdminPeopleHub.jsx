import { Users, UserPlus, Briefcase, Layers, ShieldCheck, Award } from 'lucide-react'
import AdminHubTabs from './AdminHubTabs'
import { useHubTab } from './useHubTab'
import AdminStudents from '../AdminStudents'
import AdminAmbassadors from '../AdminAmbassadors'
import AdminUsers from '../AdminUsers'
import AdminStaff from '../AdminStaff'
import AdminUserTypes from '../AdminUserTypes'
import AdminPermissions from '../AdminPermissions'

// People hub — Students + Ambassadors + Add User (all `manage_students`)
// plus the super-admin-only Staff / User Types / Permissions pages. A
// regular admin with `manage_students` reaches the hub (route guard) and
// sees just the first three tabs; a super admin sees all six.
export default function AdminPeopleHub({ token, isSuperAdmin, can }) {
  const tabs = [
    { slug: 'students', label: 'Students', icon: Users, show: can('manage_students'), render: () => <AdminStudents token={token} /> },
    { slug: 'ambassadors', label: 'Ambassadors', icon: Award, show: can('manage_students'), render: () => <AdminAmbassadors token={token} /> },
    { slug: 'add-user', label: 'Add User', icon: UserPlus, show: can('manage_students'), render: () => <AdminUsers token={token} isSuperAdmin={isSuperAdmin} /> },
    { slug: 'staff', label: 'Staff', icon: Briefcase, show: isSuperAdmin, render: () => <AdminStaff token={token} /> },
    { slug: 'user-types', label: 'User Types', icon: Layers, show: isSuperAdmin, render: () => <AdminUserTypes token={token} /> },
    { slug: 'permissions', label: 'Permissions', icon: ShieldCheck, show: isSuperAdmin, render: () => <AdminPermissions token={token} /> },
  ].filter((t) => t.show)

  const { active, setTab } = useHubTab(tabs)

  return (
    <div>
      <AdminHubTabs tabs={tabs} activeSlug={active?.slug} onSelect={setTab} />
      {active?.render()}
    </div>
  )
}
