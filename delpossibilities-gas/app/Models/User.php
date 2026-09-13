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

    // Called from the paid-gas-order side effects (OrderController::verify and
    // PaystackWebhookController) — gates the gas-order trigger on 3 kg or
    // more before handing off to the shared grant below.
    public function grantReferralRewardForGasOrder(float $orderKg): void
    {
        if ($orderKg < 3) {
            return;
        }

        $this->grantReferralReward();
    }

    // Called from the subscription-activation side effects (Subscriber::activate,
    // reached via both SubscriberController::verifyPayment and
    // PaystackWebhookController). A subscription isn't measured in kg, so it
    // counts on its own — no threshold to clear, unlike a plain gas order.
    public function grantReferralRewardForSubscription(): void
    {
        $this->grantReferralReward();
    }

    // Shared grant: adds Setting::referral_discount_percent (see
    // Setting::referralDiscountPercent) straight onto the referrer's
    // running percent balance — once per referred student, whichever
    // qualifying event (a 3 kg+ gas order, or a subscription) they reach
    // first. The referral_reward_granted flag on this (the referred) user
    // keeps it idempotent across both trigger points and any retries.
    // Eazy Market-only orders don't count toward either trigger. Referring
    // several students stacks: two referrals at 70% each puts 140% on the
    // balance — an order only ever spends up to 100% of it (see
    // OrderController::store), so the other 40% stays on the balance
    // rather than being thrown away with the "used" coupon it came from.
    private function grantReferralReward(): void
    {
        if (! $this->referred_by_user_id || $this->referral_reward_granted) {
            return;
        }

        $referrer = static::find($this->referred_by_user_id);

        // A VVIP referrer never pays for gas in the first place, so a
        // percent-off-gas coupon is worthless to them — see the
        // referred_by_customer_id validation in AuthController::register,
        // which already blocks a VVIP account's Customer ID from being used
        // as a referral link. This is just defense in depth for the rare
        // case a referrer is promoted to VVIP after already referring
        // someone — left ungranted (not marked as spent) so a genuine
        // future qualifying event can still pay out if they're ever
        // demoted back off VVIP.
        if (! $referrer || $referrer->membership_tier === self::TIER_VVIP) {
            return;
        }

        $referrer->increment('referral_discount_percent_available', Setting::current()->referralDiscountPercent());
        $this->update(['referral_reward_granted' => true]);
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
                $setting = Setting::current();

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
                $setting = Setting::current();

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
                : $this->permissions()->pluck('key')->values(),
        );
    }
}
