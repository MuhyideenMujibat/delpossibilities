<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\SubscriptionPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

// Flutterwave's webhook signature scheme is NOT an HMAC calculation like
// Paystack's (see PaystackWebhookController) — Flutterwave just echoes back,
// verbatim, a secret hash string you set once in their dashboard
// (Settings > Webhooks), in the `verif-hash` header. Verifying it is a
// direct string comparison against that same value (services.flutterwave.webhook_hash),
// not a signature recomputed from the payload.
class FlutterwaveWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $verifHash = $request->header('verif-hash');
        $expectedHash = config('services.flutterwave.webhook_hash');

        if (! $expectedHash || ! $verifHash || ! hash_equals($expectedHash, $verifHash)) {
            return response()->json(['message' => 'Invalid signature'], 401);
        }

        $event = json_decode($request->getContent(), true) ?: [];
        $data = $event['data'] ?? null;

        if (! $data || ($data['status'] ?? null) !== 'successful') {
            return response()->json(['status' => 'ignored']);
        }

        $txRef = $data['tx_ref'] ?? null;
        $amountPaid = (float) ($data['amount'] ?? 0);
        $currency = $data['currency'] ?? null;

        if (! $txRef || $currency !== 'NGN') {
            return response()->json(['status' => 'ignored']);
        }

        // Same reference-prefix routing as PaystackWebhookController — our
        // own tx_ref is generated as 'order_{id}_...' / 'subscription_{id}_...'
        // (see FlutterwaveController::payOrder / ::paySubscriber).
        if (str_starts_with($txRef, 'subscription_')) {
            return $this->handleSubscriptionPayment($txRef, $amountPaid);
        }

        return $this->handleOrderPayment($txRef, $amountPaid);
    }

    private function handleOrderPayment(string $txRef, float $amountPaid)
    {
        $order = Order::where('flutterwave_tx_ref', $txRef)->first();

        if (! $order) {
            return response()->json(['status' => 'order not found']);
        }

        $expectedAmount = (float) $order->total_amount;

        if (abs($amountPaid - $expectedAmount) >= 0.01) {
            Log::warning('Flutterwave webhook amount mismatch', [
                'order_id' => $order->id,
                'expected' => $expectedAmount,
                'paid' => $amountPaid,
            ]);

            return response()->json(['status' => 'amount mismatch']);
        }

        if ($order->status === 'pending') {
            $order->update(['status' => 'approved', 'paid_at' => now()]);
            $order->notifyStatusChange();
            $order->applyLoyaltyProgress();

            if ($order->productOrder?->status === 'pending') {
                $order->productOrder->update(['status' => 'approved', 'paid_at' => $order->paid_at]);
            }

            $order->user->grantReferralRewardForGasOrder((float) $order->kg);
            $order->sendReceiptEmail();
        }

        return response()->json(['status' => 'success']);
    }

    private function handleSubscriptionPayment(string $txRef, float $amountPaid)
    {
        $payment = SubscriptionPayment::where('flutterwave_tx_ref', $txRef)->first();

        if (! $payment) {
            return response()->json(['status' => 'subscription payment not found']);
        }

        $expectedAmount = (float) $payment->amount;

        if (abs($amountPaid - $expectedAmount) >= 0.01) {
            Log::warning('Flutterwave webhook subscription amount mismatch', [
                'subscriber_id' => $payment->subscriber_id,
                'expected' => $expectedAmount,
                'paid' => $amountPaid,
            ]);

            return response()->json(['status' => 'amount mismatch']);
        }

        $subscriber = $payment->subscriber;
        $subscriber?->load('plan');

        if ($subscriber && $subscriber->status === 'pending') {
            try {
                $subscriber->activate($payment);
            } catch (\RuntimeException $e) {
                Log::warning('Subscription payment received but calendar not set', [
                    'subscriber_id' => $subscriber->id,
                ]);

                return response()->json(['status' => 'calendar not set']);
            }
        }

        return response()->json(['status' => 'success']);
    }
}
