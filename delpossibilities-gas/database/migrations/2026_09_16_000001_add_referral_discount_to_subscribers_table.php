<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;



return new class extends Migration
{
    // A referrer's discount balance could only ever be spent on a gas order
    // (see OrderController::store) — subscriptions always charged the
    // plan's full locked_price. Adds the same referral fields Order already
    // has (see 2026_09_15_000004_add_referral_percent_used_to_orders_table)
    // so SubscriberController::store can apply and later refund/recompute
    // a referral discount the same way. total_amount is the actual charge
    // (locked_price minus the discount) — pay()/webhooks move to charging
    // this instead of locked_price directly.
    public function up(): void
    {
        Schema::table('subscribers', function (Blueprint $table) {
            $table->decimal('referral_discount_amount', 10, 2)->default(0)->after('locked_price');
            $table->decimal('referral_percent_used', 6, 2)->default(0)->after('referral_discount_amount');
            $table->decimal('total_amount', 10, 2)->nullable()->after('referral_percent_used');
        });

        // Existing rows never had a discount — their charge was always the
        // full locked_price. Left nullable at the DB level (avoiding a
        // ->change(), which needs doctrine/dbal) — every code path that
        // creates or updates a subscriber always sets it explicitly.
        DB::table('subscribers')->update(['total_amount' => DB::raw('locked_price')]);
    }

    public function down(): void
    {
        Schema::table('subscribers', function (Blueprint $table) {
            $table->dropColumn(['referral_discount_amount', 'referral_percent_used', 'total_amount']);
        });
    }
};
