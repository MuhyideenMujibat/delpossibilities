import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue } from 'motion/react'
import { Megaphone, X, Star, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '../api'

const TYPES = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'review', label: 'Review' },
]

// Remembers where the user dragged the button, per browser/device — so it
// doesn't snap back to the default corner (and, before this, sit on top of
// the mobile bottom tab bar's "You" link) on every visit.
const POSITION_STORAGE_KEY = 'delpossibilities:feedbackWidgetOffset'

const PLACEHOLDERS = {
  suggestion: "What should we add or improve?",
  review: 'How was your experience with D\'EL-Possibilities?',
}

function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          onClick={() => onChange(star)}
          className="p-0.5"
        >
          <Star
            className={`h-6 w-6 transition-colors ${star <= value ? 'fill-brand-ember text-brand-ember' : 'text-slate-300'}`}
            strokeWidth={1.8}
          />
        </button>
      ))}
    </div>
  )
}

// Floating button + popup form for quick suggestions/reviews — deliberately
// a plain form, not a chat thread: submissions go straight to the backend
// (see FeedbackSubmissionController) for the team to read later, no
// automated reply.
function FeedbackWidget({ token }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('suggestion')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [panelStyle, setPanelStyle] = useState(null)

  const buttonRef = useRef(null)
  const boundsRef = useRef(null)
  const draggedRef = useRef(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Restore a previously-dragged position on mount. Left at (0, 0) — the
  // button's default bottom-24/right-5 (mobile) or bottom-5/right-5
  // (desktop) spot — for a first-time visitor.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_STORAGE_KEY) || 'null')
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        x.set(saved.x)
        y.set(saved.y)
      }
    } catch {
      // Storage unavailable/corrupt — keep the default position.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Popup opens relative to wherever the button currently sits (it may have
  // been dragged anywhere on screen), flipping above/below and clamping
  // horizontally so it always stays fully on-screen.
  const positionPanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const margin = 12
    const panelWidth = Math.min(352, window.innerWidth - margin * 2)
    const left = Math.max(margin, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - margin))
    const spaceAbove = rect.top - margin
    const spaceBelow = window.innerHeight - rect.bottom - margin
    const openUpward = spaceAbove >= 320 || spaceAbove >= spaceBelow

    setPanelStyle(
      openUpward
        ? { left, width: panelWidth, bottom: window.innerHeight - rect.top + margin, maxHeight: spaceAbove }
        : { left, width: panelWidth, top: rect.bottom + margin, maxHeight: spaceBelow }
    )
  }

  useEffect(() => {
    if (!open) return
    const handle = () => positionPanel()
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [open])

  const toggleOpen = () => {
    // A drag ends with the same pointer-up that would otherwise register as
    // a tap — swallow exactly one of those so dragging the button never
    // also pops the form open.
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    setOpen((prev) => {
      const next = !prev
      if (next) positionPanel()
      return next
    })
  }

  const resetAndClose = () => {
    setOpen(false)
    setTimeout(() => {
      setSubmitted(false)
      setType('suggestion')
      setRating(0)
      setMessage('')
      setError('')
    }, 250)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim() || submitting) return

    setSubmitting(true)
    setError('')

    try {
      const response = await apiFetch('/feedback', {
        method: 'POST',
        token,
        body: {
          type,
          message: message.trim(),
          rating: type === 'review' && rating ? rating : undefined,
        },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message || 'Could not send this — please try again.')
        return
      }

      setSubmitted(true)
      setTimeout(resetAndClose, 2200)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Invisible drag boundary, inset from the viewport edges so the
          button can never be dragged fully off-screen or under the phone's
          system gesture bars. */}
      <div ref={boundsRef} className="pointer-events-none fixed inset-4 z-40" aria-hidden="true" />

      <motion.button
        ref={buttonRef}
        type="button"
        drag
        dragConstraints={boundsRef}
        dragMomentum={false}
        dragElastic={0}
        onDragStart={() => {
          draggedRef.current = true
        }}
        onDrag={() => {
          if (open) positionPanel()
        }}
        onDragEnd={() => {
          try {
            localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: x.get(), y: y.get() }))
          } catch {
            // Storage unavailable — the position just won't persist across visits.
          }
        }}
        onTap={toggleOpen}
        style={{ x, y }}
        aria-label={open ? 'Close feedback form' : 'Suggest something or leave a review — drag to move'}
        className="fixed bottom-24 right-5 z-50 flex h-14 w-14 touch-none items-center justify-center rounded-full bg-brand-teal text-white shadow-lg shadow-brand-teal/40 transition-colors hover:bg-brand-teal/90 md:bottom-5"
      >
        <motion.span
          animate={open ? {} : { y: [0, -8, 0] }}
          transition={{ duration: 0.9, repeat: open ? 0 : Infinity, repeatDelay: 3, ease: 'easeInOut' }}
          className="flex items-center justify-center"
        >
          {open ? <X className="h-6 w-6" strokeWidth={2} /> : <Megaphone className="h-6 w-6" strokeWidth={2} />}
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && panelStyle && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', ...panelStyle }}
            className="z-50 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between bg-brand-navy px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Suggest or Review</p>
                <p className="text-xs text-white/60">Tell us what's on your mind — we read every one.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" strokeWidth={1.6} />
                <p className="font-medium text-brand-navy">Thanks — got it!</p>
                <p className="text-sm text-slate-500">We appreciate you taking the time.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
                <div className="inline-flex w-fit rounded-lg bg-brand-bg p-1" role="radiogroup" aria-label="Feedback type">
                  {TYPES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={type === option.value}
                      onClick={() => setType(option.value)}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                        type === option.value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {type === 'review' && (
                  <div>
                    <label className="label-text">Rating</label>
                    <StarPicker value={rating} onChange={setRating} />
                  </div>
                )}

                <div>
                  <label className="label-text" htmlFor="feedback-message">
                    {type === 'review' ? 'Your review' : 'Your suggestion'}
                  </label>
                  <textarea
                    id="feedback-message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={PLACEHOLDERS[type]}
                    className="input-field resize-y text-sm"
                  />
                </div>

                {error && <p className="alert-error text-xs">{error}</p>}

                <button type="submit" disabled={!message.trim() || submitting} className="btn-primary w-full">
                  {submitting ? 'Sending…' : type === 'review' ? 'Submit Review' : 'Send Suggestion'}
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default FeedbackWidget
