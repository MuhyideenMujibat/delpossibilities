<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class EazyMarketDeliveryTier extends Model
{
    // Key of the cached public (active-only) list — see routes/api.php. Cleared
    // on any save/delete so an admin edit shows up immediately.
    public const PUBLIC_CACHE_KEY = 'eazy_market_tiers.public';

    protected static function booted(): void
    {
        $forget = fn () => Cache::forget(self::PUBLIC_CACHE_KEY);

        static::saved($forget);
        static::deleted($forget);
    }

    protected $fillable = [
        'min_amount',
        'max_amount',
        'fee',
        'is_active',
        'sort_order',
    ];

    public static function publicList()
    {
        return Cache::remember(
            self::PUBLIC_CACHE_KEY,
            300,
            fn () => static::where('is_active', true)->orderBy('sort_order')->orderBy('min_amount')->get(['id', 'min_amount', 'max_amount', 'fee'])
        );
    }

    protected function casts(): array
    {
        return [
            'min_amount' => 'decimal:2',
            'max_amount' => 'decimal:2',
            'fee' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
