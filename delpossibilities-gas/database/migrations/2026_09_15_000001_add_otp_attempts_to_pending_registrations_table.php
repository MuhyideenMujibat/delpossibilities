<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Locks out OTP guessing (AuthController::verifyRegistration) after a
    // handful of wrong codes, instead of relying on the 10-minute expiry
    // alone as the only limit on how many guesses an attacker gets.
    public function up(): void
    {
        Schema::table('pending_registrations', function (Blueprint $table) {
            $table->unsignedTinyInteger('otp_attempts')->default(0)->after('otp_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('pending_registrations', function (Blueprint $table) {
            $table->dropColumn('otp_attempts');
        });
    }
};
