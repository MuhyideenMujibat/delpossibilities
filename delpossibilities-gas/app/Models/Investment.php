<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\URL;

class Investment extends Model
{
    protected $fillable = [
        'user_id',
        'capital_amount',
        'tenure_months',
        'rate_percent',
        'monthly_return',
        'total_payout',
        'investor_name',
        'investor_email',
        'investor_phone',
        'status',
        'payment_confirmed_at',
        'contract_path',
        'signature_name',
        'signed_at',
    ];

    protected function casts(): array
    {
        return [
            'capital_amount' => 'decimal:2',
            'rate_percent' => 'decimal:2',
            'monthly_return' => 'decimal:2',
            'total_payout' => 'decimal:2',
            'payment_confirmed_at' => 'datetime',
            'signed_at' => 'datetime',
        ];
    }

    protected $appends = ['contract_url'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Computes and returns the three terms derived from capital/tenure at
    // the given rate — shared by store() (to snapshot at submission) and
    // the frontend calculator (which mirrors this exact formula client-side
    // against the live rate from GET /price, per Setting::investmentDefaults()).
    public static function computeTerms(float $capital, int $tenureMonths, float $ratePercent): array
    {
        $monthlyReturn = round($capital * ($ratePercent / 100), 2);

        return [
            'monthly_return' => $monthlyReturn,
            'total_payout' => round($capital + $monthlyReturn * $tenureMonths, 2),
        ];
    }

    // The contract PDF lives on the private disk now (see
    // InvestmentController::generateContractPdf) — it used to be a plain
    // public-storage URL with the contract's id as its only "protection",
    // which meant anyone who guessed contracts/investment-{id}.pdf could
    // read another investor's name, phone, capital amount and signature.
    // A signed URL, minted fresh every time this attribute is serialized
    // (i.e. only inside a response already scoped to the right viewer — see
    // InvestmentController::mine/index), stands in for auth on what's
    // otherwise a plain <a href> download link.
    protected function contractUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->contract_path
                ? URL::temporarySignedRoute('investments.contract.download', now()->addMinutes(30), ['investment' => $this->id])
                : null,
        );
    }
}
