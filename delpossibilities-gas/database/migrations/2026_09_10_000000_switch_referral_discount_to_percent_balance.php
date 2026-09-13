<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Referral discount switches from a whole-coupon COUNT to a fractional
// PERCENT balance. The old model spent whole coupons per order — so 2
// coupons at 70% each added up to 140%, but a single order can only use
// 100% of it, and the other 40% was being discarded instead of kept for
// next time (both coupons were marked "used" regardless). Now each
// qualifying referral just adds its percent straight onto a running
// balance (see User::grantReferralReward), an order spends
// min(balance, 100)% of it (see OrderController::store), and whatever's
// left over — e.g. that same 40% — stays on the balance exactly, ready to
// combine with a future referral's percent or be spent on a later order.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('referral_discount_percent_available', 6, 2)->default(0)->after('referral_discount_available');
        });

        // Best-effort backfill for any existing whole-coupon balance: value
        // it at today's admin-configured referral percent — the exact
        // historical percent each coupon was granted at isn't tracked, so
        // this is an approximation, acceptable since this is still
        // pre-launch test data rather than a real outstanding balance.
        $percent = (float) (DB::table('settings')->where('id', 1)->value('referral_discount_percent') ?? 10);
        DB::table('users')->where('referral_discount_available', '>', 0)
            ->update(['referral_discount_percent_available' => DB::raw('referral_discount_available * '.$percent)]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('referral_discount_available');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('referral_discount_available')->default(0)->after('referral_discount_percent_available');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('referral_discount_percent_available');
        });
    }
};
