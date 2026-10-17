<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | This file previously didn't exist at all, which meant Laravel's
    | HandleCors middleware matched zero paths (see
    | Illuminate\Http\Middleware\HandleCors::getPathsByHost, which reads
    | config('cors.paths', [])) and every cross-origin request from the
    | frontend was silently blocked rather than allowed. The frontend calls
    | a separate origin (see frontend src/api.js — VITE_API_BASE), so this
    | is a real cross-origin setup that needs an explicit, committed config
    | rather than something left to guesswork on the server.
    |
    | CORS_ALLOWED_ORIGINS is a comma-separated list — set it in the
    | server's real .env to the exact production frontend URL(s), e.g.
    | "https://app.delpossibilities.com". The fallback covers local Vite
    | dev only and must never be relied on in production.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(array_map(
        'trim',
        explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173'))
    )),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Auth here is a Sanctum bearer token sent in an Authorization header
    // (see AuthController::login / register — createToken()->plainTextToken),
    // not a cookie-based SPA session, so there's no cookie for the browser
    // to carry cross-origin and nothing here needs credentials support.
    'supports_credentials' => false,

];
