<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // orders.status/refills.status/subscribers.status/product_orders.status
    // are all filtered on directly by admin list endpoints (RefillController
    // ::index, SubscriberController::index, InvestmentController::index and
    // friends) but were never indexed — fine while these tables are small,
    // a full scan once they aren't.
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->index('status');
        });

        Schema::table('refills', function (Blueprint $table) {
            $table->index('status');
        });

        Schema::table('subscribers', function (Blueprint $table) {
            $table->index('status');
        });

        Schema::table('product_orders', function (Blueprint $table) {
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['status']);
        });

        Schema::table('refills', function (Blueprint $table) {
            $table->dropIndex(['status']);
        });

        Schema::table('subscribers', function (Blueprint $table) {
            $table->dropIndex(['status']);
        });

        Schema::table('product_orders', function (Blueprint $table) {
            $table->dropIndex(['status']);
        });
    }
};
