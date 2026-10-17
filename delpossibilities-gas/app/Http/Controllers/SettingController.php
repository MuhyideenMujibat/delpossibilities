<?php

namespace App\Http\Controllers;

use App\Mail\BroadcastOfferMail;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class SettingController extends Controller
{
    public function showPrice()
    {
        return response()->json(Setting::cachedPricePayload());
    }

    // Public: tells the frontend which gateway(s) are currently available so
    // it knows whether to show a picker (both on) or go straight to
    // whichever one is on. Also used at pay-time to reject a request for a
    // gateway the admin has switched off (see FlutterwaveController and
    // OrderController::pay / SubscriberController::pay).
    public function paymentGateways()
    {
        return response()->json(Setting::cachedGatewayPayload());
    }

    public function updatePrice(Request $request)
    {
        $validated = $request->validate([
            'price_per_kg' => ['required', 'numeric', 'min:0'],
            'delivery_fee' => ['sometimes', 'numeric', 'min:0'],
            'off_campus_delivery_fee' => ['sometimes', 'numeric', 'min:0'],
            'offer_active' => ['sometimes', 'boolean'],
            'offer_title' => ['nullable', 'string', 'max:120'],
            'offer_message' => ['nullable', 'string', 'max:1000'],
            'offer_price_per_kg' => ['nullable', 'numeric', 'min:0'],
            'broadcast_active' => ['sometimes', 'boolean'],
            'broadcast_message' => ['nullable', 'string', 'max:500'],
            'broadcast_slot1_pickup' => ['nullable', 'date_format:H:i'],
            'broadcast_slot1_delivery' => ['nullable', 'date_format:H:i'],
            'broadcast_slot2_pickup' => ['nullable', 'date_format:H:i'],
            'broadcast_slot2_delivery' => ['nullable', 'date_format:H:i'],
            'loyalty_enabled' => ['sometimes', 'boolean'],
            'loyalty_threshold_kg' => ['nullable', 'numeric', 'min:0.01'],
            'loyalty_discount_percent' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'referral_discount_percent' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'referral_commission_amount' => ['nullable', 'numeric', 'min:0'],
            'referral_milestone_referred_count' => ['nullable', 'integer', 'min:1'],
            'referral_milestone_kg' => ['nullable', 'numeric', 'min:0.01'],
            'session_starts_at' => ['nullable', 'date'],
            'session_ends_at' => ['nullable', 'date'],
            'semester_starts_at' => ['nullable', 'date'],
            'semester_ends_at' => ['nullable', 'date'],
            'investment_bank_name' => ['nullable', 'string', 'max:255'],
            'investment_account_name' => ['nullable', 'string', 'max:255'],
            'investment_account_number' => ['nullable', 'string', 'max:255'],
            'investment_monthly_rate_percent' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'investment_minimum_amount' => ['nullable', 'numeric', 'min:0.01'],
            'investment_tenures_months' => ['nullable', 'array', 'min:1'],
            'investment_tenures_months.*' => ['integer', 'min:1'],
            'investment_whatsapp_number' => ['nullable', 'string', 'max:32'],
            'paystack_enabled' => ['sometimes', 'boolean'],
            'flutterwave_enabled' => ['sometimes', 'boolean'],
        ]);

        $setting = Setting::current();
        $setting->update([
            'price_per_kg' => $validated['price_per_kg'],
            'delivery_fee' => $validated['delivery_fee'] ?? 0,
            'off_campus_delivery_fee' => $validated['off_campus_delivery_fee'] ?? 0,
            'offer_active' => $validated['offer_active'] ?? false,
            'offer_title' => $validated['offer_title'] ?? null,
            'offer_message' => $validated['offer_message'] ?? null,
            'offer_price_per_kg' => $validated['offer_price_per_kg'] ?? null,
            'broadcast_active' => $validated['broadcast_active'] ?? false,
            'broadcast_message' => $validated['broadcast_message'] ?? null,
            'broadcast_slot1_pickup' => $validated['broadcast_slot1_pickup'] ?? null,
            'broadcast_slot1_delivery' => $validated['broadcast_slot1_delivery'] ?? null,
            'broadcast_slot2_pickup' => $validated['broadcast_slot2_pickup'] ?? null,
            'broadcast_slot2_delivery' => $validated['broadcast_slot2_delivery'] ?? null,
            'loyalty_enabled' => $validated['loyalty_enabled'] ?? false,
            'loyalty_threshold_kg' => $validated['loyalty_threshold_kg'] ?? null,
            'loyalty_discount_percent' => $validated['loyalty_discount_percent'] ?? null,
            'referral_discount_percent' => $validated['referral_discount_percent'] ?? null,
            'referral_commission_amount' => $validated['referral_commission_amount'] ?? null,
            'referral_milestone_referred_count' => $validated['referral_milestone_referred_count'] ?? null,
            'referral_milestone_kg' => $validated['referral_milestone_kg'] ?? null,
            'session_starts_at' => $validated['session_starts_at'] ?? null,
            'session_ends_at' => $validated['session_ends_at'] ?? null,
            'semester_starts_at' => $validated['semester_starts_at'] ?? null,
            'semester_ends_at' => $validated['semester_ends_at'] ?? null,
            'investment_bank_name' => $validated['investment_bank_name'] ?? $setting->investment_bank_name,
            'investment_account_name' => $validated['investment_account_name'] ?? $setting->investment_account_name,
            'investment_account_number' => $validated['investment_account_number'] ?? $setting->investment_account_number,
            'investment_monthly_rate_percent' => $validated['investment_monthly_rate_percent'] ?? $setting->investment_monthly_rate_percent,
            'investment_minimum_amount' => $validated['investment_minimum_amount'] ?? $setting->investment_minimum_amount,
            'investment_tenures_months' => $validated['investment_tenures_months'] ?? $setting->investment_tenures_months,
            'investment_whatsapp_number' => $validated['investment_whatsapp_number'] ?? $setting->investment_whatsapp_number,
            'paystack_enabled' => $validated['paystack_enabled'] ?? $setting->paystack_enabled,
            'flutterwave_enabled' => $validated['flutterwave_enabled'] ?? $setting->flutterwave_enabled,
        ]);

        return response()->json($setting);
    }

    public function broadcastOffer(Request $request)
    {
        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:120'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $users = User::where('role', 'student')->whereNotNull('email')->get();

        // Queued, one per recipient — this used to send synchronously in a
        // loop, meaning the admin's request blocked on however many hundred
        // SMTP round-trips a full broadcast took, with no record of who'd
        // been sent to if it died partway through. Queueing hands each send
        // to a worker independently, so one slow/failed send doesn't hold
        // up (or lose track of) the rest.
        foreach ($users as $user) {
            Mail::to($user->email)->queue(new BroadcastOfferMail($validated['subject'], $validated['message']));
        }

        return response()->json([
            'message' => 'Broadcast queued.',
            'recipients' => $users->count(),
        ]);
    }
}
