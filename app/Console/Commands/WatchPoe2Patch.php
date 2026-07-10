<?php

namespace App\Console\Commands;

use App\Jobs\RegenerateGameData;
use App\Jobs\SendDiscordPatchNotification;
use App\Jobs\SendPatchWebhook;
use App\Models\PatchRelease;
use App\Models\PatchSubscriber;
use App\Services\Poe2PatchServer;
use App\Support\Poe2PatchStatus;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('poe2:watch-patch')]
#[Description('Detect a new Path of Exile 2 patch and notify webhook subscribers')]
class WatchPoe2Patch extends Command
{
    public function handle(Poe2PatchServer $patchServer, Poe2PatchStatus $status): int
    {
        $version = $patchServer->currentVersion();

        // Stamp the poll time on every run - the nav shows "last checked" even
        // when the version has not moved.
        $status->record($version);

        // createOrFirst is race-safe (a concurrent manual run and the cron can't both
        // insert): it inserts, or on the unique-version violation fetches the existing row.
        $release = PatchRelease::query()->createOrFirst(['version' => $version]);

        if (! $release->wasRecentlyCreated) {
            $this->info("No new patch (current: {$version}).");

            return self::SUCCESS;
        }

        $this->info("New patch detected: {$version}");

        // Rebuild our GGPK-derived art in place from the fresh CDN.
        RegenerateGameData::dispatch($version);

        // Announce the patch on Discord.
        SendDiscordPatchNotification::dispatch($version);

        $queued = 0;
        PatchSubscriber::query()
            ->verified()
            ->where(fn ($query) => $query
                ->whereNull('last_notified_version')
                ->orWhere('last_notified_version', '!=', $version))
            ->chunkById(200, function ($subscribers) use ($version, &$queued): void {
                foreach ($subscribers as $subscriber) {
                    SendPatchWebhook::dispatch($subscriber, $version);
                    $queued++;
                }
            });

        $this->info("Queued {$queued} webhook notifications.");

        return self::SUCCESS;
    }
}
