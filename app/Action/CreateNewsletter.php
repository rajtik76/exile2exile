<?php

declare(strict_types=1);

namespace App\Action;

use App\Events\NewsletterCreatedEvent;
use App\Models\Newsletter;

/**
 * Creates a newsletter issue and explicitly kicks off delivery. The event is
 * dispatched here, not from a model event, so tests and seeders can create
 * Newsletter rows without accidentally emailing every subscriber.
 */
class CreateNewsletter
{
    public function __invoke(string $title, string $body): Newsletter
    {
        $newsletter = Newsletter::query()->create(['title' => $title, 'body' => $body]);

        NewsletterCreatedEvent::dispatch($newsletter);

        return $newsletter;
    }
}
