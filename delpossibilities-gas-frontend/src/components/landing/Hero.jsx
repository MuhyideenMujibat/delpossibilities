import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import Reveal, { RevealItem } from '../motion/Reveal'
import StatusBadge from '../../StatusBadge'
import hero from '../../assets/delpossibilitieslandingpage.jpeg'

function Hero({ orderCtaTo = '/register' }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="home" className="relative overflow-hidden bg-[#050b12]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(27,108,168,0.28),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_42%)]" aria-hidden="true" />
      <Reveal
        as="div"
        stagger
        staggerDelay={0.12}
        delay={0.05}
        className="relative mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:flex-row lg:py-24"
      >
        <div className="flex-1 text-center lg:text-left">
          <RevealItem
            as="span"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
          >
            Ilorin &middot; Serving Unilorin Students
          </RevealItem>

          <RevealItem
            as="h1"
            className="mt-4 font-heading text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl"
          >
            Get Your Cooking Gas Refilled And Delivered Without Leaving Your Hostel.
          </RevealItem>

          <RevealItem as="p" className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl lg:mx-0">
            Order your LPG refill online, pay securely, and track your delivery from your phone.
          </RevealItem>

          <RevealItem as="div" className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link to={orderCtaTo} className="btn-primary px-6 py-3 text-sm shadow-lg shadow-brand-teal/25">
              Order Gas Now
            </Link>
            <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10">
              How It Works
            </a>
          </RevealItem>
        </div>

        <RevealItem as="div" className="relative flex-1">
          <motion.img
            src={hero}
            alt="Gas cylinder delivery"
            className="mx-auto w-full max-w-md rounded-2xl object-cover drop-shadow-[0_25px_45px_rgba(0,0,0,0.45)]"
            animate={shouldReduceMotion ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            className="absolute -bottom-4 left-2 w-56 rounded-xl border border-white/10 bg-[#081321]/95 p-4 text-white shadow-xl shadow-black/30 backdrop-blur sm:-left-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: shouldReduceMotion ? 0 : [0, -6, 0] }}
            transition={
              shouldReduceMotion
                ? { duration: 0.5, delay: 0.4 }
                : { opacity: { duration: 0.5, delay: 0.4 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.9 } }
            }
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">Order #DP-2481</span>
              <StatusBadge status="picked_up" label="Refilling" />
            </div>
            <p className="figure mt-2 text-lg font-bold text-white">12.5 kg</p>
            <p className="mt-0.5 text-xs text-white/45">Hostel C, Block 2, Room 14</p>
          </motion.div>
        </RevealItem>
      </Reveal>
    </section>
  )
}

export default Hero
