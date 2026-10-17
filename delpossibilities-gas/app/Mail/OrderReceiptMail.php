<?php

namespace App\Mail;

use App\Models\Order;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

// Queued (see Order::sendReceiptEmail) — this used to send synchronously
// inline in the payment-confirmation request, and a slow/hanging SMTP
// connection there had already fatal-errored a request past PHP's
// execution-time limit in production (see the comments this replaced in
// OrderController/PaystackWebhookController). Queueing means a slow send
// delays the email, not the response the student is waiting on.
class OrderReceiptMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order)
    {
    }

    public function build(): self
    {
        // The PDF (rendered server-side by dompdf, which has no browser
        // session and would otherwise need remote fetching enabled) gets
        // images inlined as base64 data URIs. The HTML email body instead
        // embeds the logo as a CID inline attachment (via $message->embed()
        // in the Blade view), since Gmail and most webmail clients strip
        // data: URI images from received HTML mail, and a hosted URL would
        // require APP_URL to be a publicly reachable address.
        $logoPath = public_path('images/logo.jpeg');

        $data = [
            'order' => $this->order,
            'logoDataUri' => $this->fileToDataUri($logoPath),
            'logoPath' => is_file($logoPath) ? $logoPath : null,
            'cylinderDataUri' => $this->order->cylinder_image
                ? $this->fileToDataUri(Storage::disk('public')->path($this->order->cylinder_image))
                : null,
            'cylinderUrl' => $this->order->cylinder_image_url,
        ];

        $pdf = Pdf::loadView('receipts.pdf', $data);

        return $this
            ->subject("Your D'EL-Possibilities Receipt — Order #{$this->order->id}")
            ->view('emails.receipt')
            ->with($data)
            ->attachData($pdf->output(), "delpossibilities-receipt-order-{$this->order->id}.pdf", [
                'mime' => 'application/pdf',
            ]);
    }

    private function fileToDataUri(?string $path): ?string
    {
        if (! $path || ! is_file($path)) {
            return null;
        }

        $mime = mime_content_type($path) ?: 'image/png';

        return 'data:'.$mime.';base64,'.base64_encode(file_get_contents($path));
    }
}
