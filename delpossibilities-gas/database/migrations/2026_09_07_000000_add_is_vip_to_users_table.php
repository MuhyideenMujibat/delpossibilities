<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// A VIP account (set by an admin, only at creation — see AdminUserController)
// never pays a delivery fee, on any order type: gas refills, Eazy Market
// carts, or accessories. See OrderController::store and
// ProductOrderController::store, which both zero the fee out for one.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_vip')->default(false)->after('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_vip');
        });
    }
};
