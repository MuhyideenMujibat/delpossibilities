<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Despite the table name, this is a plain append-only completion log,
        // not a calendar-month record — one row every time a referrer's
        // running cycle (see users.referral_cycle_kg/referral_cycle_friends_count)
        // completes, which can happen more than once in the same real month
        // if they qualify fast (no uniqueness constraint needed).
        Schema::create('referral_monthly_rewards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('distinct_referred_count');
            $table->decimal('total_kg', 10, 2);
            $table->decimal('free_kg_amount', 5, 2)->default(3);
            $table->timestamp('completed_at');
            $table->timestamps();

            $table->index(['user_id', 'completed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_monthly_rewards');
    }
};
