<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Laravel's enum() column type maps straight to a native MySQL
        // ENUM, which Schema::table()->enum(...)->change() can't safely
        // widen — a raw ALTER is the standard way to add a value to one.
        DB::statement("ALTER TABLE subscribers MODIFY status ENUM('pending', 'active', 'expired', 'cancelled') NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("UPDATE subscribers SET status = 'expired' WHERE status = 'cancelled'");
        DB::statement("ALTER TABLE subscribers MODIFY status ENUM('pending', 'active', 'expired') NOT NULL DEFAULT 'pending'");
    }
};
