<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\NewsletterCreatedEvent;
use App\Mail\NewsletterMail;
use App\Models\NewsletterSubscriber;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Mail;

/**
 * Fans one newsletter issue out to every confirmed subscriber. Runs on the
 * queue itself and only pushes further queued mailables, so a large list never
 * blocks the artisan command that created the issue.
 *
 * The fan-out is resumable: the newsletter's dispatched_up_to_id cursor is
 * advanced after each queued mailable, so when the worker retries this job
 * (crash, timeout, deploy restart mid-loop) it continues after the last
 * subscriber already handled instead of double-sending from the start.
 */
class SendNewsletterListener implements ShouldQueue
{
    use InteractsWithQueue;

    /** A large list needs more than the worker's default 60s job timeout. */
    public int $timeout = 900;

    public function handle(NewsletterCreatedEvent $event): void
    {
        $newsletter = $event->newsletter->fresh();

        if ($newsletter === null) {
            return;
        }

        NewsletterSubscriber::query()
            ->confirmed()
            ->where('id', '>', $newsletter->dispatched_up_to_id)
            ->lazyById()
            ->each(function (NewsletterSubscriber $subscriber) use ($newsletter): void {
                Mail::to($subscriber->email)->queue(new NewsletterMail(
                    newsletter: $newsletter,
                    unsubscribeUrl: $subscriber->unsubscribeUrl(),
                ));

                // Advance the cursor per subscriber; saveQuietly keeps
                // updated_at (and model events) out of the bookkeeping write.
                $newsletter->forceFill(['dispatched_up_to_id' => $subscriber->id])->saveQuietly();
            });
    }
}
