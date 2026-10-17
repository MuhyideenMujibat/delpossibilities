<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Composite indexes matching the real list/lookup queries (always
    // user-scoped, then sorted or filtered). MySQL already indexes every
    // foreign key column on its own and orders.status / *.status are covered
    // by 2026_09_15_000003, and orders.paystack_reference / flutterwave_tx_ref
    // are already unique — so none of those are repeated here. Each index is
    // skipped when the table/column is missing or the index already exists,
    // which makes this safe to re-run.
    private const INDEXES = [
        // OrderController::myOrders (user's orders, newest first) and the admin
        // list's latest() sort.
        ['orders', 'orders_user_id_created_at_index', ['user_id', 'created_at']],
        ['orders', 'orders_created_at_index', ['created_at']],
        // NotificationController::index (latest 30 + unread count).
        ['notifications', 'notifications_user_id_read_at_index', ['user_id', 'read_at']],
        ['notifications', 'notifications_user_id_created_at_index', ['user_id', 'created_at']],
        // User::subscribers()->where('status', ...) in mine()/store()/RefillController.
        ['subscribers', 'subscribers_user_id_status_index', ['user_id', 'status']],
        // Subscriber::refills()->where('status', 'pending').
        ['refills', 'refills_subscriber_id_status_index', ['subscriber_id', 'status']],
        // ProductOrderController::myOrders.
        ['product_orders', 'product_orders_user_id_created_at_index', ['user_id', 'created_at']],
        // User::referrals() counts and AdminReferralController::index.
        ['users', 'users_referred_by_commission_granted_index', ['referred_by_user_id', 'referral_commission_granted']],
        // Admin student/staff lists filter on role.
        ['users', 'users_role_index', ['role']],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as [$table, $name, $columns]) {
            if (! Schema::hasTable($table) || Schema::hasIndex($table, $name)) {
                continue;
            }

            foreach ($columns as $column) {
                if (! Schema::hasColumn($table, $column)) {
                    continue 2;
                }
            }

            Schema::table($table, fn (Blueprint $t) => $t->index($columns, $name));
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as [$table, $name]) {
            if (Schema::hasTable($table) && Schema::hasIndex($table, $name)) {
                Schema::table($table, fn (Blueprint $t) => $t->dropIndex($name));
            }
        }
    }
};
