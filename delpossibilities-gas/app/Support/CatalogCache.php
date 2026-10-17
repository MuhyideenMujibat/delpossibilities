<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

// Short-lived cache for the public product catalog and subscription plans.
// Entries are keyed by a version number; any admin save/delete of a product,
// variant or plan calls bump(), which makes every old entry unreachable at
// once — so edits show up immediately without tracking each key.
class CatalogCache
{
    private const VERSION_KEY = 'catalog.version';

    public static function remember(string $name, callable $callback)
    {
        $version = (int) Cache::get(self::VERSION_KEY, 1);

        return Cache::remember("catalog.{$version}.{$name}", 300, $callback);
    }

    public static function bump(): void
    {
        Cache::forever(self::VERSION_KEY, (int) Cache::get(self::VERSION_KEY, 1) + 1);
    }
}
