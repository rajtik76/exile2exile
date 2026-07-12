<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\NewsletterCreatedEvent;
use App\Mail\NewsletterMail;
use App\Models\NewsletterSubscriber;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

/**
 * Fans one newsletter issue out to every confirmed subscriber. Runs on the
 * queue itself and only pushes further queued mailables, so a large list never
 * blocks the artisan command that created the issue.
 */
class SendNewsletterListener implements ShouldQueue
{
    use InteractsWithQueue;

    public function handle(NewsletterCreatedEvent $event): void
    {
        NewsletterSubscriber::query()
            ->confirmed()
            ->lazyById()
            ->each(function (NewsletterSubscriber $subscriber) use ($event): void {
                Mail::to($subscriber->email)->queue(new NewsletterMail(
                    title: $event->newsletter->title,
                    body: $event->newsletter->body,
                    unsubscribeUrl: URL::signedRoute('newsletter.unsubscribe', ['subscriber' => $subscriber]),
                ));
            });
    }
}
