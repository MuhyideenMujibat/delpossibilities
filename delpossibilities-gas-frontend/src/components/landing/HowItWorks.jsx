import { Scale, ImagePlus, ShieldCheck, Truck } from 'lucide-react'
import Reveal, { RevealItem } from '../motion/Reveal'

const STEPS = [
  { icon: Scale, title: 'Enter your refill size', description: 'Tell us how many kg you need, pick a common size or enter your own.' },
  { icon: ImagePlus, title: 'Upload your cylinder', description: 'A quick photo so our riders know exactly what to pick up.' },
  { icon: ShieldCheck, title: 'Pay securely', description: 'Checkout with Paystack. Your payment is confirmed before we move.' },
  { icon: Truck, title: 'Get your gas delivered', description: 'We refill it and bring it straight back to your hostel door.' },
]

function HowItWorks() {
  return (
 <section id="how-it-works" className="bg-white">
  <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
    <div className="mx-auto max-w-2xl text-center">
      <p className="eyebrow">The process</p>

      <h2 className="mt-2 font-heading text-2xl font-bold text-brand-navy sm:text-3xl">
        How it works
      </h2>

      <p className="mt-3 text-base text-slate-600">
        Four steps 
        <span className="mx-2 font-semibold text-brand-teal">→</span>
        start to finish.
      </p>
    </div>

    <Reveal
      as="div"
      stagger
      staggerDelay={0.1}
      className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
    >
      {STEPS.map((step, index) => (
        <RevealItem key={step.title} className="relative">
          <div className="panel-card h-full p-6 pt-8">
            <span className="figure text-xs font-semibold text-slate-300">
              0{index + 1}
            </span>

            <div className="mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
              <step.icon
                className="h-5 w-5"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>

            <h3 className="mt-4 font-heading text-base font-bold text-brand-navy">
              {step.title}
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              {step.description}
            </p>
          </div>
        </RevealItem>
      ))}
    </Reveal>
  </div>
</section>
  )
}

export default HowItWorks
