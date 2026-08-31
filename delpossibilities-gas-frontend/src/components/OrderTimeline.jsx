import { Check, Clock } from 'lucide-react'
import { TIMELINE_STEPS, stepIndexForStatus } from '../orderStatus'

function StepMarker({ isDone, isNext }) {
  if (isDone) {
    return (
      <span className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand-teal bg-brand-teal text-white">
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
    )
  }

  if (isNext) {
    return (
      <span className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand-ember bg-white text-brand-ember">
        <Clock className="h-4 w-4" strokeWidth={2} />
      </span>
    )
  }

  return <span className="relative z-10 h-8 w-8 flex-shrink-0 rounded-full border-2 border-slate-200 bg-white" />
}

// `layout="vertical"` (default) is for the order-detail page — full labels
// and hints. `layout="horizontal"` is a compact strip used on the landing
// page's tracking preview.
function OrderTimeline({ status, layout = 'vertical', className = '' }) {
  const doneThrough = stepIndexForStatus(status)

  if (layout === 'horizontal') {
    return (
      <ol className={`flex items-start ${className}`}>
        {TIMELINE_STEPS.map((step, index) => {
          const isDone = index <= doneThrough
          const isNext = index === doneThrough + 1 && doneThrough < TIMELINE_STEPS.length - 1
          const isLast = index === TIMELINE_STEPS.length - 1

          return (
            <li key={step.key} className="relative flex flex-1 flex-col items-center text-center">
              {!isLast && (
                <span
                  className={`absolute left-1/2 top-4 h-0.5 w-full ${index < doneThrough ? 'bg-brand-teal' : 'bg-slate-200'}`}
                  aria-hidden="true"
                />
              )}
              <StepMarker isDone={isDone} isNext={isNext} />
              <p className={`mt-2 max-w-[6rem] text-xs font-semibold ${isDone || isNext ? 'text-brand-navy' : 'text-slate-400'}`}>
                {step.label}
              </p>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className={className}>
      {TIMELINE_STEPS.map((step, index) => {
        const isDone = index <= doneThrough
        const isNext = index === doneThrough + 1 && doneThrough < TIMELINE_STEPS.length - 1
        const isLast = index === TIMELINE_STEPS.length - 1

        return (
          <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5 ${index < doneThrough ? 'bg-brand-teal' : 'bg-slate-200'}`}
                aria-hidden="true"
              />
            )}
            <StepMarker isDone={isDone} isNext={isNext} />
            <div className="pt-0.5">
              <p className={`font-heading text-sm font-bold ${isDone || isNext ? 'text-brand-navy' : 'text-slate-400'}`}>{step.label}</p>
              <p className={`mt-0.5 text-xs ${isDone || isNext ? 'text-slate-500' : 'text-slate-300'}`}>{step.hint}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default OrderTimeline
