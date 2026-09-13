<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Nullable until payment is initiated — an order can sit
            // 'pending' with no gateway chosen yet.
            $table->enum('payment_gateway', ['paystack', 'flutterwave'])->nullable()->after('paystack_reference');
            // Flutterwave's own reference, parallel to paystack_reference
            // above (see OrderController::pay). payment_authorization_url is
            // reused as-is for the Flutterwave checkout link.
            $table->string('flutterwave_tx_ref')->unique()->nullable()->after('payment_gateway');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['payment_gateway', 'flutterwave_tx_ref']);
        });
    }
};
