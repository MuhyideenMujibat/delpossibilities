<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\ProductOrder;
use App\Models\Subscriber;
use App\Models\SubscriptionPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        // 'product_order_...' doesn't start with 'order_', but is checked
        // explicitly so it can never fall through to the gas-order lookup.
        if (str_starts_with($txRef, 'product_order_')) {
            return $this->handleProductOrderPayment($txRef, $amountPaid);
        }

        return $this->handleOrderPayment($txRef, $amountPaid);
    }

    private function handleProductOrderPayment(string $txRef, float $amountPaid)
    {
        $productOrder = ProductOrder::where('flutterwave_tx_ref', $txRef)->first();

        if (! $productOrder) {
            return response()->json(['status' => 'product order not found']);
        }

        if (abs($amountPaid - (float) $productOrder->total_amount) >= 0.01) {
            Log::warning('Flutterwave webhook product order amount mismatch', [
                'product_order_id' => $productOrder->id,
                'expected' => (float) $productOrder->total_amount,
                'paid' => $amountPaid,
            ]);

            return response()->json(['status' => 'amount mismatch']);
        }

        DB::transaction(function () use ($productOrder) {
            $locked = ProductOrder::whereKey($productOrder->id)->lockForUpdate()->first();

            if ($locked->status === 'pending') {
                $locked->update(['status' => 'approved', 'paid_at' => now()]);
            }
        });

        return response()->json(['status' => 'success']);
    }

    private function handleOrderPayment(string $txRef, float $amountPaid)
    {
        $order = Order::withTrashed()->where('flutterwave_tx_ref', $txRef)->first();

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

        // Locked and re-checked inside a transaction — same reasoning as
        // PaystackWebhookController::handleOrderPayment: Flutterwave retries
        // undelivered webhooks, and the frontend's own verify call can land
        // in the same window.
        $approved = DB::transaction(function () use ($order) {
            $locked = Order::withTrashed()->whereKey($order->id)->lockForUpdate()->first();

            if ($locked->status !== 'pending') {
                return null;
            }

            $locked->update(['status' => 'approved', 'paid_at' => now()]);
            // Undoes an admin's soft delete the moment this order is
            // actually paid for — safe to call even if it was never
            // trashed (see OrderController::destroy).
            $locked->restore();

            if ($locked->productOrder?->status === 'pending') {
                $locked->productOrder->update(['status' => 'approved', 'paid_at' => $locked->paid_at]);
            }

            return $locked;
        });

        if ($approved) {
            $approved->notifyStatusChange();
            $approved->applyLoyaltyProgress();
            $approved->applyReferralFreeKg();
            $approved->user->grantReferralRewardForGasOrder($approved);
            $approved->sendReceiptEmail();
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

        if (! $subscriber) {
            return response()->json(['status' => 'success']);
        }

        try {
            DB::transaction(function () use ($subscriber, $payment) {
                $locked = Subscriber::whereKey($subscriber->id)->lockForUpdate()->first();
                $locked->load('plan');

                if ($locked->status === 'pending') {
                    $locked->activate($payment);
                }
            });
        } catch (\RuntimeException $e) {
            Log::warning('Subscription payment received but calendar not set', [
                'subscriber_id' => $subscriber->id,
            ]);

            return response()->json(['status' => 'calendar not set']);
        }

        return response()->json(['status' => 'success']);
    }
}
