<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->decimal('referral_commission_amount', 10, 2)->nullable()->after('referral_discount_percent');
            // Admin-editable thresholds for the monthly ambassador milestone
            // (see User::evaluateMonthlyReferralMilestone) — null falls back
            // to User::REFERRAL_MILESTONE_REFERRED_COUNT / ::REFERRAL_MILESTONE_KG.
            $table->unsignedInteger('referral_milestone_referred_count')->nullable()->after('referral_commission_amount');
            $table->decimal('referral_milestone_kg', 10, 2)->nullable()->after('referral_milestone_referred_count');
        });
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropColumn([
                'referral_commission_amount',
                'referral_milestone_referred_count',
                'referral_milestone_kg',
            ]);
        });
    }
};
