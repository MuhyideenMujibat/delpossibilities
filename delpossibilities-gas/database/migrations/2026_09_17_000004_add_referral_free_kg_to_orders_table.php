<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('referral_free_kg_applied', 10, 2)->default(0)->after('referral_percent_used');
            $table->decimal('referral_free_kg_discount_amount', 10, 2)->default(0)->after('referral_free_kg_applied');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['referral_free_kg_applied', 'referral_free_kg_discount_amount']);
        });
    }
};
