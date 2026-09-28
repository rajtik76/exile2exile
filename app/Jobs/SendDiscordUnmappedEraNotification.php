<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Tells the operator on Discord that a new patch is on hold because it belongs to
 * no configured game era (`poe.eras`). Such a patch is neither extracted nor
 * validated, so the site keeps serving the previous data until someone maps its
 * prefix by hand and deploys. Posts to the same webhook as the patch announcement;
 * no-ops when none is configured (e.g. locally).
 */
class SendDiscordUnmappedEraNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(public string $version) {}

    /**
     * Seconds to wait between retries.
     *
     * @return list<int>
     */
    public function backoff(): array
    {
        return [10, 60, 300, 900];
    }

    public function handle(): void
    {
        $webhook = config()->string('services.discord.patch_webhook', '');

        if ($webhook === '') {
            Log::info('Skipping Discord unmapped-era notification: no webhook configured.');

            return;
        }

        Http::connectTimeout(5)
            ->timeout(10)
            ->post($webhook, [
                'username' => 'PoE2 Patch Watch',
                'embeds' => [[
                    'title' => 'Patch on hold: no game era',
                    'description' => "Version **{$this->version}** belongs to no game era, so it is not extracted and the site stays on its current data. Map its prefix in `poe.eras` and deploy to stage it.",
                    'url' => config()->string('app.url'),
                    'color' => 0xC0392B,
                    'timestamp' => now()->toIso8601String(),
                ]],
            ])
            ->throw();
    }
}
