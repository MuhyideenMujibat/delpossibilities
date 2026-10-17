<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Tracks SPENDING of referral_free_kg_balance against a 3kg-per-
            // calendar-month cap — "Y-m" (e.g. "2026-10") so a stale value
            // from a prior month is simply ignored rather than needing a
            // separate reset job (see OrderController::referralFreeKgDiscount).
            // Earning (referral_free_kg_balance itself) is NOT capped by this.
            $table->string('referral_free_kg_month', 7)->nullable()->after('referral_free_kg_balance');
            $table->decimal('referral_free_kg_month_used', 10, 2)->default(0)->after('referral_free_kg_month');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['referral_free_kg_month', 'referral_free_kg_month_used']);
        });
    }
};
