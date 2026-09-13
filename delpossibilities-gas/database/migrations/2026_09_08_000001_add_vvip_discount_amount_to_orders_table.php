<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Its own line item, like loyalty_discount_amount and
// referral_discount_amount — how much of THIS order's gas cost was waived
// because the buyer is a VVIP account (see OrderController::store).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('vvip_discount_amount', 10, 2)->default(0)->after('referral_discount_amount');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('vvip_discount_amount');
        });
    }
};
