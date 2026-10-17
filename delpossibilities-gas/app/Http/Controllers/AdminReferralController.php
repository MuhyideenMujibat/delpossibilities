<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class AdminReferralController extends Controller
{
    // Every user with at least one successful referral (referral_commission_granted
    // on the referred side — see User::grantReferralCommissionOnce), ranked by
    // referred_count desc (ties broken by referred_kg desc) so the admin can
    // read straight down the list to decide who to make an official Brand
    // Ambassador (see ::toggleAmbassador below — that's now a manual call,
    // not auto-granted on cycle completion).
    public function index()
    {
        $referrers = User::whereHas('referrals', fn ($q) => $q->where('referral_commission_granted', true))
            ->withCount(['referrals as referred_count' => fn ($q) => $q->where('referral_commission_granted', true)])
            ->withSum(['referrals as referred_kg' => fn ($q) => $q->where('referral_commission_granted', true)], 'referral_commission_kg')
            ->withCount('referralMonthlyRewards as cylinders_earned')
            ->orderByDesc('referred_count')
            ->orderByDesc('referred_kg')
            ->get(['id', 'name', 'customer_id', 'is_brand_ambassador', 'brand_ambassador_since', 'referral_commission_balance']);

        // referred_kg is a SUM() over referral_commission_kg, which is null
        // for any successful referral granted before that column existed —
        // SUM() over all-null rows returns null, not 0, so cast it back to
        // a real number rather than letting the frontend render a blank.
        $referrers->each(fn ($referrer) => $referrer->referred_kg = (float) $referrer->referred_kg);

        return response()->json($referrers);
    }

    // Admin's manual call — see the big comment in User::checkReferralCycleCompletion
    // for why this isn't auto-granted any more. Turning it off intentionally
    // leaves brand_ambassador_since alone (a historical fact, not something
    // that should disappear just because status is toggled off and maybe
    // back on later); turning it on only stamps the timestamp the first time.
    public function toggleAmbassador(Request $request, User $user)
    {
        $validated = $request->validate([
            'is_brand_ambassador' => ['required', 'boolean'],
        ]);

        $user->update([
            'is_brand_ambassador' => $validated['is_brand_ambassador'],
            'brand_ambassador_since' => $validated['is_brand_ambassador'] && ! $user->is_brand_ambassador
                ? now()
                : $user->brand_ambassador_since,
        ]);

        return response()->json($user);
    }
}
