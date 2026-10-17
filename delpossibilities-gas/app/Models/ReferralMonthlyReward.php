<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// A plain history log — one row every time a referrer's running referral
// cycle (see User::evaluateReferralCycleProgress) completes. Not calendar-
// bound despite the name: a fast-qualifying referrer can log more than one
// of these in the same real month, since the cycle renews (with any overflow
// kg/friends carried forward) as soon as it completes, not on a month
// boundary.
class ReferralMonthlyReward extends Model
{
    protected $fillable = [
        'user_id',
        'distinct_referred_count',
        'total_kg',
        'free_kg_amount',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'total_kg' => 'decimal:2',
            'free_kg_amount' => 'decimal:2',
            'completed_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
