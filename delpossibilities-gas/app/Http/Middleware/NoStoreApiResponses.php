<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// JSON API responses (orders, payments, receipts, admin actions, profile) must
// never be stored by a browser, proxy or CDN — a weak-network user could
// otherwise be shown a stale order status or someone else's data from a shared
// cache. Laravel's default is "no-cache, private", which still lets the
// browser keep a copy; this makes it explicit. Image/file caching is handled
// separately in public/.htaccess and does not pass through here.
class NoStoreApiResponses
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
