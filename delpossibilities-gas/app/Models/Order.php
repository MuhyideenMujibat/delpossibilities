<?php

namespace App\Models;

use App\Mail\OrderReceiptMail;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class Order extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'cylinder_image',
        'kg',
        'price_per_kg',
        'loyalty_discount_applied',
        'loyalty_discount_amount',
        'delivery_fee',
        'referral_credit_applied',
        'referral_discount_amount',
        'referral_percent_used',
        'referral_free_kg_applied',
        'referral_free_kg_discount_amount',
        'vvip_discount_amount',
        'product_order_id',
        'attached_product_order_id',
        'total_amount',
        'hostel_address',
        'location_type',
        'delivery_zone_id',
        'status',
        'paystack_reference',
        'payment_gateway',
        'flutterwave_tx_ref',
        'payment_authorization_url',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
            'loyalty_discount_applied' => 'boolean',
            'loyalty_discount_amount' => 'decimal:2',
            'referral_credit_applied' => 'decimal:2',
            'referral_discount_amount' => 'decimal:2',
            'referral_percent_used' => 'decimal:2',
            'referral_free_kg_applied' => 'decimal:2',
            'referral_free_kg_discount_amount' => 'decimal:2',
            'vvip_discount_amount' => 'decimal:2',
        ];
    }

    protected $appends = [
        'cylinder_image_url',
    ];

    // An order belongs to one student (user)
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    // The Eazy Market / Gas Services cart bundled UNPAID into this checkout,
    // if any — its total folds into this order's own charge.
    public function productOrder()
    {
        return $this->belongsTo(ProductOrder::class);
    }

    // A separate cart that was ALREADY PAID FOR standalone and is just tagged
    // to this delivery for fulfilment — adds nothing to this order's charge.
    // Independent of productOrder(): an order can carry both at once.
    public function attachedProductOrder()
    {
        return $this->belongsTo(ProductOrder::class, 'attached_product_order_id');
    }

    public function deliveryZone()
    {
        return $this->belongsTo(DeliveryZone::class);
    }

    // Mirrors STATUS_LABELS in the frontend's api.js — kept in sync manually
    // since this is the one place status text needs to read naturally in a
    // sentence rather than as a standalone label.
    private const STATUS_MESSAGES = [
        'approved' => ['title' => 'Payment confirmed', 'body' => 'has been approved and is awaiting pickup for refilling.'],
        'picked_up' => ['title' => 'Cylinder picked up', 'body' => 'has been picked up and is being refilled.'],
        'delivered' => ['title' => 'Order delivered', 'body' => 'has been delivered. Enjoy!'],
    ];

    public function notifyStatusChange(): void
    {
        $message = self::STATUS_MESSAGES[$this->status] ?? null;

        if (! $message) {
            return;
        }

        $this->notifications()->create([
            'user_id' => $this->user_id,
            'title' => $message['title'],
            'body' => "Your order #{$this->total_amount} ({$this->kg} kg) {$message['body']}",
        ]);
    }

    // Best-effort: a failed send (bad SMTP creds, provider hiccup, etc.)
    // shouldn't roll back or fail the payment confirmation that triggered it.
    public function sendReceiptEmail(): void
    {
        if (! $this->user?->email) {
            return;
        }

        try {
            // Queued, not sent inline — see OrderReceiptMail. This only
            // guards against queueing itself failing (e.g. the jobs table
            // being unreachable); an actual delivery failure becomes a
            // failed queue job instead of blocking the request.
            Mail::to($this->user->email)->queue(new OrderReceiptMail($this));
        } catch (\Throwable $e) {
            Log::error('Failed to queue order receipt email', [
                'order_id' => $this->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function cylinderImageUrl(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (! $this->cylinder_image) {
                    return null;
                }

                /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
                $disk = Storage::disk('public');

                return $disk->url($this->cylinder_image);
            },
        );
    }

    // Called once this order is confirmed paid — the only place a student's
    // loyalty progress moves (pending, unpaid orders never count).
    //
    //  - If a discount was applied to this order, the reward has been spent:
    //    the running total resets to 0 and the student starts building toward
    //    the next one.
    //  - Otherwise this order's full kg is added to the running total.
    //
    // The "how much is discounted / how much is left to unlock" maths lives
    // in OrderController::store and User::loyaltyKgToNextReward, both reading
    // this same running total.
    public function applyLoyaltyProgress(): void
    {
        $user = $this->user;

        if (! $user) {
            return;
        }

        $user->loyalty_progress_kg = $this->loyalty_discount_applied
            ? 0
            : round((float) $user->loyalty_progress_kg + (float) $this->kg, 2);

        $user->save();
    }

    // Called once this order is confirmed paid — same reasoning as
    // applyLoyaltyProgress above: a pending, unpaid order must never
    // actually spend the balance, only preview what it WOULD spend (see
    // OrderController::referralFreeKgDiscount, computed at store()/update()
    // time purely for pricing — this is the one place the balance and the
    // monthly spending cap actually move). If the order is abandoned
    // (edited away from, or deleted) before payment, nothing here ever ran,
    // so there's nothing to refund — unlike the legacy referral-percent
    // balance, which IS spent at creation time and so DOES need refunding
    // on edit (see OrderController::update).
    public function applyReferralFreeKg(): void
    {
        $used = (float) $this->referral_free_kg_applied;

        if ($used <= 0) {
            return;
        }

        $user = $this->user;

        if (! $user) {
            return;
        }

        $currentMonth = now()->format('Y-m');
        $monthUsed = $user->referral_free_kg_month === $currentMonth ? (float) $user->referral_free_kg_month_used : 0.0;

        $user->decrement('referral_free_kg_balance', $used);
        $user->update([
            'referral_free_kg_month' => $currentMonth,
            'referral_free_kg_month_used' => round($monthUsed + $used, 2),
        ]);
    }
}
