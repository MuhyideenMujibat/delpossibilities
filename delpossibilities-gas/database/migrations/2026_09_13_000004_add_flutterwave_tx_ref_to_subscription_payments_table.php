<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            // Parallel to paystack_reference — the `method` column (already
            // on this table, default 'paystack') records which gateway this
            // attempt used. payment_authorization_url is reused as-is for
            // the Flutterwave checkout link.
            $table->string('flutterwave_tx_ref')->unique()->nullable()->after('paystack_reference');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->dropColumn('flutterwave_tx_ref');
        });
    }
};
