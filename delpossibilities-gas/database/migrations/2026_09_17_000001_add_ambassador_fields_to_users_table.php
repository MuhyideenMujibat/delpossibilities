<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('referral_commission_balance', 10, 2)->default(0)->after('referral_discount_percent_available');
            $table->decimal('referral_free_kg_balance', 10, 2)->default(0)->after('referral_commission_balance');
            // Running progress toward the next ambassador milestone — NOT
            // calendar-bound. Accumulates continuously, one contribution per
            // referred PERSON (see referral_commission_granted below), and
            // resets (with overflow carried forward) the moment both targets
            // are met, same shape as loyalty_progress_kg. See
            // User::grantReferralCommissionOnce / ::checkReferralCycleCompletion.
            $table->decimal('referral_cycle_kg', 10, 2)->default(0)->after('referral_free_kg_balance');
            $table->unsignedInteger('referral_cycle_friends_count')->default(0)->after('referral_cycle_kg');
            $table->boolean('is_brand_ambassador')->default(false)->after('referral_cycle_friends_count');
            $table->timestamp('brand_ambassador_since')->nullable()->after('is_brand_ambassador');
            // Set on the REFERRED user (not the referrer) — true once they've
            // triggered their one-and-only contribution to their referrer's
            // cash commission + cycle, via whichever qualifying event (a
            // paid gas order or a subscription) they reach FIRST. Mirrors the
            // legacy referral_reward_granted flag's "once per referred
            // student" shape, kept as its own column since that older flag
            // must stay untouched for the grandfathered percent balances.
            $table->boolean('referral_commission_granted')->default(false)->after('brand_ambassador_since');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'referral_commission_balance',
                'referral_free_kg_balance',
                'referral_cycle_kg',
                'referral_cycle_friends_count',
                'is_brand_ambassador',
                'brand_ambassador_since',
                'referral_commission_granted',
            ]);
        });
    }
};
