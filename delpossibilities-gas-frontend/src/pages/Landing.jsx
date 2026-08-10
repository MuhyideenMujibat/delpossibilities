import TopNav from '../TopNav'
import logo from '../assets/delpossibilitiesprofile.jpeg'
import Hero from '../components/landing/Hero'
import ServicesGrid from '../components/landing/ServicesGrid'
import TrustSection from '../components/landing/TrustSection'

function Landing() {
  return (
    <div className="-m-4 sm:-m-6 md:-m-10">
      <TopNav />

      <Hero />

      <section className="bg-brand-bg">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-heading text-2xl font-semibold text-brand-navy sm:text-3xl">About Us</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              D&apos;EL-Possibilities Nig Limited is based in Ilorin, Kwara State, proudly serving the University
              of Ilorin (Unilorin) student community. We take the stress out of gas cylinder refills by handling
              pickup, refilling, cleaning, and delivery, so students can spend less time in queues and more time
              on what matters.
            </p>
          </div>
        </div>
      </section>

      <ServicesGrid />

      <TrustSection />

      <section className="bg-brand-navy">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <h2 className="font-heading text-2xl font-semibold text-white sm:text-3xl">Contact Us</h2>
          <p className="mt-4 text-base text-white/80">Have a question or need help with an order? Reach out anytime.</p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <a href="tel:+2348103217371" className="text-lg font-medium text-white hover:underline">
              +234 810 321 7371
            </a>
            <p className="text-sm text-white/60">Open 24 hours</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:px-6">
          <img src={logo} alt="D'EL-Possibilities logo" className="h-8 w-8 rounded-full object-cover" />
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} D&apos;EL-Possibilities Nig Limited. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
