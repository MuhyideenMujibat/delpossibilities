<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaystackWebhookController extends Controller
{
    public function handle(Request $request)
{
    // Step 1: Get the raw request body exactly as it arrived (not parsed/modified)
    $payload = $request->getContent();

    // Step 2: Get the signature Paystack sent in the header
    $paystackSignature = $request->header('x-paystack-signature');

    // Step 3: Recalculate what the signature SHOULD be, using our secret key
    $expectedSignature = hash_hmac('sha512', $payload, config('services.paystack.secret_key'));

    // Step 4: Compare them. hash_equals(), not !==, so this doesn't leak
    // timing information about how many leading bytes matched.
    if (! $paystackSignature || ! hash_equals($expectedSignature, $paystackSignature)) {
        return response()->json(['message' => 'Invalid signature'], 401);
    }

   // Step 5: Decode the JSON payload into a PHP array so we can read its fields
    $event = json_decode($payload, true);

    // Step 6: We only care about successful charge events
    if (($event['event'] ?? null) !== 'charge.success') {
        return response()->json(['status' => 'ignored']);
    }

    // Step 7: Pull out the reference and amount Paystack says was paid
    $reference = $event['data']['reference'];
    $amountPaidInKobo = $event['data']['amount'];

    // Step 8: Route by reference prefix — orders, subscriptions, and
    // standalone cart checkouts generate references as 'order_{id}_...' /
    // 'subscription_{id}_...' / 'product_order_{id}_...' respectively (see
    // OrderController::pay / SubscriberController::pay /
    // ProductOrderController::pay), so the prefix alone is enough to tell
    // which flow this event belongs to. product_order_ must be checked
    // before falling through to handleOrderPayment, since that's a bare
    // else and 'product_order_...' doesn't start with 'order_' either way
    // — but the explicit branch keeps the routing unambiguous.
    if (str_starts_with($reference, 'subscription_')) {
        return $this->handleSubscriptionPayment($reference, $amountPaidInKobo);
    }

    if (str_starts_with($reference, 'product_order_')) {
        return $this->handleProductOrderPayment($reference, $amountPaidInKobo);
    }

    return $this->handleOrderPayment($reference, $amountPaidInKobo);
}

private function handleOrderPayment(string $reference, int $amountPaidInKobo)
{
    // Step 8: Find the order using that reference
    $order = \App\Models\Order::withTrashed()->where('paystack_reference', $reference)->first();

    if (!$order) {
        // No matching order found — log it, but still respond 200 so Paystack doesn't keep retrying
        return response()->json(['status' => 'order not found']);
    }

    // Step 9: Compare the amount Paystack says was paid against what the order
    // should actually cost. total_amount is stored in naira, so convert to kobo
    // to compare fairly.
    $expectedAmountInKobo = (int) ($order->total_amount * 100);

    if ($amountPaidInKobo !== $expectedAmountInKobo) {
        // Amount mismatch — do NOT approve. Log it so you can investigate manually.
        Log::warning('Paystack webhook amount mismatch', [
            'order_id' => $order->id,
            'expected' => $expectedAmountInKobo,
            'paid' => $amountPaidInKobo,
        ]);

        return response()->json(['status' => 'amount mismatch']);
    }

    // Step 10: Everything checks out — approve the order. Locked and
    // re-checked inside a transaction because Paystack retries undelivered
    // webhooks, and the frontend's own verify-payment call (see
    // OrderController::verifyPayment) can land in the same window — without
    // the lock, both could read status='pending' before either commits,
    // double-crediting loyalty progress and sending two receipt emails.
    $approved = DB::transaction(function () use ($order) {
        $locked = \App\Models\Order::withTrashed()->whereKey($order->id)->lockForUpdate()->first();

        if ($locked->status !== 'pending') {
            return null;
        }

        $locked->update([
            'status' => 'approved',
            'paid_at' => now(),
        ]);
        // Undoes an admin's soft delete the moment this order is actually
        // paid for — safe to call even if it was never trashed (see
        // OrderController::destroy).
        $locked->restore();

        // A bundled cart that was still pending rides on this same charge —
        // mark it paid too, since it never gets its own reference/webhook
        // event. An already-approved cart (attached after being paid for
        // standalone) is left untouched — it kept its own real paid_at.
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

        // Last, deliberately, and outside the transaction: this talks to an
        // external SMTP server and can hang or time out (seen in production
        // — a stuck send here once fatal-errored the whole request past
        // PHP's execution-time limit). Nothing above may depend on the
        // email having sent, and holding the DB transaction open across a
        // slow SMTP call would only make things worse.
        $approved->sendReceiptEmail();
    }

    return response()->json(['status' => 'success']);
}

private function handleProductOrderPayment(string $reference, int $amountPaidInKobo)
{
    $productOrder = \App\Models\ProductOrder::where('paystack_reference', $reference)->first();

    if (!$productOrder) {
        return response()->json(['status' => 'product order not found']);
    }

    $expectedAmountInKobo = (int) ($productOrder->total_amount * 100);

    if ($amountPaidInKobo !== $expectedAmountInKobo) {
        Log::warning('Paystack webhook product order amount mismatch', [
            'product_order_id' => $productOrder->id,
            'expected' => $expectedAmountInKobo,
            'paid' => $amountPaidInKobo,
        ]);

        return response()->json(['status' => 'amount mismatch']);
    }

    DB::transaction(function () use ($productOrder) {
        $locked = \App\Models\ProductOrder::whereKey($productOrder->id)->lockForUpdate()->first();

        if ($locked->status === 'pending') {
            $locked->update(['status' => 'approved', 'paid_at' => now()]);
        }
    });

    return response()->json(['status' => 'success']);
}

private function handleSubscriptionPayment(string $reference, int $amountPaidInKobo)
{
    $payment = \App\Models\SubscriptionPayment::where('paystack_reference', $reference)->first();

    if (!$payment) {
        return response()->json(['status' => 'subscription payment not found']);
    }

    $expectedAmountInKobo = (int) ($payment->amount * 100);

    if ($amountPaidInKobo !== $expectedAmountInKobo) {
        Log::warning('Paystack webhook subscription amount mismatch', [
            'subscriber_id' => $payment->subscriber_id,
            'expected' => $expectedAmountInKobo,
            'paid' => $amountPaidInKobo,
        ]);

        return response()->json(['status' => 'amount mismatch']);
    }

    $subscriber = $payment->subscriber;

    if (! $subscriber) {
        return response()->json(['status' => 'success']);
    }

    try {
        $activated = DB::transaction(function () use ($subscriber, $payment) {
            $locked = \App\Models\Subscriber::whereKey($subscriber->id)->lockForUpdate()->first();
            $locked->load('plan');

            if ($locked->status !== 'pending') {
                return false;
            }

            $locked->activate($payment);

            return true;
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
