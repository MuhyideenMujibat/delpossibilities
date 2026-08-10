import { motion, useReducedMotion } from 'motion/react'
import Reveal from '../motion/Reveal'
import logo from '../../assets/delpossibilitiesprofile.jpeg'

const MAX_WIDTH = { sm: 'max-w-sm', md: 'max-w-md' }

function AuthLayout({ title, description, maxWidth = 'sm', onSubmit, success, error, children, footer }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <motion.div
          className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand-teal/10 blur-3xl"
          animate={shouldReduceMotion ? undefined : { x: [0, 18, 0], y: [0, 12, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-24 right-[-4rem] h-72 w-72 rounded-full bg-brand-accent/10 blur-3xl"
          animate={shouldReduceMotion ? undefined : { x: [0, -16, 0], y: [0, -10, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className={`relative w-full ${MAX_WIDTH[maxWidth]}`}>
        <Reveal className="mb-8 flex flex-col items-center gap-3" y={12}>
          <img src={logo} alt="D'EL-Possibilities logo" className="h-16 w-16 rounded-full object-cover shadow-sm" />
          <h1 className="text-center text-xl font-semibold text-brand-navy">D&apos;EL-POSSIBILITIES</h1>
        </Reveal>

        <Reveal className="card" delay={0.08}>
          <h2 className={`text-lg font-semibold text-brand-navy ${description ? 'mb-1' : 'mb-6'}`}>{title}</h2>
          {description && <p className="mb-6 text-sm text-slate-500">{description}</p>}

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {success && <p className="alert-success">{success}</p>}
            {children}
            {error && <p className="alert-error">{error}</p>}
          </form>

          {footer && <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>}
        </Reveal>
      </div>
    </div>
  )
}

export function AuthField({ id, label, icon: Icon, labelExtra, type = 'text', ...inputProps }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label-text" htmlFor={id}>
          {label}
        </label>
        {labelExtra}
      </div>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        )}
        <input id={id} type={type} className={`input-field ${Icon ? 'pl-9' : ''}`} {...inputProps} />
      </div>
    </div>
  )
}

export default AuthLayout
