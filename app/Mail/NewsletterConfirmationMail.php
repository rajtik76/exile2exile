<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\Attributes\Queue;
use Illuminate\Queue\SerializesModels;

/**
 * Double opt-in confirmation. Sent on signup; the signed link stamps
 * confirmed_at, and nothing else is ever sent to an unconfirmed address.
 */
#[Queue(\App\Enums\Queue::Mail)]
class NewsletterConfirmationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $confirmUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Confirm your '.config('app.name').' newsletter subscription',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.newsletter-confirmation',
        );
    }
}
