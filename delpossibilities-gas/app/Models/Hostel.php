<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Hostel extends Model
{
    // Cached public (active-only) list used by /hostels and /bootstrap.
    // Cleared on any save/delete so an admin edit shows up immediately.
    public const PUBLIC_CACHE_KEY = 'hostels.public';

    protected $fillable = [
        'name',
        'is_active',
    ];

    protected static function booted(): void
    {
        $forget = fn () => Cache::forget(self::PUBLIC_CACHE_KEY);

        static::saved($forget);
        static::deleted($forget);
    }

    public static function publicList()
    {
        return Cache::remember(
            self::PUBLIC_CACHE_KEY,
            300,
            fn () => static::where('is_active', true)->orderBy('name')->get(['id', 'name'])
        );
    }

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
