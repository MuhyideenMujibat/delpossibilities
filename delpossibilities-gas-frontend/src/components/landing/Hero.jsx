import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import Reveal, { RevealItem } from '../motion/Reveal'
import hero from '../../assets/hero.png'

function Hero() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <motion.div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-teal/10 blur-3xl"
          animate={
            shouldReduceMotion
              ? undefined
              : { x: [0, 24, 0], y: [0, 16, 0] }
          }
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-32 right-[-6rem] h-80 w-80 rounded-full bg-brand-accent/10 blur-3xl"
          animate={
            shouldReduceMotion
              ? undefined
              : { x: [0, -20, 0], y: [0, -14, 0] }
          }
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

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
            className="inline-flex items-center gap-2 rounded-full border border-brand-teal/20 bg-brand-teal/5 px-3 py-1 text-xs font-medium text-brand-teal"
          >
            Ilorin &middot; Serving Unilorin Students
          </RevealItem>

          <RevealItem
            as="h1"
            className="mt-4 font-heading text-3xl font-bold leading-tight text-brand-navy sm:text-4xl lg:text-5xl"
          >
            Gas Cylinder Refills, Delivered to Your Hostel Door
          </RevealItem>

          <RevealItem as="p" className="mx-auto mt-4 max-w-lg text-base text-slate-600 sm:text-lg lg:mx-0">
            D&apos;EL-Possibilities makes it easy for Unilorin students to order gas refills online and have
            them picked up, refilled, and delivered right back to their hostel &mdash; no queues, no hassle.
          </RevealItem>

          <RevealItem as="div" className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link to="/register" className="btn-primary px-6 py-3 text-sm">
              Get Started &mdash; Register
            </Link>
            <Link to="/login" className="btn-outline px-6 py-3 text-sm">
              Log In
            </Link>
          </RevealItem>
        </div>

        <RevealItem as="div" className="flex-1">
          <motion.img
            src={hero}
            alt="Gas cylinder delivery"
            className="mx-auto w-full max-w-md rounded-2xl object-cover shadow-lg shadow-brand-navy/10"
            animate={shouldReduceMotion ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </RevealItem>
      </Reveal>
    </section>
  )
}

export default Hero
