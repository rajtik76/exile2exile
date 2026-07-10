<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Announces a freshly detected PoE2 patch to a Discord channel via webhook.
 *
 * The watcher posts this when it sees a version it has not recorded before. The
 * payload is a Discord embed, so it renders as a card in the channel. No-ops when
 * no webhook is configured (e.g. locally).
 */
class SendDiscordPatchNotification implements ShouldQueue
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
            Log::info('Skipping Discord patch notification: no webhook configured.');

            return;
        }

        Http::connectTimeout(5)
            ->timeout(10)
            ->post($webhook, [
                'username' => 'PoE2 Patch Watch',
                'embeds' => [[
                    'title' => 'New Path of Exile 2 patch',
                    'description' => "Version **{$this->version}** is live.",
                    'url' => 'https://poe.rajtik.com',
                    'color' => 0xD4A24E,
                    'timestamp' => now()->toIso8601String(),
                ]],
            ])
            ->throw();
    }
}
