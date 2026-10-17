<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Standalone shop-order checkout used to be Paystack-only. These mirror the
    // columns orders already have (see 2026_09_13_000002) so a shop order can
    // be paid through whichever gateway the admin has switched on.
    public function up(): void
    {
        Schema::table('product_orders', function (Blueprint $table) {
            $table->enum('payment_gateway', ['paystack', 'flutterwave'])->nullable()->after('paystack_reference');
            $table->string('flutterwave_tx_ref')->unique()->nullable()->after('payment_gateway');
        });
    }

    public function down(): void
    {
        Schema::table('product_orders', function (Blueprint $table) {
            $table->dropUnique(['flutterwave_tx_ref']);
            $table->dropColumn(['payment_gateway', 'flutterwave_tx_ref']);
        });
    }
};
