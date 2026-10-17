import { useState, useEffect, useMemo } from 'react'
import { Users, Search, Trash2, UserPlus, Crown, Gem } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, formatDate } from '../api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import PaginationControls from '../components/PaginationControls'
import { paginate } from '../pagination'

// VIP: amber crown (free delivery only). VVIP: violet gem (free delivery +
// free gas cost) — visually distinct so an admin can tell the two apart at
// a glance in the table/card list.
function MembershipBadge({ tier }) {
  if (tier === 'vvip') return <Gem className="h-3.5 w-3.5 flex-shrink-0 text-violet-500" strokeWidth={2} aria-label="VVIP" />
  if (tier === 'vip') return <Crown className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" strokeWidth={2} aria-label="VIP" />
  return null
}

function AdminStudents({ token }) {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchStudents = async () => {
    try {
      const response = await apiFetch('/admin/students', { token })

      if (!response.ok) {
        setError('Could not load students.')
        return
      }

      const data = await response.json()
      setStudents(Array.isArray(data) ? data : data.data || [])
      setError('')
    } catch {
      setError('Check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return students
    return students.filter((student) =>
      `${student.name} ${student.email} ${student.hostel || ''}`.toLowerCase().includes(term)
    )
  }, [students, search])

  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / pageSize))
  const visibleStudents = useMemo(
    () => paginate(filteredStudents, Math.min(page, pageCount), pageSize),
    [filteredStudents, page, pageCount, pageSize]
  )

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      const response = await apiFetch(`/admin/students/${deleteTarget.id}`, { method: 'DELETE', token })

      if (!response.ok) {
        setError('Could not remove this student.')
        return
      }

      setStudents((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setError('Check your internet connection.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Students"
        subtitle="Everyone registered as a student, in one list."
        icon={Users}
        action={
          <Link to="/admin/people?tab=add-user" className="btn-primary">
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Add User
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total Students" value={students.length} icon={Users} tone="navy" />
      </div>

      {error && <p className="alert-error mb-6">{error}</p>}


      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && students.length === 0 && !error && (
        <EmptyState icon={Users} title="No students yet" description="Students who register or are added by an admin will show up here." />
      )}

      {!loading && students.length > 0 && (
        <>
          <div className="filter-bar">
            <div className="relative flex-1 sm:min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search by name, email, or hostel…"
                className="filter-field pl-9"
              />
            </div>
            <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
              Showing {filteredStudents.length} of {students.length}
            </span>
          </div>

          {visibleStudents.length === 0 && (
            <EmptyState icon={Search} title="No students match your search" description="Try a different name, email, or hostel." />
          )}

          {visibleStudents.length > 0 && (
            <>
              <div className="table-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th-cell">#</th>
                      <th className="th-cell">Name</th>
                      <th className="th-cell">Email</th>
                      <th className="th-cell">Hostel</th>
                      <th className="th-cell">Phone</th>
                      <th className="th-cell">Orders</th>
                      <th className="th-cell">Joined</th>
                      <th className="th-cell"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleStudents.map((student, index) => (
                      <tr
                        key={student.id}
                        onClick={() => navigate(`/admin/students/${student.id}`)}
                        className="cursor-pointer hover:bg-slate-50/70"
                      >
                        <td className="figure px-4 py-3 text-slate-400">{(page - 1) * pageSize + index + 1}</td>
                        <td className="max-w-[160px] truncate px-4 py-3 font-medium text-brand-navy">
                          <span className="inline-flex items-center gap-1.5">
                            {student.name}
                            <MembershipBadge tier={student.membership_tier} />
                          </span>
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">{student.email}</td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">{student.hostel || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{student.phone || '—'}</td>
                        <td className="figure px-4 py-3 text-slate-600">{student.orders_count ?? 0}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatDate(student.created_at)}</td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setDeleteTarget(student)}
                            aria-label={`Remove ${student.name}`}
                            className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* table-card is desktop-only (hidden md:block) — this card
                  stack is the phone view of the same rows. */}
              <div className="flex flex-col gap-3 md:hidden">
                {visibleStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => navigate(`/admin/students/${student.id}`)}
                    className="cursor-pointer rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate font-medium text-brand-navy">
                          {student.name}
                          <MembershipBadge tier={student.membership_tier} />
                        </p>
                        <p className="truncate text-xs text-slate-400">{student.email}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(student)
                        }}
                        aria-label={`Remove ${student.name}`}
                        className="btn-ghost flex-shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="text-slate-400">Hostel</span>
                      <span className="truncate text-right">{student.hostel || '—'}</span>
                      <span className="text-slate-400">Phone</span>
                      <span className="text-right">
                        {student.phone ? (
                          <a
                            href={`tel:${student.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-brand-teal hover:underline"
                          >
                            {student.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </span>
                      <span className="text-slate-400">Orders</span>
                      <span className="figure text-right">{student.orders_count ?? 0}</span>
                      <span className="text-slate-400">Joined</span>
                      <span className="text-right text-xs text-slate-400">{formatDate(student.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <PaginationControls
                page={Math.min(page, pageCount)}
                pageSize={pageSize}
                total={filteredStudents.length}
                onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
                onPageSizeChange={(next) => {
                  setPageSize(next)
                  setPage(1)
                }}
              />
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Remove ${deleteTarget.name}?` : ''}
        message="This deletes their account and their entire order history. This can't be undone."
        confirmLabel="Delete Student"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default AdminStudents
