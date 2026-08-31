import Reveal from '../motion/Reveal'
import Gauge from '../Gauge'
import logo from '../../assets/delpossibilitiesprofile.jpeg'

const MAX_WIDTH = { sm: 'max-w-sm', md: 'max-w-lg' }

const FEATURES = [
  'Order a refill in under a minute',
  'Pay securely online with Paystack',
  'Track pickup, refill, and delivery live',
]

function AuthLayout({ title, description, maxWidth = 'sm', onSubmit, success, error, children, footer }) {
  return (
    <div className="-m-4 flex min-h-screen flex-col sm:-m-6 md:-m-10 md:flex-row">
      <div className="relative hidden overflow-hidden bg-brand-navy px-10 py-12 md:flex md:w-[44%] md:flex-col md:justify-between lg:w-2/5 lg:px-14">
        <div>
          <div className="flex items-center gap-3">
            <img src={logo} alt="D'EL-Possibilities logo" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20" />
            <span className="font-heading text-sm font-semibold tracking-wide text-white">D&apos;EL-POSSIBILITIES</span>
          </div>

          <h1 className="mt-14 font-heading text-4xl font-black uppercase leading-[1.05] text-white lg:text-5xl">
            Full tank.
            <br />
            Zero queue.
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            Gas cylinder pickup, refill, and hostel delivery for Unilorin students — handled end to end.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-white/75">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-teal" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <Gauge className="relative mt-10" />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className={`w-full ${MAX_WIDTH[maxWidth]}`}>
          <Reveal className="mb-6 flex items-center justify-center gap-3 md:hidden" y={12}>
            <img src={logo} alt="D'EL-Possibilities logo" className="h-11 w-11 rounded-full object-cover shadow-sm" />
            <span className="font-heading text-base font-semibold text-brand-navy">D&apos;EL-POSSIBILITIES</span>
          </Reveal>

          <Reveal className="panel-card p-6 sm:p-8" delay={0.08}>
            <h2 className={`font-heading text-xl font-bold text-brand-navy ${description ? 'mb-1' : 'mb-6'}`}>{title}</h2>
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
