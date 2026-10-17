<?php

namespace App\Http\Controllers;

use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\ProductOrder;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'kg' => ['required', 'numeric', 'min:0.01'],
            'location_type' => ['required', Rule::in(['hostel', 'off_campus'])],
            'hostel_address' => ['required', 'string', 'max:255'],
            'cylinder_image' => ['nullable', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'delivery_zone_id' => ['nullable', 'required_if:location_type,off_campus', 'integer', 'exists:delivery_zones,id'],
            'product_order_id' => ['nullable', 'integer', 'exists:product_orders,id'],
            'attached_product_order_id' => ['nullable', 'integer', 'different:product_order_id', 'exists:product_orders,id'],
            // Set only by the frontend's "create this order anyway" choice
            // (see the 409 response below) — never surfaced as a checkbox
            // to the student, just the flag that carries their answer to
            // that prompt back on the resubmit.
            'force_create' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();

        if (! $user->cylinder_image && ! $request->hasFile('cylinder_image')) {
            throw ValidationException::withMessages([
                'cylinder_image' => ['Please upload your cylinder image before placing an order.'],
            ]);
        }

        // Everything from the pending-order check through the eventual
        // create is serialized per user — without this, two requests
        // landing at the same instant (a double-tap, a retried request)
        // could both read "no pending order" before either commits,
        // defeating the check below and creating two orders. block(5) waits
        // briefly for the other request to finish rather than failing
        // outright; a genuine second submission just resolves against
        // whatever the first one left behind.
        try {
            return Cache::lock("order-create:{$user->id}", 10)->block(5, function () use ($request, $validated, $user) {
                return $this->storeOrder($request, $validated, $user);
            });
        } catch (LockTimeoutException) {
            return response()->json([
                'message' => 'Still processing your last request — please try again in a moment.',
            ], 429);
        }
    }

    private function storeOrder(Request $request, array $validated, User $user)
    {
        // A student placing an order while one is already sitting unpaid is
        // almost always a mistake (a resubmit, or forgetting they haven't
        // paid the last one) rather than someone who genuinely wants a
        // second delivery — so this asks first rather than either silently
        // blocking or silently creating a duplicate. The frontend presents
        // it as a choice: go edit-and-pay the existing order (on its own
        // tracking page, via POST /orders/{order}/edit), or resubmit this
        // exact request with force_create=true to create the new one anyway.
        if (! $request->boolean('force_create')) {
            $pending = $user->orders()->where('status', 'pending')->latest()->first();

            if ($pending) {
                $isExactMatch = ! $request->hasFile('cylinder_image')
                    && abs((float) $pending->kg - (float) $validated['kg']) < 0.001
                    && $pending->hostel_address === $validated['hostel_address'];

                return response()->json([
                    'message' => $isExactMatch
                        ? 'You already have a matching order awaiting payment.'
                        : 'You already have a different order awaiting payment.',
                    'existing_order' => $pending->load(['productOrder.items', 'attachedProductOrder.items']),
                    'exact_match' => $isExactMatch,
                ], 409);
            }
        } else {
            // The student chose "create a new one anyway" over editing/paying
            // whatever pending order(s) they already had (the other branch of
            // the 409 choice above) — those old attempts are abandoned, not
            // meant to keep sitting around alongside the new one. forceDelete,
            // not delete — Order now uses SoftDeletes (see
            // OrderController::destroy), and this cleanup means "actually
            // gone," not "admin-style soft-deleted but still payable." A
            // bundled cart (product_order_id) was never charged separately —
            // it dies with the order it was riding on. An ATTACHED cart
            // (attached_product_order_id) is different: real money was
            // already spent on it standalone, so it's freed back to
            // 'approved' instead of deleted, free to ride on a future order.
            $stalePending = $user->orders()->where('status', 'pending')->get();

            foreach ($stalePending as $stale) {
                if ($stale->attached_product_order_id) {
                    $stale->attachedProductOrder?->update(['status' => 'approved']);
                }

                $stale->forceDelete();
                $stale->productOrder?->delete();
            }
        }

        $setting = Setting::current();
        $pricePerKg = $setting->offer_active && $setting->offer_price_per_kg
            ? $setting->offer_price_per_kg
            : $setting->price_per_kg;

        // Off-campus delivery is zone-based (student picks a named zone,
        // each with its own admin-set fee) rather than the old flat
        // Setting::off_campus_delivery_fee. On-campus stays a flat fee.
        $deliveryZone = null;
        if ($validated['location_type'] === 'off_campus') {
            $deliveryZone = DeliveryZone::where('is_active', true)->find($validated['delivery_zone_id']);

            if (! $deliveryZone) {
                throw ValidationException::withMessages([
                    'delivery_zone_id' => ['Please select a valid delivery zone.'],
                ]);
            }
        }

        // A VIP/VVIP account or an investor never pays a delivery fee here,
        // hostel or off-campus (see User::getsFreeGasDelivery — investors
        // only get this on a gas order, not on Eazy Market/accessory carts,
        // see ProductOrderController::store for that narrower VIP/VVIP-only
        // rule).
        $deliveryFee = $user->getsFreeGasDelivery() ? 0.0 : (
            $validated['location_type'] === 'off_campus'
                ? (float) $deliveryZone->fee
                : ($setting->delivery_fee ?? 0)
        );

        // An Eazy Market / Gas Services cart (see ProductOrderController) can
        // ride along with this order in TWO independent ways, and a student
        // can use both at once:
        //  - `product_order_id`: a still-unpaid cart bundled in — its total
        //    folds additively into this order's own Paystack charge.
        //  - `attached_product_order_id`: a cart already paid for standalone
        //    (e.g. via Cart.jsx's "Checkout Cart Only") — just tagged to this
        //    delivery for fulfilment tracking, nothing folded into the charge.
        // Keeping them separate is what lets a student pay for one shop item,
        // attach it here, AND still bundle their other unpaid cart items on
        // the same refill without either dropping off the order.
        $productOrder = null;
        $productOrderTotal = 0;
        if (! empty($validated['product_order_id'])) {
            $productOrder = ProductOrder::where('id', $validated['product_order_id'])
                ->where('user_id', $user->id)
                ->whereIn('status', ['pending', 'approved'])
                ->first();

            if (! $productOrder) {
                throw ValidationException::withMessages([
                    'product_order_id' => ['This cart order is no longer available to attach.'],
                ]);
            }

            if ($productOrder->status === 'pending') {
                $productOrderTotal = (float) $productOrder->total_amount;
            } elseif ($productOrder->isLinked()) {
                throw ValidationException::withMessages([
                    'product_order_id' => ['This cart order is already attached to another delivery.'],
                ]);
            }
        }

        $attachedProductOrder = null;
        if (! empty($validated['attached_product_order_id'])) {
            $attachedProductOrder = ProductOrder::where('id', $validated['attached_product_order_id'])
                ->where('user_id', $user->id)
                ->where('status', 'approved')
                ->first();

            if (! $attachedProductOrder) {
                throw ValidationException::withMessages([
                    'attached_product_order_id' => ['This paid cart order is no longer available to attach.'],
                ]);
            }

            if ($attachedProductOrder->isLinked()) {
                throw ValidationException::withMessages([
                    'attached_product_order_id' => ['This cart order is already attached to another delivery.'],
                ]);
            }
        }

        [$gasCostWaived, $loyaltyDiscountApplied, $loyaltyDiscountAmount, $vvipDiscountAmount]
            = $this->loyaltyAndVvipDiscounts($user, (float) $validated['kg'], (float) $pricePerKg, $setting);

        [$freeKgDiscountAmount, $freeKgUsed] = $this->referralFreeKgDiscount($user, (float) $validated['kg'], (float) $pricePerKg, $gasCostWaived);

        $remainingAfterLoyalty = max((float) $validated['kg'] * (float) $pricePerKg - ($loyaltyDiscountAmount ?? 0) - $freeKgDiscountAmount, 0);
        [$referralDiscountAmount, $referralPercentUsed] = $this->referralDiscount($user, $remainingAfterLoyalty, $gasCostWaived);

        $imagePath = $request->hasFile('cylinder_image')
            ? \App\Support\ImageOptimizer::store($request->file('cylinder_image'), 'cylinders')
            : $user->cylinder_image;

        // One transaction: the order is created with the referral discount
        // already baked into total_amount, so the balance it came from must
        // be debited in the same all-or-nothing write — otherwise a failure
        // between the two statements leaves the student charged the
        // discounted price without the balance ever being spent.
        $order = DB::transaction(function () use (
            $user, $imagePath, $validated, $pricePerKg, $loyaltyDiscountApplied, $loyaltyDiscountAmount,
            $deliveryFee, $referralDiscountAmount, $vvipDiscountAmount, $productOrder, $attachedProductOrder,
            $productOrderTotal, $deliveryZone, $referralPercentUsed, $freeKgDiscountAmount, $freeKgUsed
        ) {
            $order = $user->orders()->create([
                'cylinder_image' => $imagePath,
                'kg' => $validated['kg'],
                'price_per_kg' => $pricePerKg,
                'loyalty_discount_applied' => $loyaltyDiscountApplied,
                'loyalty_discount_amount' => $loyaltyDiscountAmount,
                'delivery_fee' => $deliveryFee,
                'referral_credit_applied' => 0,
                'referral_discount_amount' => $referralDiscountAmount,
                'referral_percent_used' => $referralPercentUsed,
                'referral_free_kg_applied' => $freeKgUsed,
                'referral_free_kg_discount_amount' => $freeKgDiscountAmount,
                'vvip_discount_amount' => $vvipDiscountAmount,
                'product_order_id' => $productOrder?->id,
                'attached_product_order_id' => $attachedProductOrder?->id,
                'total_amount' => round(
                    max($validated['kg'] * $pricePerKg - ($loyaltyDiscountAmount ?? 0) - $freeKgDiscountAmount - $referralDiscountAmount - $vvipDiscountAmount, 0)
                    + $deliveryFee + $productOrderTotal, 2
                ),
                'hostel_address' => $validated['hostel_address'],
                'location_type' => $validated['location_type'],
                'delivery_zone_id' => $deliveryZone?->id,
                'status' => 'pending',
            ]);

            if ($referralPercentUsed > 0) {
                $user->decrement('referral_discount_percent_available', $referralPercentUsed);
            }

            // referral_free_kg_balance is deliberately NOT touched here — it
            // only actually moves once this order is paid for (see
            // Order::applyReferralFreeKg, called from the payment-confirmation
            // paths). An abandoned/edited-away pending order never spent it in
            // the first place, so there's nothing to refund later.

            return $order;
        });

        return response()->json($order, 201);
    }

    // Reached when a student, blocked by the one-pending-order check in
    // store(), chooses to update that pending order to what they actually
    // want instead of being stuck with it as-is — full parity with store():
    // kg, cylinder photo, on/off-campus address, AND the bundled/attached
    // shop cart can all change here too, not just the gas-order fields.
    // Every discount is recomputed from scratch against current
    // settings/loyalty progress, same as a fresh store() would.
    public function update(Request $request, Order $order)
    {
        $user = $request->user();

        if ($order->user_id !== $user->id) {
            abort(403, 'This order does not belong to you.');
        }

        if ($order->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['This order can no longer be edited.'],
            ]);
        }

        $validated = $request->validate([
            'kg' => ['required', 'numeric', 'min:0.01'],
            'location_type' => ['required', Rule::in(['hostel', 'off_campus'])],
            'hostel_address' => ['required', 'string', 'max:255'],
            'cylinder_image' => ['nullable', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'delivery_zone_id' => ['nullable', 'required_if:location_type,off_campus', 'integer', 'exists:delivery_zones,id'],
            'product_order_id' => ['nullable', 'integer', 'exists:product_orders,id'],
            'attached_product_order_id' => ['nullable', 'integer', 'different:product_order_id', 'exists:product_orders,id'],
        ]);

        $setting = Setting::current();
        $pricePerKg = $setting->offer_active && $setting->offer_price_per_kg
            ? $setting->offer_price_per_kg
            : $setting->price_per_kg;

        $deliveryZone = null;
        if ($validated['location_type'] === 'off_campus') {
            $deliveryZone = DeliveryZone::where('is_active', true)->find($validated['delivery_zone_id']);

            if (! $deliveryZone) {
                throw ValidationException::withMessages([
                    'delivery_zone_id' => ['Please select a valid delivery zone.'],
                ]);
            }
        }

        $deliveryFee = $user->getsFreeGasDelivery() ? 0.0 : (
            $validated['location_type'] === 'off_campus'
                ? (float) $deliveryZone->fee
                : ($setting->delivery_fee ?? 0)
        );

        // Same resolution as store() — a cart can be bundled (its total
        // folds into this order's charge) or attached (already paid for
        // standalone, just riding along) — except `isLinked()` is only a
        // conflict when the id is actually changing to a DIFFERENT cart;
        // re-submitting the one already on this order isn't a new
        // attachment, so it must not trip the "already attached elsewhere"
        // check against itself.
        $productOrder = null;
        $productOrderTotal = 0.0;
        if (! empty($validated['product_order_id'])) {
            $productOrder = ProductOrder::where('id', $validated['product_order_id'])
                ->where('user_id', $user->id)
                ->whereIn('status', ['pending', 'approved'])
                ->first();

            if (! $productOrder) {
                throw ValidationException::withMessages([
                    'product_order_id' => ['This cart order is no longer available to attach.'],
                ]);
            }

            $isUnchanged = (int) $productOrder->id === (int) $order->product_order_id;

            if ($productOrder->status === 'pending') {
                $productOrderTotal = (float) $productOrder->total_amount;
            } elseif (! $isUnchanged && $productOrder->isLinked()) {
                throw ValidationException::withMessages([
                    'product_order_id' => ['This cart order is already attached to another delivery.'],
                ]);
            }
        }

        $attachedProductOrder = null;
        if (! empty($validated['attached_product_order_id'])) {
            $attachedProductOrder = ProductOrder::where('id', $validated['attached_product_order_id'])
                ->where('user_id', $user->id)
                ->where('status', 'approved')
                ->first();

            if (! $attachedProductOrder) {
                throw ValidationException::withMessages([
                    'attached_product_order_id' => ['This paid cart order is no longer available to attach.'],
                ]);
            }

            $isUnchanged = (int) $attachedProductOrder->id === (int) $order->attached_product_order_id;

            if (! $isUnchanged && $attachedProductOrder->isLinked()) {
                throw ValidationException::withMessages([
                    'attached_product_order_id' => ['This cart order is already attached to another delivery.'],
                ]);
            }
        }

        [$gasCostWaived, $loyaltyDiscountApplied, $loyaltyDiscountAmount, $vvipDiscountAmount]
            = $this->loyaltyAndVvipDiscounts($user, (float) $validated['kg'], (float) $pricePerKg, $setting);

        $newImagePath = $request->hasFile('cylinder_image')
            ? \App\Support\ImageOptimizer::store($request->file('cylinder_image'), 'cylinders')
            : $order->cylinder_image;
        $oldImagePath = $order->cylinder_image;

        $updated = DB::transaction(function () use (
            $order, $user, $validated, $pricePerKg, $loyaltyDiscountApplied, $loyaltyDiscountAmount,
            $deliveryFee, $vvipDiscountAmount, $gasCostWaived, $newImagePath, $deliveryZone,
            $productOrder, $attachedProductOrder, $productOrderTotal
        ) {
            // Refund whatever this order previously spent before charging
            // the new one — recomputed fresh against the restored balance,
            // not adjusted incrementally, so an edit can never leak or
            // double-spend referral percent. Free kg needs no equivalent
            // refund here — it's never actually spent until payment (see
            // Order::applyReferralFreeKg), so a pending order being edited
            // never touched the balance in the first place.
            if ((float) $order->referral_percent_used > 0) {
                $user->increment('referral_discount_percent_available', (float) $order->referral_percent_used);
            }

            [$freeKgDiscountAmount, $freeKgUsed] = $this->referralFreeKgDiscount($user->fresh(), (float) $validated['kg'], (float) $pricePerKg, $gasCostWaived);

            $remainingAfterLoyalty = max((float) $validated['kg'] * (float) $pricePerKg - ($loyaltyDiscountAmount ?? 0) - $freeKgDiscountAmount, 0);
            [$referralDiscountAmount, $referralPercentUsed] = $this->referralDiscount($user->fresh(), $remainingAfterLoyalty, $gasCostWaived);

            $order->update([
                'cylinder_image' => $newImagePath,
                'kg' => $validated['kg'],
                'price_per_kg' => $pricePerKg,
                'loyalty_discount_applied' => $loyaltyDiscountApplied,
                'loyalty_discount_amount' => $loyaltyDiscountAmount,
                'delivery_fee' => $deliveryFee,
                'referral_discount_amount' => $referralDiscountAmount,
                'referral_percent_used' => $referralPercentUsed,
                'referral_free_kg_applied' => $freeKgUsed,
                'referral_free_kg_discount_amount' => $freeKgDiscountAmount,
                'vvip_discount_amount' => $vvipDiscountAmount,
                'product_order_id' => $productOrder?->id,
                'attached_product_order_id' => $attachedProductOrder?->id,
                'total_amount' => round(
                    max($validated['kg'] * $pricePerKg - ($loyaltyDiscountAmount ?? 0) - $freeKgDiscountAmount - $referralDiscountAmount - $vvipDiscountAmount, 0)
                    + $deliveryFee + $productOrderTotal, 2
                ),
                'hostel_address' => $validated['hostel_address'],
                'location_type' => $validated['location_type'],
                'delivery_zone_id' => $deliveryZone?->id,
                // The order's details just changed, so any transaction
                // already started against it (see pay()) was for the OLD
                // amount — clear it so the next pay() call starts a fresh
                // one instead of handing back a stale authorization URL.
                'paystack_reference' => null,
                'payment_authorization_url' => null,
                'payment_gateway' => null,
                'flutterwave_tx_ref' => null,
            ]);

            if ($referralPercentUsed > 0) {
                $user->decrement('referral_discount_percent_available', $referralPercentUsed);
            }

            // referral_free_kg_balance stays untouched here too — see the
            // matching comment in store() above.

            return $order;
        });

        // Outside the transaction, same reasoning as everywhere else in this
        // controller — a slow/failed disk delete shouldn't roll back a
        // write that already succeeded. Never the shared profile default.
        if ($oldImagePath && $oldImagePath !== $newImagePath && $oldImagePath !== $user->cylinder_image) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return response()->json($updated->fresh(['productOrder.items', 'attachedProductOrder.items']));
    }

    public function myOrders(Request $request)
    {
        return response()->json(
            $request->user()->orders()
                ->withTrashed()
                ->with(['productOrder.items', 'attachedProductOrder.items'])
                ->latest()
                ->get()
        );
    }

    public function index()
    {
        return response()->json(
            Order::with(['user.permissions', 'productOrder.items', 'attachedProductOrder.items'])->latest()->get()
        );
    }

    public function pay(Request $request, Order $order)
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

        if (! Setting::current()->paystack_enabled) {
            return response()->json([
                'message' => 'Paystack is not currently available. Please choose another payment option.',
            ], 422);
        }

        if ($order->paystack_reference && $order->payment_authorization_url && $order->payment_gateway === 'paystack') {
            return response()->json([
                'authorization_url' => $order->payment_authorization_url,
                'reference' => $order->paystack_reference,
            ]);
        }

        $reference = 'order_'.$order->id.'_'.Str::random(10);

        try {
            $response = Http::withToken(config('services.paystack.secret_key'))->timeout(10)
                ->post('https://api.paystack.co/transaction/initialize', [
                    'email' => $user->email,
                    'amount' => (int) ($order->total_amount * 100),
                    'reference' => $reference,
                    'callback_url' => config('services.paystack.callback_url'),
                ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('Paystack connection error: '.$e->getMessage());

            return response()->json([
                'message' => 'Unable to reach the payment provider. Please try again shortly.',
            ], 500);
        }

        if (! $response->successful() || ! $response->json('status')) {
            Log::error('Paystack initialize transaction failed', [
                'order_id' => $order->id,
                'response' => $response->json(),
            ]);

            return response()->json([
                'message' => 'Unable to initialize payment. Please try again shortly.',
            ], 500);
        }

        $order->update([
            'paystack_reference' => $reference,
            'payment_gateway' => 'paystack',
            'payment_authorization_url' => $response->json('data.authorization_url'),
        ]);

        return response()->json([
            'authorization_url' => $response->json('data.authorization_url'),
            'reference' => $reference,
        ]);
    }

    // Paystack's webhook is the async, "belt and braces" confirmation path —
    // but it requires Paystack's servers to reach ours, which only works
    // once this app is deployed behind a public URL. This is the
    // synchronous counterpart: right after Paystack redirects the student
    // back, the frontend calls this so the backend asks Paystack directly
    // whether the charge actually succeeded, rather than waiting on a
    // webhook that may never arrive (e.g. in local development).
    public function verifyPayment(Request $request, Order $order)
    {
        $user = $request->user();

        if ($order->user_id !== $user->id) {
            abort(403, 'This order does not belong to you.');
        }

        if ($order->status !== 'pending') {
            return response()->json([
                'order' => $order,
                'paystack_status' => 'success',
                'loyalty' => array_merge(
                    $order->user->loyaltySummary(),
                    ['discount_applied_to_this_order' => (bool) $order->loyalty_discount_applied]
                ),
            ]);
        }

        if (! $order->paystack_reference) {
            throw ValidationException::withMessages([
                'status' => ['No payment has been started for this order yet.'],
            ]);
        }

        try {
            $response = Http::withToken(config('services.paystack.secret_key'))->timeout(10)
                ->get('https://api.paystack.co/transaction/verify/'.$order->paystack_reference);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('Paystack verify connection error: '.$e->getMessage());

            return response()->json([
                'message' => 'Unable to reach the payment provider. Please try again shortly.',
            ], 500);
        }

        if (! $response->successful() || ! $response->json('status')) {
            Log::error('Paystack verify transaction failed', [
                'order_id' => $order->id,
                'response' => $response->json(),
            ]);

            return response()->json([
                'message' => 'Unable to verify this payment right now. Please try again shortly.',
            ], 500);
        }

        $paystackStatus = $response->json('data.status');
        $amountPaidInKobo = $response->json('data.amount');
        $expectedAmountInKobo = (int) ($order->total_amount * 100);

        if ($paystackStatus === 'success' && $amountPaidInKobo === $expectedAmountInKobo) {
            // Locked and re-checked inside a transaction — this call can
            // race the Paystack webhook hitting the same order at the same
            // time (see PaystackWebhookController::handleOrderPayment for
            // the full reasoning); without the lock both could apply these
            // side effects twice.
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

                // A bundled cart that was still `pending` was paid for as
                // part of this exact charge — it never gets its own
                // paystack_reference (its own pay() is never called in the
                // bundled path), so mark it paid here, in lockstep with the
                // gas order it rode in on. An already-`approved` cart
                // (attached after being paid for standalone) is left
                // untouched — it kept its own real paid_at, this order
                // never charged for it.
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

                // Last, deliberately, and outside the transaction: this
                // talks to an external SMTP server and can hang or time out
                // (seen in production — a stuck send here once
                // fatal-errored the whole request past PHP's execution-time
                // limit). Nothing above may depend on the email having
                // sent, and holding the DB transaction open across a slow
                // SMTP call would only make things worse.
                $approved->sendReceiptEmail();
            }
        } elseif ($paystackStatus === 'success') {
            // Paid, but not the right amount — don't silently approve it.
            Log::warning('Paystack verify amount mismatch', [
                'order_id' => $order->id,
                'expected' => $expectedAmountInKobo,
                'paid' => $amountPaidInKobo,
            ]);
        }

        // The student's loyalty standing *after* this payment settled — so
        // the callback screen can tell them how much kg is left to unlock the
        // next reward, that a reward is now waiting, or that this order just
        // spent one.
        $loyalty = array_merge(
            $order->user->fresh()->loyaltySummary(),
            ['discount_applied_to_this_order' => (bool) $order->loyalty_discount_applied]
        );

        return response()->json([
            'order' => $order->fresh(),
            'paystack_status' => $paystackStatus,
            'loyalty' => $loyalty,
        ]);
    }

    public function updateStatus(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['picked_up', 'delivered'])],
        ]);

        // Idempotent no-op: a repeated confirm (double click, retried
        // request) that lands after the first one already applied should
        // just hand back the current order instead of writing again.
        if ($order->status === $validated['status']) {
            return response()->json($order);
        }

        $order->update(['status' => $validated['status']]);
        $order->notifyStatusChange();

        // Any cart riding on this same delivery trip — bundled or attached —
        // has its fulfilment status follow the order's, one delivery tracked
        // in one place. Payment for each already happened (bundled: as part
        // of this order's single charge; attached: standalone earlier), so
        // only the status moves here.
        if ($order->product_order_id) {
            $order->productOrder?->update(['status' => $validated['status']]);
        }
        if ($order->attached_product_order_id) {
            $order->attachedProductOrder?->update(['status' => $validated['status']]);
        }

        return response()->json($order);
    }

    // Admin-only soft delete — only ever for an order the student hasn't
    // paid for yet. A soft delete, not a real one: Order uses SoftDeletes
    // (see the model), so this just sets deleted_at, which is enough to
    // drop it out of every normal admin query (index/updateStatus/this
    // route itself all deliberately resolve WITHOUT withTrashed()) without
    // actually destroying the row. The student-facing routes (edit/pay/
    // verify-payment/the gateway equivalents) explicitly DO use
    // withTrashed(), so they keep working on this exact order — and the
    // moment it's actually paid for, the payment-confirmation code calls
    // $locked->restore(), which is what makes it reappear on the admin side.
    public function destroy(Order $order)
    {
        if ($order->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['Only an order still awaiting payment can be deleted this way.'],
            ]);
        }

        $order->delete();

        return response()->json(['message' => 'Order deleted.']);
    }

    // Shared by store() and update() — the loyalty/VVIP side of pricing
    // depends only on the user's standing and the kg/price being ordered,
    // never on anything an edit needs to refund first (unlike referral,
    // see referralDiscount() below). Returns
    // [gasCostWaived, loyaltyDiscountApplied, loyaltyDiscountAmount, vvipDiscountAmount].
    private function loyaltyAndVvipDiscounts(User $user, float $kg, float $pricePerKg, Setting $setting): array
    {
        // VVIP goes further than VIP: the gas cost itself is free too (see
        // User::getsFreeGas). Nothing left to discount on an already-free
        // order, so referral/loyalty are skipped entirely rather than being
        // computed and spent for zero actual benefit.
        $gasCostWaived = $user->getsFreeGas();

        // Once the student's running kg total (loyalty_progress_kg,
        // advanced only by paid orders — see Order::applyLoyaltyProgress)
        // reaches the admin's threshold, the portion of an order BEYOND
        // what was still needed to complete the threshold is discounted, on
        // that same order. price_per_kg stays the normal/offer rate — the
        // discount is its own line item subtracted from the total, so "gas
        // cost" on receipts reads honestly.
        $loyaltyDiscountApplied = false;
        $loyaltyDiscountAmount = null;

        if (! $gasCostWaived && $setting->loyaltyActive()) {
            $neededToComplete = max((float) $setting->loyalty_threshold_kg - (float) $user->loyalty_progress_kg, 0);
            $discountableKg = max($kg - $neededToComplete, 0);

            if ($discountableKg > 0) {
                $loyaltyDiscountAmount = round($pricePerKg * $discountableKg * ((float) $setting->loyalty_discount_percent / 100), 2);
                $loyaltyDiscountApplied = true;
            }
        }

        // The whole remaining gas cost, wiped out as its own line item.
        $vvipDiscountAmount = $gasCostWaived ? round($kg * $pricePerKg, 2) : 0.0;

        return [$gasCostWaived, $loyaltyDiscountApplied, $loyaltyDiscountAmount, $vvipDiscountAmount];
    }

    // Spends the student's referral_discount_percent_available balance (a
    // running PERCENT, not a coupon count — a legacy mechanic, grandfathered:
    // nothing grants NEW percent any more, see User::grantReferralCommissionOnce
    // for what referrals earn now. Each already-granted referral just added
    // its percent straight onto it, so referring 2 people at 70% each could
    // leave a 140% balance), applied to
    // whatever's still owed AFTER the loyalty discount — loyalty goes
    // first, referral only discounts what's left. A single order can only
    // use up to 100% of the remaining amount; anything beyond that stays on
    // the account for a future order — the caller only ever decrements
    // $referralPercentUsed, never the whole balance. Split out from
    // loyaltyAndVvipDiscounts() because update() must refund an order's
    // previous spend and re-read the balance in between — this always
    // reads $user's CURRENT balance, so the caller controls sequencing.
    // Returns [referralDiscountAmount, referralPercentUsed].
    private function referralDiscount(User $user, float $remainingAfterLoyalty, bool $gasCostWaived): array
    {
        $referralDiscountAmount = 0.0;
        $referralPercentUsed = 0.0;

        if (! $gasCostWaived && $remainingAfterLoyalty > 0) {
            $referralPercentAvailable = (float) $user->referral_discount_percent_available;

            if ($referralPercentAvailable > 0) {
                $referralPercentUsed = min($referralPercentAvailable, 100.0);
                $referralDiscountAmount = round($remainingAfterLoyalty * ($referralPercentUsed / 100), 2);
            }
        }

        return [$referralDiscountAmount, $referralPercentUsed];
    }

    // Spends the student's referral_free_kg_balance — a running KG credit
    // (not currency), earned 3kg at a time whenever one of THEIR referrals
    // completes the referral cycle (see User::checkReferralCycleCompletion).
    // Applied straight after the loyalty discount and before the legacy
    // referral-percent spend, so the stacking order is: loyalty -> free-kg
    // credit -> referral percent on whatever's left -> VVIP (which waives
    // everything and skips the rest entirely, same as it already does for
    // loyalty/referral).
    //
    // Capped at 3kg of SPENDING per calendar month, cumulative across
    // however many orders it takes — not a single-use lock. referral_free_kg_month
    // ("Y-m") + referral_free_kg_month_used track how much of that month's
    // 3kg has already gone to a discount; a stale month value (from a prior
    // month) is simply treated as 0 used so far, no reset job needed. This
    // caps SPENDING only — earning (the balance itself growing +3kg per
    // completed cycle) is untouched and uncapped.
    //
    // Also never covers more than $kg itself — can't discount more kg than
    // was ordered. Split out the same way referralDiscount() is, for the
    // same reason: update() must refund an order's previous spend and
    // re-read the balance in between.
    // Returns [freeKgDiscountAmount, freeKgUsed].
    private function referralFreeKgDiscount(User $user, float $kg, float $pricePerKg, bool $gasCostWaived): array
    {
        $freeKgDiscountAmount = 0.0;
        $freeKgUsed = 0.0;

        if (! $gasCostWaived && $kg > 0) {
            $freeKgBalance = (float) $user->referral_free_kg_balance;
            $monthUsed = $user->referral_free_kg_month === now()->format('Y-m')
                ? (float) $user->referral_free_kg_month_used
                : 0.0;
            $monthRemaining = max(User::REFERRAL_FREE_KG_REWARD - $monthUsed, 0);

            if ($freeKgBalance > 0 && $monthRemaining > 0) {
                $freeKgUsed = min($freeKgBalance, $kg, $monthRemaining);
                $freeKgDiscountAmount = round($freeKgUsed * $pricePerKg, 2);
            }
        }

        return [$freeKgDiscountAmount, $freeKgUsed];
    }
}
