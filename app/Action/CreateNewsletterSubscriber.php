<?php

declare(strict_types=1);

namespace App\Action;

use App\Mail\NewsletterConfirmationMail;
use App\Models\NewsletterSubscriber;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Mail;

/**
 * Signs an email up and sends the double opt-in confirmation. Idempotent on
 * purpose: re-submitting an unconfirmed address resends the confirmation link
 * (the first mail may have bounced or landed in spam) and a confirmed address
 * is left untouched. Either way the caller shows the same neutral "check your
 * inbox" response, so the form never reveals whether an address is on the
 * list.
 */
class CreateNewsletterSubscriber
{
    public function __invoke(string $email): NewsletterSubscriber
    {
        try {
            $subscriber = NewsletterSubscriber::query()->firstOrCreate(['email' => $email]);
        } catch (UniqueConstraintViolationException) {
            // Two identical signups raced past firstOrCreate's SELECT; the row
            // now exists, so fall through to the resend path.
            $subscriber = NewsletterSubscriber::query()->where('email', $email)->firstOrFail();
        }

        if ($subscriber->confirmed_at === null) {
            Mail::to($subscriber->email)->queue(new NewsletterConfirmationMail(
                confirmUrl: $subscriber->confirmUrl(),
            ));
        }

        return $subscriber;
    }
}
