<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Lets an admin "delete" an order that's still awaiting payment
            // without actually destroying it — the student can still see
            // and pay for it (see OrderController's withTrashed() usage on
            // the student-facing routes), and paying for it restores it so
            // it reappears on the admin side as a normal approved order.
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
