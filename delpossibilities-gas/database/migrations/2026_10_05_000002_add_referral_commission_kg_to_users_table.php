<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Snapshotted on the REFERRED user (not the referrer) the moment
            // referral_commission_granted flips true — the kg that counted
            // toward their referrer's cycle at that exact moment (0 for a
            // subscription-first grant). Lets the admin referral leaderboard
            // sum "lifetime kg earned" per referrer without re-deriving it
            // from order history, which would double-count orders that
            // don't actually contribute (see User::grantReferralCommissionOnce).
            $table->decimal('referral_commission_kg', 10, 2)->nullable()->after('referral_commission_granted');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('referral_commission_kg');
        });
    }
};
