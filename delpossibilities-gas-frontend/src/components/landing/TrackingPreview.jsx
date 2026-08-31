import Reveal from '../motion/Reveal'
import OrderTimeline from '../OrderTimeline'

function TrackingPreview() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Order tracking</p>
          <h2 className="mt-2 font-heading text-2xl font-bold text-brand-navy sm:text-3xl">Know exactly where your gas is</h2>
          <p className="mt-3 text-base text-slate-600">Every order moves through the same four checkpoints, visible from your dashboard the moment it changes.</p>
        </div>

        <Reveal className="panel-card mx-auto mt-10 max-w-2xl p-6 pt-8 sm:p-8 sm:pt-10" delay={0.05}>
          <p className="eyebrow mb-6 text-center">Example order · #DP-2481</p>
          <OrderTimeline status="picked_up" layout="horizontal" />
        </Reveal>
      </div>
    </section>
  )
}

export default TrackingPreview
