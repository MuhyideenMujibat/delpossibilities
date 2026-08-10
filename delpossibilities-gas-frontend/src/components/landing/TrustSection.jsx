import { ShieldCheck, Clock, MapPin, Sparkles } from 'lucide-react'
import Reveal, { RevealItem } from '../motion/Reveal'

const REASONS = [
  {
    icon: ShieldCheck,
    title: 'Secure Payments',
    description: 'Pay online safely for every order, no cash handling.',
  },
  {
    icon: Clock,
    title: 'Open 24 Hours',
    description: 'Order any time of day or night, we’re always available.',
  },
  {
    icon: MapPin,
    title: 'Real-Time Tracking',
    description: 'Follow your order from pending to delivered.',
  },
  {
    icon: Sparkles,
    title: 'Free Cleaning & Servicing',
    description: 'Every cylinder comes back cleaned and checked.',
  },
]

function TrustSection() {
  return (
    <section className="bg-brand-bg">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center font-heading text-2xl font-semibold text-brand-navy sm:text-3xl">
          Why Students Trust Us
        </h2>

        <Reveal
          as="div"
          stagger
          staggerDelay={0.1}
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {REASONS.map((reason) => (
            <RevealItem key={reason.title} className="flex flex-col items-center text-center" y={12} duration={0.4}>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-white">
                <reason.icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h3 className="mt-3 font-heading text-sm font-semibold text-brand-navy">{reason.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{reason.description}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

export default TrustSection
