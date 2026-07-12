<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Newsletter;
use Illuminate\Foundation\Events\Dispatchable;

class NewsletterCreatedEvent
{
    use Dispatchable;

    public function __construct(public readonly Newsletter $newsletter) {}
}
