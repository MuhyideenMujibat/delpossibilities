import { motion, useReducedMotion } from 'motion/react'

const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  ul: motion.ul,
  li: motion.li,
  span: motion.span,
  h1: motion.h1,
  h2: motion.h2,
  p: motion.p,
  img: motion.img,
}

/**
 * Shared mount-triggered fade/slide-in wrapper. Deliberately NOT scroll-triggered
 * (whileInView) — that pattern was found to get permanently stuck at opacity:0 in
 * production, even outside React StrictMode. Animating on mount is the proven-safe
 * default for this app; every page should build on this instead of hand-rolling variants.
 */
function Reveal({ children, as = 'div', className, delay = 0, y = 16, stagger = false, staggerDelay = 0.08, ...rest }) {
  const shouldReduceMotion = useReducedMotion()
  const Tag = MOTION_TAGS[as] || motion.div

  const variants = stagger
    ? {
        hidden: {},
        show: { transition: { staggerChildren: shouldReduceMotion ? 0 : staggerDelay, delayChildren: delay } },
      }
    : {
        hidden: { opacity: 0, y: shouldReduceMotion ? 0 : y },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay } },
      }

  return (
    <Tag className={className} variants={variants} initial="hidden" animate="show" {...rest}>
      {children}
    </Tag>
  )
}

/** Child of a `stagger` Reveal — inherits the parent's animation state automatically. */
export function RevealItem({ children, as = 'div', className, y = 16, duration = 0.45, ...rest }) {
  const shouldReduceMotion = useReducedMotion()
  const Tag = MOTION_TAGS[as] || motion.div

  const variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : y },
    show: { opacity: 1, y: 0, transition: { duration, ease: 'easeOut' } },
  }

  return (
    <Tag className={className} variants={variants} {...rest}>
      {children}
    </Tag>
  )
}

export default Reveal
