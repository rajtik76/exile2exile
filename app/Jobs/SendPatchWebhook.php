<?php

namespace App\Jobs;

use App\Models\PatchSubscriber;
use App\Support\Http\PublicUrlGuard;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Delivers a "new patch" signal to one subscriber's webhook endpoint.
 *
 * The body is signed with the subscriber's secret (HMAC-SHA256) so the receiver
 * can confirm the call is genuine. Failed deliveries retry with backoff.
 */
class SendPatchWebhook implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(
        public PatchSubscriber $subscriber,
        public string $version,
    ) {}

    /**
     * Seconds to wait between retries.
     *
     * @return list<int>
     */
    public function backoff(): array
    {
        return [10, 60, 300, 900];
    }

    public function handle(PublicUrlGuard $guard): void
    {
        // Re-validate the host at send time (a subscriber's DNS could have moved to an
        // internal address since signup) and pin the connection to the resolved public IP.
        $target = $guard->assertPublic($this->subscriber->url);

        $body = (string) json_encode([
            'event' => 'patch.released',
            'game' => 'poe2',
            'version' => $this->version,
            'released_at' => now()->toIso8601String(),
        ], JSON_UNESCAPED_SLASHES);

        Http::connectTimeout(5)
            ->timeout(10)
            ->withoutRedirecting()
            ->withOptions(['curl' => [CURLOPT_RESOLVE => ["{$target['host']}:{$target['port']}:{$target['ip']}"]]])
            ->withBody($body, 'application/json')
            ->withHeaders([
                'X-Poe2-Event' => 'patch.released',
                'X-Poe2-Signature' => 'sha256='.hash_hmac('sha256', $body, $this->subscriber->secret),
            ])
            ->post($this->subscriber->url)
            ->throw();

        // Delivered: record the version and clear the failure streak. consecutive_failures
        // is not mass-assignable, so set both directly rather than through update().
        $this->subscriber->last_notified_version = $this->version;
        $this->subscriber->consecutive_failures = 0;
        $this->subscriber->save();
    }

    /**
     * The job exhausted its retries, so this delivery is a failure. Count it; a
     * verified subscriber whose endpoint misses too many patches in a row is
     * dropped, since it is no longer reachable.
     */
    public function failed(Throwable $exception): void
    {
        report($exception);

        // increment() bumps the column and the in-memory attribute together.
        $this->subscriber->increment('consecutive_failures');

        if ($this->subscriber->consecutive_failures >= PatchSubscriber::MAX_CONSECUTIVE_FAILURES) {
            $this->subscriber->delete();
        }
    }
}
