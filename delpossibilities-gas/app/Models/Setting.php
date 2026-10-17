<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $fillable = [
        'price_per_kg',
        'delivery_fee',
        'off_campus_delivery_fee',
        'offer_active',
        'offer_title',
        'offer_message',
        'offer_price_per_kg',
        'broadcast_active',
        'broadcast_message',
        'broadcast_slot1_pickup',
        'broadcast_slot1_delivery',
        'broadcast_slot2_pickup',
        'broadcast_slot2_delivery',
        'loyalty_enabled',
        'loyalty_threshold_kg',
        'loyalty_discount_percent',
        'session_starts_at',
        'session_ends_at',
        'semester_starts_at',
        'semester_ends_at',
        'referral_discount_percent',
        'referral_commission_amount',
        'referral_milestone_referred_count',
        'referral_milestone_kg',
        'investment_bank_name',
        'investment_account_name',
        'investment_account_number',
        'investment_monthly_rate_percent',
        'investment_minimum_amount',
        'investment_tenures_months',
        'investment_whatsapp_number',
        'paystack_enabled',
        'flutterwave_enabled',
    ];

    protected function casts(): array
    {
        return [
            'price_per_kg' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'off_campus_delivery_fee' => 'decimal:2',
            'offer_active' => 'boolean',
            'offer_price_per_kg' => 'decimal:2',
            'broadcast_active' => 'boolean',
            'paystack_enabled' => 'boolean',
            'flutterwave_enabled' => 'boolean',
            'loyalty_enabled' => 'boolean',
            'loyalty_threshold_kg' => 'decimal:2',
            'loyalty_discount_percent' => 'decimal:2',
            'session_starts_at' => 'date',
            'session_ends_at' => 'date',
            'semester_starts_at' => 'date',
            'semester_ends_at' => 'date',
            'referral_discount_percent' => 'decimal:2',
            'referral_commission_amount' => 'decimal:2',
            'referral_milestone_referred_count' => 'integer',
            'referral_milestone_kg' => 'decimal:2',
            'investment_monthly_rate_percent' => 'decimal:2',
            'investment_minimum_amount' => 'decimal:2',
        ];
    }

    // Falls back to [6, 12] if ever null (e.g. a settings row created
    // without the migration's backfill) so the calculator always has
    // tenure options to offer instead of an empty list.
    protected function investmentTenuresMonths(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value ? array_map('intval', json_decode($value, true)) : [6, 12],
            set: fn ($value) => json_encode(array_map('intval', $value ?: [6, 12])),
        );
    }

    public const CACHE_TTL_SECONDS = 300;

    // Read-only snapshots served by the public /price and /payment-gateways
    // endpoints. Payment/order code deliberately keeps calling current()
    // below, which always reads the database — only these display payloads
    // are cached, and any save/delete of the settings row drops them.
    private const CACHE_KEYS = ['settings.public_price', 'settings.public_gateways'];

    protected static function booted(): void
    {
        $forget = function () {
            static::$serializationMemo = null;

            foreach (self::CACHE_KEYS as $key) {
                Cache::forget($key);
            }
        };

        static::saved($forget);
        static::deleted($forget);
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1]);
    }

    private static ?self $serializationMemo = null;

    // Display-only: the appended loyalty_* attributes on User read the
    // settings row once per serialized user, so a list of N users ran N
    // identical queries. This reads it once per request (and is dropped on
    // any save). Pricing and payment code must keep using current().
    public static function forSerialization(): self
    {
        return static::$serializationMemo ??= static::current();
    }

    public static function cachedPricePayload(): array
    {
        return Cache::remember(self::CACHE_KEYS[0], self::CACHE_TTL_SECONDS, fn () => static::current()->toArray());
    }

    public static function cachedGatewayPayload(): array
    {
        return Cache::remember(self::CACHE_KEYS[1], self::CACHE_TTL_SECONDS, function () {
            $setting = static::current();

            return [
                'paystack_enabled' => (bool) $setting->paystack_enabled,
                'flutterwave_enabled' => (bool) $setting->flutterwave_enabled,
            ];
        });
    }

    // The loyalty program only does anything when it's switched on AND both
    // knobs it needs are set. Every loyalty code path guards on this so a
    // half-configured program (enabled but no threshold, say) is simply inert
    // rather than dividing by zero or unlocking instantly.
    public function loyaltyActive(): bool
    {
        return (bool) $this->loyalty_enabled
            && (float) $this->loyalty_threshold_kg > 0
            && (float) $this->loyalty_discount_percent > 0;
    }

    // Falls back to the referral coupon's built-in default when the admin
    // hasn't set one, so referrals keep working out of the box.
    public function referralDiscountPercent(): float
    {
        return (float) ($this->referral_discount_percent ?? User::REFERRAL_DISCOUNT_PERCENT);
    }

    // The flat cash amount credited to a referrer's referral_commission_balance
    // per qualifying gas order (see User::grantReferralCashCommission). Unlike
    // referralDiscountPercent() above, there's no built-in default — a
    // referrer earns nothing until the admin actually sets this.
    public function referralCommissionAmount(): float
    {
        return (float) ($this->referral_commission_amount ?? 0);
    }

    // How many distinct referred people must each place a paid gas order in
    // the same calendar month to unlock that month's free kg reward (see
    // User::evaluateMonthlyReferralMilestone) — admin-editable, falls back to
    // User::REFERRAL_MILESTONE_REFERRED_COUNT when unset.
    public function referralMilestoneReferredCount(): int
    {
        return (int) ($this->referral_milestone_referred_count ?? User::REFERRAL_MILESTONE_REFERRED_COUNT);
    }

    // The combined kg those referred people's orders must reach that same
    // month, alongside referralMilestoneReferredCount() above — both
    // conditions are required together. Admin-editable, falls back to
    // User::REFERRAL_MILESTONE_KG when unset.
    public function referralMilestoneKg(): float
    {
        return (float) ($this->referral_milestone_kg ?? User::REFERRAL_MILESTONE_KG);
    }
}
