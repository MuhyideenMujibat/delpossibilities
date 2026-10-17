<?php

use App\Http\Controllers\AdminDeliveryZoneController;
use App\Http\Controllers\AdminEazyMarketDeliveryTierController;
use App\Http\Controllers\AdminHostelController;
use App\Http\Controllers\AdminProductController;
use App\Http\Controllers\AdminProductOrderController;
use App\Http\Controllers\AdminReferralController;
use App\Http\Controllers\AdminSubscriberController;
use App\Http\Controllers\AdminStaffController;
use App\Http\Controllers\AdminStudentController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\FeedbackSubmissionController;
use App\Http\Controllers\FlutterwaveController;
use App\Http\Controllers\InvestmentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductOrderController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RefillController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\SubscriberController;
use App\Http\Controllers\SubscriptionPlanController;
use App\Http\Controllers\UserTypeController;
use App\Models\DeliveryZone;
use App\Models\EazyMarketDeliveryTier;
use App\Models\Hostel;
use App\Models\Setting;
use App\Models\SubscriptionPlan;
use App\Support\CatalogCache;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;



Route::get('/user', function (Request $request) {
    // ->append, not a global $appends entry — is_investor/successful_referrals_count
    // each run a query, and this is the one place a single user (not a bulk
    // list) is serialized, so the frontend can preview free gas delivery
    // (see User::isInvestor) and referral stats (see User::successfulReferralsCount).
    return $request->user()->append(['is_investor', 'successful_referrals_count', 'referral_monthly_progress', 'referral_free_kg_month_remaining']);
})->middleware('auth:sanctum');

Route::middleware('throttle:auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/register/verify', [AuthController::class, 'verifyRegistration']);
    Route::post('/register/resend-otp', [AuthController::class, 'resendRegistrationOtp']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword']);
    Route::post('/reset-password', [PasswordResetController::class, 'resetPassword']);
});

// Public, read-only price so the marketing/landing page can show a real
// number. Deliberately separate from the admin-only /settings/price group
// below, which also allows PATCH.
Route::get('/price', [SettingController::class, 'showPrice']);

// Public, read-only hostel list so Register (unauthenticated) can offer the
// same picker as the logged-in Profile/Create Order pages. Admin-only
// create/update/delete lives under the super_admin group below.
Route::get('/hostels', fn () => response()->json(Hostel::publicList()));

// Public plan list so the landing/plan-picker page can show real prices
// before login, same reasoning as /price above.
Route::get('/subscription-plans', [SubscriptionPlanController::class, 'index']);

// Public so the floating feedback widget works for logged-out landing
// visitors too — the controller attributes it to a user when a valid
// Sanctum token is present, without requiring one. Throttled since it's
// unauthenticated and otherwise had no limit at all.
Route::post('/feedback', [FeedbackSubmissionController::class, 'store'])->middleware('throttle:feedback');

// Public, read-only product catalog so the landing page shop sections can
// list gas_services and eazy_market items before login. Only active
// products/variants are returned. Admin CRUD lives under super_admin below.
Route::get('/products', [ProductController::class, 'index']);

// Public so checkout can offer the zone picker for off-campus gas orders
// before login-gated pages load. Admin CRUD lives under super_admin below.
Route::get('/delivery-zones', fn () => response()->json(DeliveryZone::publicList()));

// Public so the Pay Now flow (gas orders + subscriptions) knows whether to
// show a gateway picker before login-gated pages even load. Admin toggles
// live under manage_settings below (same /settings/price endpoint as every
// other setting).
Route::get('/payment-gateways', [SettingController::class, 'paymentGateways']);

// Public so Eazy Market checkout can compute/display the delivery fee tier
// before login. Admin CRUD lives under super_admin below.
Route::get('/eazy-market-delivery-tiers', fn () => response()->json(EazyMarketDeliveryTier::publicList()));

// Everything the public pages need on first paint, in ONE request instead of
// five (price/fees, gateways, hostels, delivery zones, Eazy Market tiers).
// Every part is cached and cleared when an admin edits it; the individual
// endpoints above stay as they are.
Route::get('/bootstrap', fn () => response()->json([
    'price' => Setting::cachedPricePayload(),
    'gateways' => Setting::cachedGatewayPayload(),
    'hostels' => Hostel::publicList(),
    'delivery_zones' => DeliveryZone::publicList(),
    'eazy_market_tiers' => EazyMarketDeliveryTier::publicList(),
    'subscription_plans' => CatalogCache::remember('plans', fn () => SubscriptionPlan::orderBy('package_type')->orderBy('price')->get()),
]));

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::post('/orders', [OrderController::class, 'store']);
    // POST, not PATCH — may carry a replacement cylinder image in the same
    // request, same reasoning as AdminProductController::update.
    // withTrashed() on every one of these five: an admin can soft-delete a
    // still-pending order (see OrderController::destroy), and the student
    // must still be able to reach and pay for THAT EXACT order — Eloquent's
    // soft-delete global scope would otherwise 404 the route-model binding.
    Route::post('/orders/{order}/edit', [OrderController::class, 'update'])->withTrashed();
    Route::get('/my-orders', [OrderController::class, 'myOrders']);
    Route::post('/orders/{order}/pay', [OrderController::class, 'pay'])->withTrashed();
    Route::post('/orders/{order}/verify-payment', [OrderController::class, 'verifyPayment'])->withTrashed();
    Route::post('/orders/{order}/pay-flutterwave', [FlutterwaveController::class, 'payOrder'])->withTrashed();
    Route::post('/orders/{order}/verify-flutterwave-payment', [FlutterwaveController::class, 'verifyOrderPayment'])->withTrashed();

    Route::post('/product-orders', [ProductOrderController::class, 'store']);
    Route::get('/my-product-order', [ProductOrderController::class, 'mine']);
    Route::get('/my-product-orders', [ProductOrderController::class, 'myOrders']);
    Route::post('/product-orders/{productOrder}/pay', [ProductOrderController::class, 'pay']);
    Route::post('/product-orders/{productOrder}/verify-payment', [ProductOrderController::class, 'verifyPayment']);
    Route::post('/product-orders/{productOrder}/pay-flutterwave', [FlutterwaveController::class, 'payProductOrder']);
    Route::post('/product-orders/{productOrder}/verify-flutterwave-payment', [FlutterwaveController::class, 'verifyProductOrderPayment']);

    Route::post('/subscribers', [SubscriberController::class, 'store']);
    Route::get('/my-subscription', [SubscriberController::class, 'mine']);
    Route::post('/subscribers/{subscriber}/pay', [SubscriberController::class, 'pay']);
    Route::post('/subscribers/{subscriber}/verify-payment', [SubscriberController::class, 'verifyPayment']);
    Route::post('/subscribers/{subscriber}/pay-flutterwave', [FlutterwaveController::class, 'paySubscriber']);
    Route::post('/subscribers/{subscriber}/verify-flutterwave-payment', [FlutterwaveController::class, 'verifySubscriberPayment']);
    Route::post('/subscribers/{subscriber}/transfer', [SubscriberController::class, 'transfer']);
    Route::post('/refills', [RefillController::class, 'store']);

    Route::post('/investments', [InvestmentController::class, 'store']);
    Route::get('/my-investments', [InvestmentController::class, 'mine']);
    Route::post('/investments/{investment}/sign', [InvestmentController::class, 'sign']);

    Route::patch('/profile', [ProfileController::class, 'update']);
    Route::patch('/profile/password', [ProfileController::class, 'updatePassword']);
    Route::post('/profile/cylinder-image', [ProfileController::class, 'uploadCylinderImage']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    Route::middleware('admin')->group(function () {
        // Shared by three different admin "lenses" on the same order data
        // (Dashboard, Payments, Reports) — any one of those permissions is
        // enough to read it. Advancing an order's status is the one
        // meaningfully different, mutating action, so it stays scoped to
        // manage_orders specifically.
        Route::middleware('permission:manage_orders,manage_payments,manage_reports')->group(function () {
            Route::get('/orders', [OrderController::class, 'index']);
        });
        Route::middleware('permission:manage_orders')->group(function () {
            Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus']);
            // Deliberately NO withTrashed() here — an already-deleted order
            // must stay unreachable from every admin action, this one included.
            Route::delete('/orders/{order}', [OrderController::class, 'destroy']);

            Route::get('/admin/product-orders', [AdminProductOrderController::class, 'index']);
            Route::patch('/admin/product-orders/{productOrder}', [AdminProductOrderController::class, 'update']);
        });

        Route::middleware('permission:manage_settings')->group(function () {
            Route::get('/settings/price', [SettingController::class, 'showPrice']);
            Route::patch('/settings/price', [SettingController::class, 'updatePrice']);
            Route::post('/settings/broadcast-offer', [SettingController::class, 'broadcastOffer']);
        });

        Route::middleware('permission:manage_students')->group(function () {
            Route::get('/admin/students', [AdminStudentController::class, 'index']);
            Route::get('/admin/students/{user}', [AdminStudentController::class, 'show']);
            Route::delete('/admin/students/{user}', [AdminStudentController::class, 'destroy']);

            Route::get('/admin/referrals', [AdminReferralController::class, 'index']);
            Route::patch('/admin/referrals/{user}/ambassador', [AdminReferralController::class, 'toggleAmbassador']);
        });

        // Creating a user is allowed for anyone with manage_students (plain
        // student accounts), but creating an *employee* account with
        // permissions is gated to super_admin inside the controller itself
        // since it's the same endpoint handling both cases.
        Route::post('/admin/users', [AdminUserController::class, 'store']);

        Route::middleware('permission:manage_subscriptions')->group(function () {
            Route::get('/admin/subscribers', [SubscriberController::class, 'index']);
            Route::post('/admin/subscribers', [AdminSubscriberController::class, 'store']);
            Route::patch('/admin/subscribers/{subscriber}/cancel', [SubscriberController::class, 'cancel']);
            Route::get('/admin/subscription-reports', [SubscriberController::class, 'reports']);
            Route::get('/admin/refills', [RefillController::class, 'index']);
            Route::patch('/admin/refills/{refill}', [RefillController::class, 'update']);
            Route::patch('/admin/subscription-plans/{subscriptionPlan}', [SubscriptionPlanController::class, 'update']);
        });

        Route::middleware('super_admin')->group(function () {
            Route::get('/admin/feedback', [FeedbackSubmissionController::class, 'index']);

            Route::get('/admin/staff', [AdminStaffController::class, 'index']);
            Route::patch('/admin/staff/{user}', [AdminStaffController::class, 'update']);
            Route::delete('/admin/staff/{user}', [AdminStaffController::class, 'destroy']);

            Route::get('/admin/permissions', [PermissionController::class, 'index']);

            Route::get('/admin/user-types', [UserTypeController::class, 'index']);
            Route::post('/admin/user-types', [UserTypeController::class, 'store']);
            Route::patch('/admin/user-types/{userType}', [UserTypeController::class, 'update']);
            Route::delete('/admin/user-types/{userType}', [UserTypeController::class, 'destroy']);

            Route::get('/admin/hostels', [AdminHostelController::class, 'index']);
            Route::post('/admin/hostels', [AdminHostelController::class, 'store']);
            Route::patch('/admin/hostels/{hostel}', [AdminHostelController::class, 'update']);
            Route::delete('/admin/hostels/{hostel}', [AdminHostelController::class, 'destroy']);

            Route::get('/admin/products', [AdminProductController::class, 'index']);
            Route::post('/admin/products', [AdminProductController::class, 'store']);
            // POST not PATCH — this endpoint may carry an image file, see
            // AdminProductController::update for why.
            Route::post('/admin/products/{product}', [AdminProductController::class, 'update']);
            Route::delete('/admin/products/{product}', [AdminProductController::class, 'destroy']);

            Route::post('/admin/products/{product}/variants', [AdminProductController::class, 'storeVariant']);
            Route::patch('/admin/product-variants/{productVariant}', [AdminProductController::class, 'updateVariant']);
            Route::delete('/admin/product-variants/{productVariant}', [AdminProductController::class, 'destroyVariant']);

            Route::get('/admin/delivery-zones', [AdminDeliveryZoneController::class, 'index']);
            Route::post('/admin/delivery-zones', [AdminDeliveryZoneController::class, 'store']);
            Route::patch('/admin/delivery-zones/{deliveryZone}', [AdminDeliveryZoneController::class, 'update']);
            Route::delete('/admin/delivery-zones/{deliveryZone}', [AdminDeliveryZoneController::class, 'destroy']);

            Route::get('/admin/eazy-market-delivery-tiers', [AdminEazyMarketDeliveryTierController::class, 'index']);
            Route::post('/admin/eazy-market-delivery-tiers', [AdminEazyMarketDeliveryTierController::class, 'store']);
            Route::patch('/admin/eazy-market-delivery-tiers/{eazyMarketDeliveryTier}', [AdminEazyMarketDeliveryTierController::class, 'update']);
            Route::delete('/admin/eazy-market-delivery-tiers/{eazyMarketDeliveryTier}', [AdminEazyMarketDeliveryTierController::class, 'destroy']);

            Route::get('/admin/investments', [InvestmentController::class, 'index']);
            Route::patch('/admin/investments/{investment}/confirm-payment', [InvestmentController::class, 'confirmPayment']);
            Route::patch('/admin/investments/{investment}/cancel', [InvestmentController::class, 'cancel']);
        });
    });
});
Route::middleware('throttle:webhook')->group(function () {
    Route::post('/paystack/webhook', [App\Http\Controllers\PaystackWebhookController::class, 'handle']);
    Route::post('/flutterwave/webhook', [App\Http\Controllers\FlutterwaveWebhookController::class, 'handle']);
});

// Signed, not auth:sanctum — the link comes from Investment::contractUrl(),
// generated only inside a response already scoped to the right viewer (see
// InvestmentController::mine / ::index), and a plain <a href> can't carry a
// bearer token anyway. The signature (tied to the URL + expiry, see
// Investment::contractUrl) is what stands in for auth here.
Route::get('/investments/{investment}/contract', [App\Http\Controllers\InvestmentController::class, 'downloadContract'])
    ->name('investments.contract.download')
    ->middleware('signed');
