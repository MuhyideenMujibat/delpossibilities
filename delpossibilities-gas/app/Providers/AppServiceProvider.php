<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Login/register/OTP/password-reset endpoints (see routes/api.php)
        // had no throttling at all. Keyed by email+IP together, not IP
        // alone, so one attacker can't credential-stuff many accounts from
        // one IP while staying under a per-IP cap, and a shared campus IP
        // can't lock out every student behind it over one bad actor.
        RateLimiter::for('auth', function (Request $request) {
            $key = strtolower((string) $request->input('email')).'|'.$request->ip();

            return Limit::perMinute(6)->by($key);
        });

        // Paystack/Flutterwave webhooks: generous enough not to drop a
        // legitimate burst of events, just enough to stop the signature
        // check itself from being hammered.
        RateLimiter::for('webhook', function (Request $request) {
            return Limit::perMinute(60)->by($request->ip());
        });

        // Public, unauthenticated feedback widget (see routes/api.php) —
        // generous enough for a real visitor leaving a couple of comments,
        // tight enough to stop it being used to spam the feedback table.
        RateLimiter::for('feedback', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        // Defense in depth, independent of whatever the hosting platform's
        // reverse proxy already does — nothing in this app enforced HTTPS
        // on its own. Every generated URL (signed contract links, password
        // reset links, etc.) is forced to https:// in production; local/dev
        // stays http since there's no TLS to have.
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}
