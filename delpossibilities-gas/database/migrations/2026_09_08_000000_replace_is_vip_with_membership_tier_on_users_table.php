<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Replaces the plain is_vip boolean with a three-way tier, now that there
// are two distinct perk levels (see OrderController::store and
// ProductOrderController::store):
//  - 'vip'  — free delivery fee only, on every order type (gas, Eazy
//             Market, accessories). The gas/goods cost itself is still paid.
//  - 'vvip' — free delivery fee on everything VIP gets, PLUS the gas cost
//             itself is free on a gas order. Shop goods are still paid for,
//             just delivered free.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('membership_tier', 10)->default('none')->after('role');
        });

        DB::table('users')->where('is_vip', true)->update(['membership_tier' => 'vip']);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_vip');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_vip')->default(false)->after('role');
        });

        DB::table('users')->where('membership_tier', 'vip')->orWhere('membership_tier', 'vvip')
            ->update(['is_vip' => true]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('membership_tier');
        });
    }
};
