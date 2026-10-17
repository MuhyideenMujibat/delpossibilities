<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

// Queued (see SettingController::broadcastOffer) — one of these is
// dispatched per student, so the admin's request doesn't block on however
// many hundred synchronous SMTP round-trips a full broadcast is. Plain text
// only, matching the Mail::raw() this replaced.
class BroadcastOfferMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public string $subjectLine, public string $body)
    {
    }

    public function build(): self
    {
        return $this->subject($this->subjectLine)->text('emails.broadcast-plain');
    }
}
