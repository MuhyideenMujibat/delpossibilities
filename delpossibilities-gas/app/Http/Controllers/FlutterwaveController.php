<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\ProductOrder;
use App\Models\Setting;
use App\Models\Subscriber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

// Flutterwave counterpart to OrderController::pay/verifyPayment and
// SubscriberController::pay/verifyPayment — same shape, same
// amount-reconciliation principle, just against Flutterwave's API instead
// of Paystack's. Flutterwave's own webhook (different signature scheme —
// see FlutterwaveWebhookController) is the async belt-and-braces path; this
// verify-payment pair is the synchronous one, called right after
// Flutterwave redirects the student back.
class FlutterwaveController extends Controller
{
    public function payOrder(Request $request, Order $order)
    {
        $user = $request->user();

        if ($order->user_id !== $user->id) {
            abort(403, 'This order does not belong to you.');
        }

        if ($order->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['This order has already been paid for or handled.'],
            ]);
        }

        if (! Setting::current()->flutterwave_enabled) {
            return response()->json([
                'message' => 'Flutterwave is not currently available. Please choose another payment option.',
            ], 422);
        }

        if ($order->flutterwave_tx_ref && $order->payment_authorization_url && $order->payment_gateway === 'flutterwave') {
            return response()->json([
                'authorization_url' => $order->payment_authorization_url,
                'tx_ref' => $order->flutterwave_tx_ref,
            ]);
        }

        $txRef = 'order_'.$order->id.'_'.Str::random(10);

        try {
            $response = Http::withToken(config('services.flutterwave.secret_key'))->timeout(10)
                ->post('https://api.flutterwave.com/v3/payments', [
                    'tx_ref' => $txRef,
                    // Server-side amount, never trust the frontend — same
                    // principle as OrderController::pay.
                    'amount' => (float) $order->total_amount,
                    'currency' => 'NGN',
                    'redirect_url' => config('services.flutterwave.callback_url'),
                    'customer' => [
                        'email' => $user->email,
                        'name' => $user->name,
                    ],
                    'customizations' => [
                        'title' => config('app.name'),
                    ],
                ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('Flutterwave connection error: '.$e->getMessage());

            return response()->json([
                'message' => 'Unable to reach the payment provider. Please try again shortly.',
            ], 500);
        }

        if (! $response->successful() || $response->json('status') !== 'success') {
            Log::error('Flutterwave initialize transaction failed', [
                'order_id' => $order->id,
                'response' => $response->json(),
            ]);

            return response()->json([
                'message' => 'Unable to initialize payment. Please try again shortly.',
            ], 500);
        }

        $authorizationUrl = $response->json('data.link');

        $order->update([
            'flutterwave_tx_ref' => $txRef,
            'payment_gateway' => 'flutterwave',
            'payment_authorization_url' => $authorizationUrl,
        ]);

        return response()->json([
            'authorization_url' => $authorizationUrl,
            'tx_ref' => $txRef,
        ]);
    }

    // Mirrors OrderController::verifyPayment exactly, aside from talking to
    // Flutterwave's verify API and needing the numeric transaction id
    // Flutterwave hands back on redirect (unlike Paystack, whose reference
    // alone is enough — Flutterwave's tx_ref isn't accepted by /verify,
    // only the id it assigns at charge time).
    public function verifyOrderPayment(Request $request, Order $order)
    {
        $user = $request->user();

        if ($order->user_id !== $user->id) {
            abort(403, 'This order does not belong to you.');
        }

        if ($order->status !== 'pending') {
            return response()->json([
                'order' => $order,
                'flutterwave_status' => 'successful',
                'loyalty' => array_merge(
                    $order->user->loyaltySummary(),
                    ['discount_applied_to_this_order' => (bool) $order->loyalty_discount_applied]
                ),
            ]);
        }

        if (! $order->flutterwave_tx_ref) {
            throw ValidationException::withMessages([
                'status' => ['No payment has been started for this order yet.'],
            ]);
        }

        $validated = $request->validate([
            'transaction_id' => ['required', 'string'],
        ]);

        [$flutterwaveStatus, $errorResponse] = $this->verifyTransaction(
            $validated['transaction_id'],
            $order->flutterwave_tx_ref,
            (float) $order->total_amount,
            'order',
            $order->id
        );

        if ($errorResponse) {
            return $errorResponse;
        }

        if ($flutterwaveStatus === 'successful') {
            // Locked and re-checked inside a transaction — this call can
            // race the Flutterwave webhook hitting the same order (see
            // FlutterwaveWebhookController::handleOrderPayment).
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
        }

        $loyalty = array_merge(
            $order->user->fresh()->loyaltySummary(),
            ['discount_applied_to_this_order' => (bool) $order->loyalty_discount_applied]
        );

        return response()->json([
            'order' => $order->fresh(),
            'flutterwave_status' => $flutterwaveStatus,
            'loyalty' => $loyalty,
        ]);
    }

    // Standalone shop-order checkout — Flutterwave counterpart to
    // ProductOrderController::pay/verifyPayment (a bundled cart never gets
    // here, the gas order's own payment covers it).
    public function payProductOrder(Request $request, ProductOrder $productOrder)
    {
        $user = $request->user();

        if ($productOrder->user_id !== $user->id) {
            abort(403, 'This order does not belong to you.');
        }

        if ($productOrder->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['This order has already been paid for or handled.'],
            ]);
        }

        // Same rule as ProductOrderController::pay: Eazy Market items can't
        // ship alone unless the buyer has a usable subscription to ride on.
        $isActiveSubscriber = $user->subscribers()->usable()->exists();
        if (! $isActiveSubscriber && $productOrder->loadMissing('items')->isEazyMarketOnly()) {
            throw ValidationException::withMessages([
                'items' => ['Eazy Market items need a gas accessory in the same cart, or to be attached to a gas refill — they can\'t be delivered on their own.'],
            ]);
        }

        if (! Setting::current()->flutterwave_enabled) {
            return response()->json([
                'message' => 'Flutterwave is not currently available. Please choose another payment option.',
            ], 422);
        }

        if ($productOrder->flutterwave_tx_ref && $productOrder->payment_authorization_url && $productOrder->payment_gateway === 'flutterwave') {
            return response()->json([
                'authorization_url' => $productOrder->payment_authorization_url,
                'tx_ref' => $productOrder->flutterwave_tx_ref,
            ]);
        }

        $txRef = 'product_order_'.$productOrder->id.'_'.Str::random(10);

        try {
            $response = Http::withToken(config('services.flutterwave.secret_key'))->timeout(10)
                ->post('https://api.flutterwave.com/v3/payments', [
                    'tx_ref' => $txRef,
                    'amount' => (float) $productOrder->total_amount,
                    'currency' => 'NGN',
                    'redirect_url' => config('services.flutterwave.callback_url'),
                    'customer' => [
                        'email' => $user->email,
                        'name' => $user->name,
                    ],
                    'customizations' => [
                        'title' => config('app.name'),
                    ],
                ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('Flutterwave connection error: '.$e->getMessage());

            return response()->json([
                'message' => 'Unable to reach the payment provider. Please try again shortly.',
            ], 500);
        }

        if (! $response->successful() || $response->json('status') !== 'success') {
            Log::error('Flutterwave initialize transaction failed', [
                'product_order_id' => $productOrder->id,
                'response' => $response->json(),
            ]);

            return response()->json([
                'message' => 'Unable to initialize payment. Please try again shortly.',
            ], 500);
        }

        $authorizationUrl = $response->json('data.link');

        $productOrder->update([
            'flutterwave_tx_ref' => $txRef,
            'payment_gateway' => 'flutterwave',
            'payment_authorization_url' => $authorizationUrl,
        ]);

        return response()->json([
            'authorization_url' => $authorizationUrl,
            'tx_ref' => $txRef,
        ]);
    }

    public function verifyProductOrderPayment(Request $request, ProductOrder $productOrder)
    {
        $user = $request->user();

        if ($productOrder->user_id !== $user->id) {
            abort(403, 'This order does not belong to you.');
        }

        if ($productOrder->status !== 'pending') {
            return response()->json(['product_order' => $productOrder, 'flutterwave_status' => 'successful']);
        }

        if (! $productOrder->flutterwave_tx_ref) {
            throw ValidationException::withMessages([
                'status' => ['No payment has been started for this order yet.'],
            ]);
        }

        $validated = $request->validate([
            'transaction_id' => ['required', 'string'],
        ]);

        [$flutterwaveStatus, $errorResponse] = $this->verifyTransaction(
            $validated['transaction_id'],
            $productOrder->flutterwave_tx_ref,
            (float) $productOrder->total_amount,
            'product_order',
            $productOrder->id
        );

        if ($errorResponse) {
            return $errorResponse;
        }

        if ($flutterwaveStatus === 'successful') {
            // Locked and re-checked — can race the webhook hitting the same cart.
            DB::transaction(function () use ($productOrder) {
                $locked = ProductOrder::whereKey($productOrder->id)->lockForUpdate()->first();

                if ($locked->status === 'pending') {
                    $locked->update(['status' => 'approved', 'paid_at' => now()]);
                }
            });
        }

        return response()->json([
            'product_order' => $productOrder->fresh(['items', 'refill', 'attachingRefill', 'order', 'attachingOrder']),
            'flutterwave_status' => $flutterwaveStatus,
        ]);
    }

    public function paySubscriber(Request $request, Subscriber $subscriber)
    {
        $user = $request->user();

        if ($subscriber->user_id !== $user->id) {
            abort(403, 'This subscription does not belong to you.');
        }

        if ($subscriber->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['This subscription has already been paid for or handled.'],
            ]);
        }

        if (! Subscriber::calendarReady($subscriber->plan->package_type)) {
            return response()->json([
                'message' => 'Subscriptions are not open yet — please try again shortly.',
            ], 422);
        }

        if (! Setting::current()->flutterwave_enabled) {
            return response()->json([
                'message' => 'Flutterwave is not currently available. Please choose another payment option.',
            ], 422);
        }

        $pendingPayment = $subscriber->payments()
            ->whereNull('paid_at')
            ->whereNotNull('flutterwave_tx_ref')
            ->latest()
            ->first();
        if ($pendingPayment && $pendingPayment->payment_authorization_url) {
            return response()->json([
                'authorization_url' => $pendingPayment->payment_authorization_url,
                'tx_ref' => $pendingPayment->flutterwave_tx_ref,
            ]);
        }

        $txRef = 'subscription_'.$subscriber->id.'_'.Str::random(10);

        try {
            $response = Http::withToken(config('services.flutterwave.secret_key'))->timeout(10)
                ->post('https://api.flutterwave.com/v3/payments', [
                    'tx_ref' => $txRef,
                    // total_amount, not locked_price — the actual charge
                    // after any referral discount (see SubscriberController::store).
                    'amount' => (float) $subscriber->total_amount,
                    'currency' => 'NGN',
                    'redirect_url' => config('services.flutterwave.callback_url'),
                    'customer' => [
                        'email' => $user->email,
                        'name' => $user->name,
                    ],
                    'customizations' => [
                        'title' => config('app.name'),
                    ],
                ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('Flutterwave connection error: '.$e->getMessage());

            return response()->json([
                'message' => 'Unable to reach the payment provider. Please try again shortly.',
            ], 500);
        }

        if (! $response->successful() || $response->json('status') !== 'success') {
            Log::error('Flutterwave initialize transaction failed', [
                'subscriber_id' => $subscriber->id,
                'response' => $response->json(),
            ]);

            return response()->json([
                'message' => 'Unable to initialize payment. Please try again shortly.',
            ], 500);
        }

        $authorizationUrl = $response->json('data.link');

        $subscriber->payments()->create([
            'amount' => $subscriber->total_amount,
            'flutterwave_tx_ref' => $txRef,
            'payment_authorization_url' => $authorizationUrl,
            'method' => 'flutterwave',
        ]);

        $subscriber->update(['payment_gateway' => 'flutterwave']);

        return response()->json([
            'authorization_url' => $authorizationUrl,
            'tx_ref' => $txRef,
        ]);
    }

    public function verifySubscriberPayment(Request $request, Subscriber $subscriber)
    {
        $user = $request->user();

        if ($subscriber->user_id !== $user->id) {
            abort(403, 'This subscription does not belong to you.');
        }

        if ($subscriber->status !== 'pending') {
            return response()->json(['subscriber' => $subscriber, 'flutterwave_status' => 'successful']);
        }

        $payment = $subscriber->payments()->whereNotNull('flutterwave_tx_ref')->latest()->first();
        if (! $payment) {
            throw ValidationException::withMessages([
                'status' => ['No payment has been started for this subscription yet.'],
            ]);
        }

        $validated = $request->validate([
            'transaction_id' => ['required', 'string'],
        ]);

        [$flutterwaveStatus, $errorResponse] = $this->verifyTransaction(
            $validated['transaction_id'],
            $payment->flutterwave_tx_ref,
            (float) $payment->amount,
            'subscriber',
            $subscriber->id
        );

        if ($errorResponse) {
            return $errorResponse;
        }

        $activationMessage = null;

        if ($flutterwaveStatus === 'successful') {
            try {
                // Locked and re-checked inside a transaction — this call can
                // race the Flutterwave webhook activating the same
                // subscriber (see
                // FlutterwaveWebhookController::handleSubscriptionPayment).
                DB::transaction(function () use ($subscriber, $payment) {
                    $locked = Subscriber::whereKey($subscriber->id)->lockForUpdate()->first();
                    $locked->load('plan');

                    if ($locked->status === 'pending') {
                        $locked->activate($payment);
                    }
                });
            } catch (\RuntimeException $e) {
                $activationMessage = 'Your payment was received, but subscriptions are not open yet — please check back shortly.';
            }
        }

        return response()->json([
            'subscriber' => $subscriber->fresh('plan'),
            'flutterwave_status' => $flutterwaveStatus,
            'message' => $activationMessage,
        ]);
    }

    // Shared verify + amount/reference reconciliation for both flows above.
    // Returns [status, null] on a clean call to Flutterwave (status may
    // still be 'failed'/'cancelled' — that's a legitimate outcome, not an
    // error), or [null, JsonResponse] when the call itself couldn't be
    // trusted (connection error, non-200, or a mismatched tx_ref/amount —
    // logged but not surfaced as fraud to the caller since it could just be
    // an amount rounding difference worth investigating manually).
    private function verifyTransaction(string $transactionId, string $expectedTxRef, float $expectedAmount, string $subjectType, int $subjectId): array
    {
        try {
            $response = Http::withToken(config('services.flutterwave.secret_key'))->timeout(10)
                ->get("https://api.flutterwave.com/v3/transactions/{$transactionId}/verify");
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('Flutterwave verify connection error: '.$e->getMessage());

            return [null, response()->json([
                'message' => 'Unable to reach the payment provider. Please try again shortly.',
            ], 500)];
        }

        if (! $response->successful() || $response->json('status') !== 'success') {
            Log::error('Flutterwave verify transaction failed', [
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'response' => $response->json(),
            ]);

            return [null, response()->json([
                'message' => 'Unable to verify this payment right now. Please try again shortly.',
            ], 500)];
        }

        $data = $response->json('data') ?? [];
        $status = $data['status'] ?? null;
        $txRefMatches = ($data['tx_ref'] ?? null) === $expectedTxRef;
        $currencyMatches = ($data['currency'] ?? null) === 'NGN';
        $amountMatches = abs((float) ($data['amount'] ?? 0) - $expectedAmount) < 0.01;

        if ($status === 'successful' && (! $txRefMatches || ! $currencyMatches || ! $amountMatches)) {
            // Paid, but not for the right thing — don't silently approve it.
            Log::warning('Flutterwave verify amount/reference mismatch', [
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'expected_tx_ref' => $expectedTxRef,
                'expected_amount' => $expectedAmount,
                'paid_amount' => $data['amount'] ?? null,
                'currency' => $data['currency'] ?? null,
            ]);

            return [null, response()->json([
                'flutterwave_status' => 'failed',
            ])];
        }

        return [$status, null];
    }
}
