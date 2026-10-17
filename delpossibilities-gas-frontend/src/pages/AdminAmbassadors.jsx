import { useState, useEffect, useMemo } from 'react'
import { Award, BadgeCheck, Users } from 'lucide-react'
import { apiFetch, formatNaira } from '../api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import PaginationControls from '../components/PaginationControls'
import { paginate } from '../pagination'

// Every student with at least one successful referral, ranked by how many
// friends they've referred — the same ordering the backend already applies
// (see AdminReferralController::index) — so the admin can read straight
// down the list to pick who becomes the official Brand Ambassador. That's
// now a manual call (this page's toggle), not auto-granted on hitting the
// 3kg milestone — see User::checkReferralCycleCompletion.
function AdminAmbassadors({ token }) {
  const [referrers, setReferrers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  const fetchReferrers = async () => {
    try {
      const response = await apiFetch('/admin/referrals', { token })

      if (!response.ok) {
        setError('Could not load referrers.')
        return
      }

      const data = await response.json()
      setReferrers(Array.isArray(data) ? data : [])
      setError('')
    } catch {
      setError('Check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReferrers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const pageCount = Math.max(1, Math.ceil(referrers.length / pageSize))
  const visibleReferrers = useMemo(
    () => paginate(referrers, Math.min(page, pageCount), pageSize),
    [referrers, page, pageCount]
  )

  const ambassadorCount = referrers.filter((r) => r.is_brand_ambassador).length

  const setAmbassador = async (user, value) => {
    setUpdatingId(user.id)

    try {
      const response = await apiFetch(`/admin/referrals/${user.id}/ambassador`, {
        method: 'PATCH',
        token,
        body: { is_brand_ambassador: value },
      })

      if (!response.ok) {
        setError('Could not update Ambassador status.')
        return
      }

      const updated = await response.json()
      setReferrers((prev) => prev.map((r) => (r.id === user.id ? { ...r, ...updated } : r)))
      setRevokeTarget(null)
    } catch {
      setError('Check your internet connection.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Ambassadors"
        subtitle="Referrers ranked by how many friends they've brought in — pick the official Brand Ambassador from here."
        icon={Award}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Successful Referrers" value={referrers.length} icon={Users} tone="navy" />
        <StatCard label="Current Ambassadors" value={ambassadorCount} icon={BadgeCheck} tone="teal" />
      </div>

      {error && <p className="alert-error mb-6">{error}</p>}


      {loading && <div className="skeleton h-64 w-full" />}

      {!loading && referrers.length === 0 && !error && (
        <EmptyState
          icon={Award}
          title="No successful referrals yet"
          description="Students will show up here once someone they referred pays for a gas order or subscription refill."
        />
      )}

      {!loading && visibleReferrers.length > 0 && (
        <>
          <div className="table-card hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th-cell">#</th>
                  <th className="th-cell">Name</th>
                  <th className="th-cell">Friends Referred</th>
                  <th className="th-cell">Kg Earned</th>
                  <th className="th-cell">Commission</th>
                  <th className="th-cell">Cylinders Earned</th>
                  <th className="th-cell">Ambassador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleReferrers.map((referrer, index) => (
                  <tr key={referrer.id}>
                    <td className="figure px-4 py-3 text-slate-400">{(page - 1) * pageSize + index + 1}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-medium text-brand-navy">
                      {referrer.name}
                      <span className="ml-1.5 font-mono text-xs text-slate-400">{referrer.customer_id}</span>
                    </td>
                    <td className="figure px-4 py-3 text-slate-600">{referrer.referred_count}</td>
                    <td className="figure px-4 py-3 text-slate-600">{Number(referrer.referred_kg).toFixed(1)}kg</td>
                    <td className="figure px-4 py-3 text-slate-600">{formatNaira(referrer.referral_commission_balance)}</td>
                    <td className="figure px-4 py-3 text-slate-600">{referrer.cylinders_earned}</td>
                    <td className="px-4 py-3">
                      {referrer.is_brand_ambassador ? (
                        <button
                          onClick={() => setRevokeTarget(referrer)}
                          disabled={updatingId === referrer.id}
                          className="btn-outline"
                        >
                          <BadgeCheck className="h-4 w-4 text-brand-teal" strokeWidth={2} />
                          Ambassador
                        </button>
                      ) : (
                        <button
                          onClick={() => setAmbassador(referrer, true)}
                          disabled={updatingId === referrer.id}
                          className="btn-primary"
                        >
                          {updatingId === referrer.id ? 'Saving…' : 'Make Ambassador'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {visibleReferrers.map((referrer, index) => (
              <div key={referrer.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">#{(page - 1) * pageSize + index + 1}</p>
                    <p className="truncate font-medium text-brand-navy">{referrer.name}</p>
                    <p className="truncate font-mono text-xs text-slate-400">{referrer.customer_id}</p>
                  </div>
                  {referrer.is_brand_ambassador && <BadgeCheck className="h-5 w-5 flex-shrink-0 text-brand-teal" strokeWidth={2} />}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span className="text-slate-400">Friends referred</span>
                  <span className="figure text-right">{referrer.referred_count}</span>
                  <span className="text-slate-400">Kg earned</span>
                  <span className="figure text-right">{Number(referrer.referred_kg).toFixed(1)}kg</span>
                  <span className="text-slate-400">Commission</span>
                  <span className="figure text-right">{formatNaira(referrer.referral_commission_balance)}</span>
                  <span className="text-slate-400">Cylinders earned</span>
                  <span className="figure text-right">{referrer.cylinders_earned}</span>
                </div>
                <div className="mt-3">
                  {referrer.is_brand_ambassador ? (
                    <button
                      onClick={() => setRevokeTarget(referrer)}
                      disabled={updatingId === referrer.id}
                      className="btn-outline w-full"
                    >
                      Ambassador — tap to revoke
                    </button>
                  ) : (
                    <button
                      onClick={() => setAmbassador(referrer, true)}
                      disabled={updatingId === referrer.id}
                      className="btn-primary w-full"
                    >
                      {updatingId === referrer.id ? 'Saving…' : 'Make Ambassador'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <PaginationControls
            page={Math.min(page, pageCount)}
            pageSize={pageSize}
            total={referrers.length}
            onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
            onPageSizeChange={(next) => {
              setPageSize(next)
              setPage(1)
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        title={revokeTarget ? `Revoke ${revokeTarget.name}'s Ambassador status?` : ''}
        message="They'll stop being listed as an official Brand Ambassador. Their referral stats aren't affected."
        confirmLabel="Revoke"
        tone="danger"
        busy={updatingId === revokeTarget?.id}
        onConfirm={() => setAmbassador(revokeTarget, false)}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  )
}

export default AdminAmbassadors
