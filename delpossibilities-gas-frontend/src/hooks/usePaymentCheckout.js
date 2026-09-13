import { useCallback, useState } from 'react'
import { apiFetch } from '../api'

// Endpoints mirror each other: OrderController::pay/SubscriberController::pay
// for Paystack, FlutterwaveController::payOrder/paySubscriber for
// Flutterwave (see routes/api.php).
const PAY_PATH = {
  order: {
    paystack: (id) => `/orders/${id}/pay`,
    flutterwave: (id) => `/orders/${id}/pay-flutterwave`,
  },
  subscriber: {
    paystack: (id) => `/subscribers/${id}/pay`,
    flutterwave: (id) => `/subscribers/${id}/pay-flutterwave`,
  },
}

// Shared "Pay Now" logic for both gas orders and subscriptions: asks the
// backend which gateway(s) are enabled (GET /payment-gateways), goes
// straight to the one enabled gateway when there's only one, or opens a
// picker when both are on. Render <PaymentGatewayModal> wired to the
// `picker` state this returns wherever startPayment(...) is called from.
export function usePaymentCheckout(token) {
  const [picker, setPicker] = useState(null) // { kind, id, resolve } | null
  const [choosing, setChoosing] = useState(false)

  const callPay = useCallback(
    async (kind, id, gateway) => {
      const response = await apiFetch(PAY_PATH[kind][gateway](id), { method: 'POST', token })
      const data = await response.json().catch(() => null)
      return { ok: response.ok, data, gateway }
    },
    [token]
  )

  // Resolves to { ok, data, gateway, cancelled? }. `data.authorization_url`
  // is where to redirect on success, same shape for either gateway.
  const startPayment = useCallback(
    async (kind, id) => {
      let paystackEnabled = true
      let flutterwaveEnabled = false

      try {
        const response = await apiFetch('/payment-gateways', { token })
        if (response.ok) {
          const gateways = await response.json()
          paystackEnabled = gateways.paystack_enabled !== false
          flutterwaveEnabled = Boolean(gateways.flutterwave_enabled)
        }
      } catch {
        // Falls back to Paystack-only above — matches pre-Flutterwave behavior.
      }

      if (paystackEnabled && flutterwaveEnabled) {
        return new Promise((resolve) => setPicker({ kind, id, resolve }))
      }

      return callPay(kind, id, flutterwaveEnabled ? 'flutterwave' : 'paystack')
    },
    [token, callPay]
  )

  const chooseGateway = useCallback(
    async (gateway) => {
      if (!picker) return
      const { kind, id, resolve } = picker
      setChoosing(true)
      const result = await callPay(kind, id, gateway)
      setChoosing(false)
      setPicker(null)
      resolve(result)
    },
    [picker, callPay]
  )

  const cancelPicker = useCallback(() => {
    if (!picker) return
    const { resolve } = picker
    setPicker(null)
    resolve({ ok: false, data: null, cancelled: true })
  }, [picker])

  return {
    startPayment,
    pickerOpen: Boolean(picker),
    pickerBusy: choosing,
    chooseGateway,
    cancelPicker,
  }
}
