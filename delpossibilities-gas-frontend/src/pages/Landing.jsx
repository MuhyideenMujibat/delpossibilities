import { Link } from 'react-router-dom'
import { MessageCircle, Phone, Mail, MapPin, Wrench, ShoppingBasket } from 'lucide-react'
import TopNav from '../TopNav'
import logo from '../assets/delpossibilitiesprofile.jpeg'
import Hero from '../components/landing/Hero'
import HowItWorks from '../components/landing/HowItWorks'
import ServicesGrid from '../components/landing/ServicesGrid'
import PricingPreview from '../components/landing/PricingPreview'
import SubscriptionPreview from '../components/landing/SubscriptionPreview'
import ShopSection from '../components/landing/ShopSection'
import TrustSection from '../components/landing/TrustSection'
import InvestmentPreview from '../components/landing/InvestmentPreview'
import TrackingPreview from '../components/landing/TrackingPreview'

const GAS_SIZES = [
  { size: '3 kg', note: 'Portable cylinder' },
  // { size: '5 kg', note: 'Common student size' },
  { size: '6 kg', note: 'Common student size' },
  { size: '10 kg', note: 'Family-size cylinder' },
  { size: '12 kg', note: 'Full home cylinder' },
]

// `token`/`isAdmin` are passed through so a logged-in visitor viewing this
// public page gets the real "Apply to Invest" button in InvestmentPreview
// (not "Log in to invest"), the header shows a link back into the app
// instead of Log In / Register, and the "order" CTAs point at the app
// rather than bouncing through /register.
function Landing({ token, isAdmin }) {
  const orderCtaTo = token ? '/' : '/register'
  return (
    <div>
      <TopNav token={token} isAdmin={isAdmin} />

      <Hero orderCtaTo={orderCtaTo} />

      <section id="about" className="bg-brand-bg">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Who we are</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-brand-navy sm:text-4xl">No more carrying cylinders across campus</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
  D&apos;EL-Possibilities Nig Limited is based in Ilorin, Kwara State, proudly serving the University
  of Ilorin (Unilorin) student community. We take the stress out of gas cylinder refills by handling
  pickup, refilling, cleaning, and delivery.
</p>

<div className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-6">
  <span className="inline-flex items-center justify-center rounded-full border border-brand-teal/20 bg-brand-teal/5 px-3 py-1.5 text-sm font-medium text-brand-teal sm:col-span-2">
    ✓ Transparent pricing
  </span>

  <span className="inline-flex items-center justify-center rounded-full border border-brand-ember/20 bg-brand-ember/5 px-3 py-1.5 text-sm font-medium text-brand-ember sm:col-span-2">
    ✓ No unnecessary trips
  </span>

  <span className="inline-flex items-center justify-center rounded-full border border-brand-navy/15 bg-brand-navy/5 px-3 py-1.5 text-sm font-medium text-brand-navy sm:col-span-2">
    ✓ No heavy lifting
  </span>

  <span className="inline-flex items-center justify-center rounded-full border border-brand-teal/20 bg-brand-teal/5 px-3 py-1.5 text-sm font-medium text-brand-teal sm:col-span-3">
    ✓ No queues
  </span>

  <span className="inline-flex items-center justify-center rounded-full border border-brand-ember/20 bg-brand-ember/5 px-3 py-1.5 text-sm font-medium text-brand-ember sm:col-span-3">
    ✓ No station visits
  </span>
</div>
          </div>
        </div>
      </section>

      <HowItWorks />

      <ServicesGrid />

      <section id="gas-list" className="bg-brand-bg">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Gas list</p>
              <h2 className="mt-2 font-heading text-3xl font-bold text-brand-navy sm:text-4xl">Order any refill size you need</h2>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-slate-600">
              These are common sizes students ask for, but checkout also lets you type your exact kg.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-2">
            {GAS_SIZES.map((item) => (
              <div key={item.size} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
                <p className="text-2xl font-bold text-brand-navy">{item.size}</p>
                <p className="mt-1 text-sm text-slate-500">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingPreview />

      <SubscriptionPreview />

      <ShopSection
        group="gas_services"
        title="Gas Services Shop"
        subtitle="Cylinders, accessories & repairs"
        icon={Wrench}
        tone="brand-bg"
      />

      <ShopSection
        group="eazy_market"
        title="Eazy Market & Errands"
        subtitle="Groceries and market runs, delivered"
        icon={ShoppingBasket}
      />

      <TrustSection />

      <InvestmentPreview token={token} />

      <TrackingPreview />

      <section id="contact" className="bg-brand-navy">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Running out of gas? Let D&apos;EL-Possibilities handle the refill.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
            Create an account, upload your cylinder, and order in under a minute.
          </p>
          <Link to={orderCtaTo} className="btn-primary mt-8 inline-flex bg-brand-ember px-7 py-3 text-sm shadow-brand-ember/30 hover:bg-brand-ember/90">
            Order Your Refill
          </Link>

          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <a href="tel:+2348103217371" className="rounded-xl bg-white/10 p-4 text-white transition-colors hover:bg-white/15">
              <Phone className="h-5 w-5" strokeWidth={1.8} />
              <span className="mt-3 block text-sm text-white/55">Call</span>
              <span className="block font-semibold">+234 810 321 7371</span>
            </a>
            <a href="https://wa.me/2348103217371" target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 p-4 text-white transition-colors hover:bg-white/15">
              <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
              <span className="mt-3 block text-sm text-white/55">WhatsApp</span>
              <span className="block font-semibold">Message us</span>
            </a>
            <a href="mailto:hello@delpossibilities.com" className="rounded-xl bg-white/10 p-4 text-white transition-colors hover:bg-white/15">
              <Mail className="h-5 w-5" strokeWidth={1.8} />
              <span className="mt-3 block text-sm text-white/55">Email</span>
              <span className="block font-semibold">hello@delpossibilities.com</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <img src={logo} alt="D'EL-Possibilities logo" className="h-10 w-10 rounded-full object-cover" />
              <span className="font-semibold text-brand-navy">D&apos;EL-POSSIBILITIES</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-500">
              LPG pickup, refill, cleaning, servicing, payment, and hostel delivery for Unilorin students.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-brand-navy">Pages</h3>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-500">
              <a href="#
              " className="hover:text-brand-teal">Home</a>
              <a href="#gas-list" className="hover:text-brand-teal">Our Services</a>
              <a href="#about" className="hover:text-brand-teal">About Us</a>
              <a href="#contact" className="hover:text-brand-teal">Contact Us</a>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-brand-navy">Location</h3>
            <p className="mt-3 flex items-start gap-2 text-sm text-slate-500">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.8} />
              Ilorin, Kwara State. Serving University of Ilorin students.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-4 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} D&apos;EL-Possibilities Nig Limited. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

export default Landing
