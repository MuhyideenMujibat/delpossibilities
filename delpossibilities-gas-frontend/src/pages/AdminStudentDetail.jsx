import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, Home, PackageSearch, Package, Wallet, Clock } from 'lucide-react'
import { apiFetch, formatNaira, formatDate, STATUS_LABELS } from '../api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../StatusBadge'

function AdminStudentDetail({ token }) {
  const { id } = useParams()
  const [student, setStudent] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/admin/students/${id}`, { token })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setStudent)
      .catch(() => setError('Could not load this student.'))
      .finally(() => setLoading(false))
  }, [id, token])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="skeleton h-64 w-full" />
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState
          icon={PackageSearch}
          title="Student not found"
          description={error || "This account doesn't exist."}
          action={
            <Link to="/admin/people?tab=students" className="btn-primary mt-2">
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Back to Students
            </Link>
          }
        />
      </div>
    )
  }

  const orders = student.orders || []
  const totalSpent = orders
    .filter((o) => ['approved', 'picked_up', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  const pendingCount = orders.filter((o) => o.status === 'pending').length

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Student"
        title={student.name}
        subtitle={`Joined ${formatDate(student.created_at)}`}
        action={
          <Link to="/admin/people?tab=students" className="btn-outline">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            All Students
          </Link>
        }
      />

      <div className="card mb-6">
        <div className="flex flex-col gap-2.5 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
            {student.email}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
            {student.phone || '—'}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Home className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
            {student.hostel || '—'}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Orders" value={orders.length} icon={Package} tone="navy" />
        <StatCard label="Total Spent" value={formatNaira(totalSpent)} icon={Wallet} tone="teal" hint="Across paid orders" />
        <StatCard label="Awaiting Payment" value={pendingCount} icon={Clock} tone="amber" />
      </div>

      <h3 className="mb-4 font-heading text-base font-bold text-brand-navy">Order History</h3>

      {orders.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No orders yet" description="This student hasn't placed any orders." />
      ) : (
        <>
          <div className="table-card hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th-cell">Kg</th>
                  <th className="th-cell">Hostel (this order)</th>
                  <th className="th-cell">Total</th>
                  <th className="th-cell">Status</th>
                  <th className="th-cell">Placed</th>
                  <th className="th-cell">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="figure px-4 py-3 font-medium text-brand-navy">{order.kg} kg</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">{order.hostel_address}</td>
                    <td className="figure px-4 py-3 font-medium text-brand-navy">{formatNaira(order.total_amount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatDate(order.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{order.paid_at ? formatDate(order.paid_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="figure text-base font-semibold text-brand-navy">{order.kg} kg</span>
                  <StatusBadge status={order.status} label={STATUS_LABELS[order.status] || order.status} />
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{order.hostel_address}</p>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span className="figure font-medium">{formatNaira(order.total_amount)}</span>
                  <span className="text-xs text-slate-400">{formatDate(order.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default AdminStudentDetail
