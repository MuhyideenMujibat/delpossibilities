<?php


namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    // Default percentage added to a referrer's balance per qualifying
    // referral (see referral_discount_percent_available) — used only when
    // the admin hasn't set Setting::referral_discount_percent (see
    // Setting::referralDiscountPercent).
    public const REFERRAL_DISCOUNT_PERCENT = 10;

    // How much free gas (kg) is credited to referral_free_kg_balance each
    // calendar month a referrer hits the 10-distinct-referrers+30kg milestone
    // (see evaluateMonthlyReferralMilestone). Not admin-configurable — the
    // request specifically asked for "free 3kg", unlike the cash commission
    // and old referral percent, which are.
    public const REFERRAL_FREE_KG_REWARD = 3;

    // Fallback defaults for the monthly milestone (see
    // evaluateMonthlyReferralMilestone) when the admin hasn't set
    // Setting::referral_milestone_referred_count / ::referral_milestone_kg —
    // both are admin-editable (see Setting::referralMilestoneReferredCount /
    // ::referralMilestoneKg), these constants only cover the unconfigured case.
    public const REFERRAL_MILESTONE_REFERRED_COUNT = 10;

    public const REFERRAL_MILESTONE_KG = 30;

    // The three membership_tier values a student account can hold — 'none'
    // is the plain default, set by an admin only at account creation (see
    // AdminUserController::store). 'vip' and 'vvip' are never valid for an
    // employee/admin account.
    public const TIER_NONE = 'none';

    public const TIER_VIP = 'vip';

    public const TIER_VVIP = 'vvip';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'membership_tier',
        'user_type_id',
        'hostel',
        'location_type',
        'phone',
        'cylinder_image',
        'email_verified_at',
        'referred_by_user_id',
        'referral_reward_granted',
        'referral_discount_percent_available',
        'referral_commission_balance',
        'referral_free_kg_balance',
        'referral_cycle_kg',
        'referral_cycle_friends_count',
        'is_brand_ambassador',
        'brand_ambassador_since',
        'referral_commission_granted',
        'referral_commission_kg',
        'referral_free_kg_month',
        'referral_free_kg_month_used',
    ];

    protected $appends = [
        'cylinder_image_url',
        'permission_keys',
        'loyalty_reward_available',
        'loyalty_kg_to_next_reward',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'loyalty_progress_kg' => 'decimal:2',
            'referral_reward_granted' => 'boolean',
            'referral_discount_percent_available' => 'decimal:2',
            'referral_commission_balance' => 'decimal:2',
            'referral_free_kg_balance' => 'decimal:2',
            'referral_cycle_kg' => 'decimal:2',
            'referral_cycle_friends_count' => 'integer',
            'is_brand_ambassador' => 'boolean',
            'brand_ambassador_since' => 'datetime',
            'referral_commission_granted' => 'boolean',
            'referral_commission_kg' => 'decimal:2',
            'referral_free_kg_month_used' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        // Every account gets a shareable customer/referral code the moment
        // it's created — no longer tied to subscribing (see Subscriber, which
        // now reuses this code instead of minting its own). It's just the
        // account's own id, zero-padded, scoped by signup year:
        // DEL-2026-0042. Set on `created`, not `creating`, because the id
        // isn't assigned until the row is inserted.
        static::created(function (User $user) {
            if (blank($user->customer_id)) {
                $user->forceFill([
                    'customer_id' => static::customerIdFor($user),
                ])->saveQuietly();
            }
        });
    }

    public static function customerIdFor(User $user): string
    {
        $year = $user->created_at?->year ?? now()->year;

        return 'DEL-'.$year.'-'.str_pad((string) $user->id, 4, '0', STR_PAD_LEFT);
    }

    public function orders()
{
    return $this->hasMany(Order::class);
}

    public function subscribers()
    {
        return $this->hasMany(Subscriber::class);
    }

    public function productOrders()
    {
        return $this->hasMany(ProductOrder::class);
    }

    public function investments()
    {
        return $this->hasMany(Investment::class);
    }

    public function referrer()
    {
        return $this->belongsTo(User::class, 'referred_by_user_id');
    }

    // VIP and VVIP both waive the delivery fee on every order type — gas,
    // Eazy Market, and accessories (see OrderController::store and
    // ProductOrderController::store). VVIP goes further (see getsFreeGas).
    public function getsFreeDelivery(): bool
    {
        return in_array($this->membership_tier, [self::TIER_VIP, self::TIER_VVIP], true);
    }

    // VVIP only — the gas cost itself is waived on a gas order, on top of
    // the free delivery every VIP/VVIP account gets. Shop goods (Eazy
    // Market/accessories) are still paid for either way, just delivered free.
    public function getsFreeGas(): bool
    {
        return $this->membership_tier === self::TIER_VVIP;
    }

    // An investor gets free delivery on a GAS order specifically — not the
    // gas cost itself, and not Eazy Market/accessory delivery (that stays
    // gated to VIP/VVIP alone, see getsFreeDelivery). Checked only in
    // OrderController::store.
    public function getsFreeGasDelivery(): bool
    {
        return $this->getsFreeDelivery() || $this->is_investor;
    }

    // "Investor" = has at least one investment whose contract is actually
    // signed — a completed investment, not one still pending payment or
    // awaiting signature (see Investment status flow in InvestmentController).
    // Not in $appends (so this doesn't run once per row when many users are
    // serialized at once, e.g. AdminStudentController::index) — the /user
    // route opts in explicitly via ->append('is_investor').
    protected function isInvestor(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->investments()->where('status', 'signed')->exists(),
        );
    }

    // Called from every paid-gas-order side effect (OrderController::verify,
    // FlutterwaveController, FlutterwaveWebhookController,
    // PaystackWebhookController) — this is $order->user, the REFERRED student,
    // not the referrer. No kg minimum: whatever this order's kg is gets
    // passed straight into the shared one-shot grant below.
    public function grantReferralRewardForGasOrder(Order $order): void
    {
        $this->grantReferralCommissionOnce((float) $order->kg);
    }

    // Called from RefillController::update, the moment a refill is marked
    // 'delivered' (the only point a subscription-backed refill has a real,
    // finalized kg — there's no payment step to hang this on the way a gas
    // order has, see Refill model). NOT called at subscription activation:
    // if a referred student's subscription is what ends up qualifying them,
    // it's specifically their FIRST delivered refill's kg that counts, same
    // as a plain gas order's kg would — kg_delivered, not kg_requested,
    // since that's what's actually left the admin's stock (and matches what
    // draws down the subscriber's remaining_kg, see RefillController::update).
    public function grantReferralRewardForRefill(Refill $refill): void
    {
        $this->grantReferralCommissionOnce((float) $refill->kg_delivered);
    }

    // Fires AT MOST ONCE per referred student (this user) — on whichever
    // qualifying event (a paid gas order or a subscription) they reach
    // FIRST. referral_commission_granted is that one-shot gate: once set, a
    // second order, a subscription after an order, or vice versa, adds
    // nothing further — no more cash commission, no more kg/friend
    // contribution toward the referrer's cycle. This is the "per referred
    // person, not per order" shape the program is meant to have; it mirrors
    // the legacy referral_reward_granted flag's own one-shot design, just as
    // its own column so that older flag (and the percent balances it
    // produced) stay untouched/grandfathered.
    //
    // Cash commission: a flat ₦ amount (Setting::referralCommissionAmount,
    // defaults to 0 = nothing granted until admin sets one) added to the
    // referrer's referral_commission_balance — not spendable on orders, paid
    // out by admin outside the app.
    //
    // Cycle contribution: referral_cycle_friends_count always goes up by
    // exactly 1 (this referred student, counted once, ever); referral_cycle_kg
    // goes up by $kg (0 for a subscription). The moment both hit their
    // admin-configured targets (see checkReferralCycleCompletion), the cycle
    // completes.
    private function grantReferralCommissionOnce(float $kg): void
    {
        if (! $this->referred_by_user_id || $this->referral_commission_granted) {
            return;
        }

        $referrer = static::find($this->referred_by_user_id);

        if (! $referrer) {
            return;
        }

        $amount = Setting::current()->referralCommissionAmount();

        if ($amount > 0) {
            $referrer->increment('referral_commission_balance', $amount);
        }

        $referrer->increment('referral_cycle_friends_count');
        $referrer->increment('referral_cycle_kg', $kg);
        $referrer->refresh();

        // Snapshotted here (on THIS, the referred user) rather than derived
        // later from order history — the admin referral leaderboard sums
        // this per referrer for "lifetime kg earned" (see
        // AdminReferralController::index), and re-deriving it from orders
        // would wrongly include orders placed after this one-shot grant,
        // which don't contribute anything further.
        $this->update([
            'referral_commission_granted' => true,
            'referral_commission_kg' => $kg,
        ]);

        $this->checkReferralCycleCompletion($referrer);
    }

    // The distinct-referred-friends + combined-kg milestone (both thresholds
    // admin-editable, see Setting::referralMilestoneReferredCount /
    // ::referralMilestoneKg) — a CONTINUOUS running cycle, same shape as
    // loyalty_progress_kg, not calendar-bound. The moment BOTH targets are
    // met, the cycle completes: free kg is granted, then both counters
    // reset — but only by exactly the target amount, so any overflow beyond
    // the target carries forward into the new cycle as a head start, instead
    // of being thrown away. Brand Ambassador status is NOT granted here —
    // that's now a manual admin decision (see AdminReferralController),
    // informed by the leaderboard this cycle data feeds.
    private function checkReferralCycleCompletion(User $referrer): void
    {
        $setting = Setting::current();
        $friendsTarget = $setting->referralMilestoneReferredCount();
        $kgTarget = $setting->referralMilestoneKg();

        if ($referrer->referral_cycle_friends_count < $friendsTarget || (float) $referrer->referral_cycle_kg < $kgTarget) {
            return;
        }

        // Cycle complete — log it and grant the free kg before resetting.
        ReferralMonthlyReward::create([
            'user_id' => $referrer->id,
            'distinct_referred_count' => $referrer->referral_cycle_friends_count,
            'total_kg' => $referrer->referral_cycle_kg,
            'free_kg_amount' => self::REFERRAL_FREE_KG_REWARD,
            'completed_at' => now(),
        ]);

        $referrer->increment('referral_free_kg_balance', self::REFERRAL_FREE_KG_REWARD);

        // Reset, carrying forward only the overflow beyond each target —
        // exactly at target leaves nothing to carry (resets to 0), same as
        // completing a loyalty threshold exactly.
        $overflowKg = round((float) $referrer->referral_cycle_kg - $kgTarget, 2);
        $overflowFriends = (int) $referrer->referral_cycle_friends_count - $friendsTarget;

        $referrer->update([
            'referral_cycle_kg' => max($overflowKg, 0),
            'referral_cycle_friends_count' => max($overflowFriends, 0),
        ]);
    }

    // The other side of referred_by_user_id — every account this user has
    // referred, successful or not (see successfulReferralsCount below for
    // the ones that actually paid out).
    public function referrals()
    {
        return $this->hasMany(User::class, 'referred_by_user_id');
    }

    // How many of this user's referrals qualified under the OLD, now-frozen
    // percent mechanic (a legacy, grandfathered flag — nothing sets it any
    // more, see grantReferralCommissionOnce for what counts today) and so
    // contributed to referral_discount_percent_available. Shown to the
    // referrer alongside their available balance (see Profile.jsx) so
    // "you have 20% available" reads as "3 referrals earned you this".
    // Not in $appends for the same reason is_investor isn't — this runs a
    // query per user, fine for the single /user response, wrong for a bulk
    // list (see AdminStudentController::index).
    protected function successfulReferralsCount(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->referrals()->where('referral_reward_granted', true)->count(),
        );
    }

    // History of this referrer's completed referral cycles (see
    // evaluateReferralCycleProgress) — one row every time they hit the
    // friends+kg milestone, not calendar-bound.
    public function referralMonthlyRewards()
    {
        return $this->hasMany(ReferralMonthlyReward::class);
    }

    // The CURRENT open cycle's running standing (see
    // evaluateReferralCycleProgress) — just reads the stored counters
    // directly, no query, since they're incremented/reset in real time
    // rather than computed on demand. Shown on the profile page as a
    // progress bar before the cycle's reward is actually earned. Not in
    // global $appends for consistency with the other per-user computed
    // attributes here; opted into explicitly by the GET /user route.
    protected function referralMonthlyProgress(): Attribute
    {
        return Attribute::make(
            get: function () {
                $setting = Setting::current();

                return [
                    'distinct_referred' => (int) $this->referral_cycle_friends_count,
                    'total_kg' => (float) $this->referral_cycle_kg,
                    'distinct_referred_target' => $setting->referralMilestoneReferredCount(),
                    'total_kg_target' => $setting->referralMilestoneKg(),
                ];
            },
        );
    }

    // How much of the 3kg-per-calendar-month free-kg SPENDING cap is still
    // available right now (see OrderController::referralFreeKgDiscount,
    // which this mirrors exactly) — lets CreateOrder.jsx preview the real
    // cap client-side instead of promising a discount the backend would
    // reject. A stale stored month is treated as 0 used so far, same as
    // the backend. Not in global $appends, opted into by GET /user.
    protected function referralFreeKgMonthRemaining(): Attribute
    {
        return Attribute::make(
            get: function () {
                $monthUsed = $this->referral_free_kg_month === now()->format('Y-m')
                    ? (float) $this->referral_free_kg_month_used
                    : 0.0;

                return max(self::REFERRAL_FREE_KG_REWARD - $monthUsed, 0);
            },
        );
    }

    // Computes how much of $baseAmount this user's
    // referral_discount_percent_available balance would discount, without
    // touching the balance — the caller decides whether/when to actually
    // decrement (see OrderController::store's own inline version, and
    // SubscriberController::store, which both need to fold the discount
    // into a price before committing to spend it). Mirrors
    // OrderController's referral maths exactly: at most 100% of
    // $baseAmount is spent per call, any balance beyond that stays on the
    // account for a future order or subscription.
    public function previewReferralDiscount(float $baseAmount): array
    {
        $discountAmount = 0.0;
        $percentUsed = 0.0;

        if ($baseAmount > 0) {
            $percentAvailable = (float) $this->referral_discount_percent_available;

            if ($percentAvailable > 0) {
                $percentUsed = min($percentAvailable, 100.0);
                $discountAmount = round($baseAmount * ($percentUsed / 100), 2);
            }
        }

        return [$discountAmount, $percentUsed];
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function userType()
    {
        return $this->belongsTo(UserType::class);
    }

    // The authoritative, per-person permission grants — copied from the
    // user type's defaults when the account is created, then editable
    // individually from the Add User / edit screens.
    public function permissions()
    {
        return $this->belongsToMany(Permission::class, 'permission_user');
    }

    protected function cylinderImageUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->cylinder_image ? Storage::disk('public')->url($this->cylinder_image) : null,
        );
    }

    // True once this student's running kg total (since their last redeemed
    // reward) has reached the admin-configured threshold — the portion of
    // their next order beyond the threshold gets the loyalty discount, and
    // the running total then resets.
    protected function loyaltyRewardAvailable(): Attribute
    {
        return Attribute::make(
            get: function () {
                $setting = Setting::forSerialization();

                if (! $setting->loyaltyActive()) {
                    return false;
                }

                return (float) $this->loyalty_progress_kg >= (float) $setting->loyalty_threshold_kg;
            },
        );
    }

    // How many more kg this student needs to buy (across paid orders) before
    // the loyalty discount kicks in. Null when the program is off; 0 once the
    // threshold is reached.
    protected function loyaltyKgToNextReward(): Attribute
    {
        return Attribute::make(
            get: function () {
                $setting = Setting::forSerialization();

                if (! $setting->loyaltyActive()) {
                    return null;
                }

                $remaining = (float) $setting->loyalty_threshold_kg - (float) $this->loyalty_progress_kg;

                return $remaining > 0 ? round($remaining, 2) : 0;
            },
        );
    }

    // One bundle of the student's current loyalty standing, for the frontend
    // to show after an order (see OrderController::verifyPayment) without
    // having to also fetch /price. Combines the admin config with this
    // student's own progress.
    public function loyaltySummary(): array
    {
        $setting = Setting::current();
        $active = $setting->loyaltyActive();

        return [
            'enabled' => $active,
            'threshold_kg' => $active ? (float) $setting->loyalty_threshold_kg : null,
            'discount_percent' => $active ? (float) $setting->loyalty_discount_percent : null,
            'progress_kg' => (float) $this->loyalty_progress_kg,
            'reward_available' => $this->loyalty_reward_available,
            'kg_to_next_reward' => $this->loyalty_kg_to_next_reward,
        ];
    }

    // Super admins implicitly hold every permission — they aren't tracked
    // in permission_user, so this is checked separately rather than relying
    // on the pivot table alone. Rides along on every auth response (login,
    // register/verify, GET /user) via $appends, so the frontend never needs
    // a second round trip just to know what an admin can see.
    protected function permissionKeys(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->role === 'super_admin'
                ? Permission::pluck('key')->values()
                // Uses the eager-loaded relation when a list endpoint
                // loaded it (->with('user.permissions')), so serializing N
                // users costs one query instead of N. Same result either way.
                : ($this->relationLoaded('permissions')
                    ? $this->permissions->pluck('key')->values()
                    : $this->permissions()->pluck('key')->values()),
        );
    }
}
