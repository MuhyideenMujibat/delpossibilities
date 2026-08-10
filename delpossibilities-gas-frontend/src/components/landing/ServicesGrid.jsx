import { useReducedMotion } from 'motion/react'
import { Truck, Droplets, Wrench, ShieldCheck, MapPin } from 'lucide-react'
import Reveal, { RevealItem } from '../motion/Reveal'

const SERVICES = [
  {
    icon: Truck,
    title: 'Doorstep Pickup & Delivery',
    description: 'Drop off your empty cylinder and get it refilled without leaving your hostel.',
    flagship: true,
  },
  {
    icon: Droplets,
    title: 'Free Cylinder Cleaning',
    description: 'Every cylinder is cleaned before it comes back to you, at no extra cost.',
  },
  {
    icon: Wrench,
    title: 'Free Cylinder Servicing',
    description: 'Valves and seals are checked and serviced on every refill run.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Online Payment',
    description: 'Pay for your order safely online, no cash handling required.',
  },
  {
    icon: MapPin,
    title: 'Real-Time Order Tracking',
    description: 'Follow your order from pending to delivered right from your dashboard.',
  },
]

function ServicesGrid() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center font-heading text-2xl font-semibold text-brand-navy sm:text-3xl">
          Our Services
        </h2>

        <Reveal
          as="div"
          stagger
          staggerDelay={0.1}
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SERVICES.map((service) => (
            <RevealItem
              key={service.title}
              whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`card group border-transparent transition-colors hover:border-brand-teal/30 hover:shadow-md ${
                service.flagship ? 'sm:col-span-2 lg:col-span-2' : ''
              }`}
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal transition-colors group-hover:bg-brand-teal group-hover:text-white">
                <service.icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-heading text-base font-semibold text-brand-navy">{service.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{service.description}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

export default ServicesGrid
