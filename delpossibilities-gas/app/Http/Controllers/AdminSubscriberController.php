<?php

namespace App\Http\Controllers;

use App\Models\Subscriber;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AdminSubscriberController extends Controller
{
    // Lets an admin hand a student a fully-active subscription without them
    // ever touching a payment gateway — e.g. a sponsored slot, a goodwill
    // gesture, correcting a payment that happened outside the app. Mirrors
    // SubscriberController::store()'s shape, then immediately runs the exact
    // same activate() every real payment confirmation calls, so the result
    // is indistinguishable from a genuine purchase: same status, same
    // remaining_kg, same calendar window. No referral discount is computed
    // here — this isn't a real purchase the student is paying for, so
    // there's nothing to spend a referral balance on.
    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'subscription_plan_id' => ['required', 'integer', 'exists:subscription_plans,id'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'recipient_phone' => ['nullable', 'string', 'max:255'],
            'recipient_address' => ['nullable', 'string', 'max:255'],
        ]);

        $user = User::findOrFail($validated['user_id']);

        if ($user->role !== 'student') {
            throw ValidationException::withMessages([
                'user_id' => ['Only a student account can hold a subscription.'],
            ]);
        }

        // Same "one USABLE subscription at a time" rule a student hits in
        // SubscriberController::store — an active row that's out of kg or
        // past its end date doesn't block, so an exhausted one can be
        // replaced.
        if ($user->subscribers()->usable()->exists()) {
            throw ValidationException::withMessages([
                'user_id' => ["{$user->name} already has an active subscription — they can't be given another until it's used up, expires or is cancelled."],
            ]);
        }

        $plan = SubscriptionPlan::findOrFail($validated['subscription_plan_id']);

        if (! Subscriber::calendarReady($plan->package_type)) {
            throw ValidationException::withMessages([
                'subscription_plan_id' => ['Set the session/semester calendar for this package type before adding a subscriber to it.'],
            ]);
        }

        $price = $validated['price'] ?? (float) $plan->price;

        // recipient_name/phone/address are NOT NULL columns — defaulting to
        // the user's own profile only works if that profile is actually
        // filled in. Without this check, a user who never set a phone/hostel
        // would turn into a raw DB constraint violation instead of a message
        // telling the admin to just supply the recipient fields themselves.
        $recipientName = $validated['recipient_name'] ?? $user->name;
        $recipientPhone = $validated['recipient_phone'] ?? $user->phone;
        $recipientAddress = $validated['recipient_address'] ?? $user->hostel;

        if (! $recipientName || ! $recipientPhone || ! $recipientAddress) {
            throw ValidationException::withMessages([
                'recipient_phone' => ['This student is missing a phone or hostel/address on their profile — supply the recipient name, phone, and address for this subscription directly.'],
            ]);
        }

        $subscriber = $user->subscribers()->create([
            'customer_id' => $user->customer_id ?: Subscriber::generateCustomerId(),
            'subscription_plan_id' => $plan->id,
            'locked_price' => $price,
            'total_amount' => $price,
            'status' => 'pending',
            'recipient_name' => $recipientName,
            'recipient_phone' => $recipientPhone,
            'recipient_address' => $recipientAddress,
        ]);

        $payment = $subscriber->payments()->create([
            'amount' => $price,
            'method' => 'manual',
        ]);

        $subscriber->activate($payment);

        // 'payments' loaded alongside 'plan' so the admin UI can immediately
        // show the Cancel option for this manually-created subscriber (see
        // SubscriberController::cancel / AdminSubscribers.jsx's
        // isCancellable) without needing a page reload first. 'user' is
        // loaded for the same reason: the table's Name column and the
        // search read subscriber.user, which the list endpoint includes but
        // a bare create response wouldn't.
        return response()->json($subscriber->fresh()->load(['user', 'plan', 'payments']), 201);
    }
}
