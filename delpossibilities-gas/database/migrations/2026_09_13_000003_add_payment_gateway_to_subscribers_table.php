<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscribers', function (Blueprint $table) {
            // Denormalized copy of the gateway used on the payment that
            // (last) activated this subscriber — the actual payment
            // attempt/reference lives on subscription_payments, but this
            // lets the frontend/admin see which gateway was used without a
            // join. Nullable until payment is initiated.
            $table->enum('payment_gateway', ['paystack', 'flutterwave'])->nullable()->after('locked_price');
        });
    }

    public function down(): void
    {
        Schema::table('subscribers', function (Blueprint $table) {
            $table->dropColumn('payment_gateway');
        });
    }
};
