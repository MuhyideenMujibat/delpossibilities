import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CalendarCheck, Search, X } from 'lucide-react'
import { apiFetch, formatNaira } from '../api'
import { publicFetch } from '../publicData'

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }
const PACKAGE_LABELS = { session: 'Session', semester: 'Semester' }

// Lets an admin hand a student a fully-active subscription without a real
// payment — see AdminSubscriberController::store. Opened from
// AdminSubscribers.jsx's "Add Subscriber" button.
// Mirrors the backend's Subscriber::scopeUsable: active, kg left, not past
// its end date. Only a usable one blocks a new subscription.
function isUsable(subscriber) {
  if (subscriber.status !== 'active') return false
  if (Number(subscriber.remaining_kg ?? 0) <= 0) return false
  return !subscriber.ends_at || new Date(subscriber.ends_at).getTime() >= Date.now()
}

function AddSubscriberModal({ open, onClose, token, onCreated, subscribers = [] }) {
  const [students, setStudents] = useState([])
  const [plans, setPlans] = useState([])
  const [studentQuery, setStudentQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [planId, setPlanId] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [showRecipientFields, setShowRecipientFields] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return

    setError('')
    apiFetch('/admin/students', { token })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => {})

    publicFetch('/subscription-plans')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [open, token])

  const matchingStudents = useMemo(() => {
    const term = studentQuery.trim().toLowerCase()
    if (!term) return []
    return students
      .filter((s) => `${s.name} ${s.email} ${s.customer_id || ''}`.toLowerCase().includes(term))
      .slice(0, 8)
  }, [students, studentQuery])

  // The subscriber list is already loaded by the parent page, so this check
  // is instant; the backend enforces the same rule if the list is stale.
  const existingSubscription = useMemo(
    () => (selectedStudent ? subscribers.find((s) => s.user_id === selectedStudent.id && isUsable(s)) : null),
    [subscribers, selectedStudent]
  )

  if (!open) return null

  const reset = () => {
    setStudentQuery('')
    setSelectedStudent(null)
    setPlanId('')
    setRecipientName('')
    setRecipientPhone('')
    setRecipientAddress('')
    setShowRecipientFields(false)
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (existingSubscription) return

    if (!selectedStudent) {
      setError('Pick a student first.')
      return
    }
    if (!planId) {
      setError('Pick a plan.')
      return
    }

    setSubmitting(true)

    try {
      const response = await apiFetch('/admin/subscribers', {
        method: 'POST',
        token,
        body: {
          user_id: selectedStudent.id,
          subscription_plan_id: Number(planId),
          recipient_name: recipientName || undefined,
          recipient_phone: recipientPhone || undefined,
          recipient_address: recipientAddress || undefined,
        },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null
        setError(firstError || data?.message || 'Could not create this subscriber.')
        return
      }

      onCreated?.(data)
      handleClose()
    } catch {
      setError('Check your internet connection.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={submitting ? undefined : handleClose} aria-hidden="true" />

      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={submitting}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
            <CalendarCheck className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="font-heading text-base font-bold text-brand-navy">Add Subscriber</h3>
            <p className="mt-1 text-sm text-slate-500">
              Activates immediately — no payment needed, same as a real purchase.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="label-text" htmlFor="student-search">Student</label>
          {selectedStudent ? (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="truncate">{selectedStudent.name} — {selectedStudent.email}</span>
              <button type="button" onClick={() => setSelectedStudent(null)} className="ml-2 flex-shrink-0 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
              <input
                id="student-search"
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Search by name, email, or customer ID…"
                className="input-field pl-9"
                autoComplete="off"
              />
              {matchingStudents.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                  {matchingStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudent(s)
                        setStudentQuery('')
                      }}
                      className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {s.name} — {s.email}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="label-text" htmlFor="plan-select">Plan</label>
          <select id="plan-select" value={planId} onChange={(e) => setPlanId(e.target.value)} className="input-field">
            <option value="">Select a plan…</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {TIER_LABELS[plan.tier] || plan.tier} · {PACKAGE_LABELS[plan.package_type] || plan.package_type} — {formatNaira(plan.price)} ({plan.cylinder_kg}kg)
              </option>
            ))}
          </select>
        </div>

        {!showRecipientFields ? (
          <button type="button" onClick={() => setShowRecipientFields(true)} className="mb-4 text-sm text-brand-teal hover:underline">
            Set delivery recipient details (defaults to the student's own profile)
          </button>
        ) : (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
            <input type="text" placeholder="Recipient name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="input-field" />
            <input type="text" placeholder="Recipient phone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="input-field" />
            <input type="text" placeholder="Recipient address / hostel" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} className="input-field" />
          </div>
        )}

        {existingSubscription && (
          <p className="alert-error mb-4">
            {selectedStudent.name} already has an active subscription
            {existingSubscription.plan
              ? ` (${TIER_LABELS[existingSubscription.plan.tier] || existingSubscription.plan.tier} · ${PACKAGE_LABELS[existingSubscription.plan.package_type] || existingSubscription.plan.package_type}, ${Number(existingSubscription.remaining_kg)}kg left)`
              : ''}
            , so you can't add another. Cancel it first, or wait until it's used up or expires.
          </p>
        )}

        {error && <p className="alert-error mb-4">{error}</p>}

        <button type="submit" disabled={submitting || !!existingSubscription} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? 'Creating…' : 'Create & Activate'}
        </button>
      </form>
    </div>,
    document.body
  )
}

export default AddSubscriberModal
