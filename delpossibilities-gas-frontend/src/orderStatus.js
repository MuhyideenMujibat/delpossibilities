// The backend only tracks a single `status` enum (pending -> approved ->
// picked_up -> delivered) with no separate payment/delivery fields and no
// per-transition timestamps. This maps that enum onto the 4 checkpoints a
// customer actually cares about, so we're not inventing state the API
// doesn't have. Shared by OrderTimeline (student order detail + landing
// preview) and anywhere else that needs to reason about status order.
export const TIMELINE_STEPS = [
  { key: 'placed', label: 'Order Placed', hint: "We've got your request." },
  { key: 'paid', label: 'Payment Confirmed', hint: 'Paystack verified your payment.' },
  { key: 'picked_up', label: 'Picked Up', hint: 'Your cylinder is out for refilling.' },
  { key: 'delivered', label: 'Delivered', hint: 'Refilled and back at your door.' },
]

const STATUS_STEP_INDEX = {
  pending: 0,
  approved: 1,
  picked_up: 2,
  delivered: 3,
}

export function stepIndexForStatus(status) {
  return STATUS_STEP_INDEX[status] ?? 0
}
