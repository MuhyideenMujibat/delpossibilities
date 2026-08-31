import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Megaphone, X, Star, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '../api'

const TYPES = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'review', label: 'Review' },
]

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
      <motion.button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close feedback form' : 'Suggest something or leave a review'}
        animate={open ? { y: 0 } : { y: [0, -10, 0] }}
        transition={open ? { duration: 0.2 } : { duration: 0.9, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal text-white shadow-lg shadow-brand-teal/40 transition-colors hover:bg-brand-teal/90"
      >
        {open ? <X className="h-6 w-6" strokeWidth={2} /> : <Megaphone className="h-6 w-6" strokeWidth={2} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 right-5 z-50 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
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
