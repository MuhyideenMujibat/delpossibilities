<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class DeliveryZone extends Model
{
    // Key of the cached public (active-only) list — see routes/api.php. Cleared
    // on any save/delete so an admin edit shows up immediately.
    public const PUBLIC_CACHE_KEY = 'delivery_zones.public';

    protected static function booted(): void
    {
        $forget = fn () => Cache::forget(self::PUBLIC_CACHE_KEY);

        static::saved($forget);
        static::deleted($forget);
    }

    protected $fillable = [
        'name',
        'fee',
        'is_active',
        'sort_order',
    ];

    public static function publicList()
    {
        return Cache::remember(
            self::PUBLIC_CACHE_KEY,
            300,
            fn () => static::where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(['id', 'name', 'fee'])
        );
    }

    protected function casts(): array
    {
        return [
            'fee' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
