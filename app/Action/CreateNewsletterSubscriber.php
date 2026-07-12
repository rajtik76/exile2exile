<?php

declare(strict_types=1);

namespace App\Action;

use App\Mail\NewsletterConfirmationMail;
use App\Models\NewsletterSubscriber;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

/**
 * Signs an email up and sends the double opt-in confirmation. The subscriber
 * stays unconfirmed (and receives no issues) until the signed link is clicked.
 */
class CreateNewsletterSubscriber
{
    public function __invoke(string $email): NewsletterSubscriber
    {
        $subscriber = NewsletterSubscriber::query()->create(['email' => $email]);

        Mail::to($subscriber->email)->queue(new NewsletterConfirmationMail(
            confirmUrl: URL::signedRoute('newsletter.confirm', ['subscriber' => $subscriber]),
        ));

        return $subscriber;
    }
}
