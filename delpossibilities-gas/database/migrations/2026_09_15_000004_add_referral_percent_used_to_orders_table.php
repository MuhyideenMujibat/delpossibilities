<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Needed so OrderController::update can refund exactly the referral
    // percent an order spent before recomputing it for the edited kg —
    // referral_discount_amount alone (a naira figure) can't be reversed back
    // into a percent without re-deriving it from other stored fields, and
    // that back-derivation is one more place to get subtly wrong.
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('referral_percent_used', 6, 2)->default(0)->after('referral_discount_amount');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('referral_percent_used');
        });
    }
};
