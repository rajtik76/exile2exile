<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Newsletter;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * SerializesModels matters here: the queued listener serializes this event,
 * and without the trait the whole Newsletter (body included, twice - current
 * and original attributes) would be copied into the job payload instead of a
 * small model identifier.
 */
class NewsletterCreatedEvent
{
    use Dispatchable, SerializesModels;

    public function __construct(public readonly Newsletter $newsletter) {}
}
