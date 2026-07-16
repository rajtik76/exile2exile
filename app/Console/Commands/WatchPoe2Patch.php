<?php

namespace App\Console\Commands;

use App\Jobs\SendDiscordPatchNotification;
use App\Jobs\SendPatchWebhook;
use App\Jobs\StageGameData;
use App\Models\PatchRelease;
use App\Models\PatchSubscriber;
use App\Services\GameDataReleases;
use App\Services\Poe2PatchServer;
use App\Support\Poe2PatchStatus;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

#[Signature('poe2:watch-patch')]
#[Description('Detect a new Path of Exile 2 patch and notify webhook subscribers')]
class WatchPoe2Patch extends Command
{
    /** Minimum time between validation nudges for a patch that is not live yet. */
    private const int RETRY_INTERVAL_HOURS = 6;

    /**
     * Grace period before the first staging attempt for a freshly detected patch.
     * GGG announces the version over the patch server before every art bundle has
     * necessarily finished propagating across the CDN; this delay gives that a
     * head start before the extractor's own fail-loud DDS check takes over via
     * the job's retry backoff.
     */
    private const int FIRST_STAGE_DELAY_MINUTES = 10;

    public function handle(Poe2PatchServer $patchServer, Poe2PatchStatus $status, GameDataReleases $releases): int
    {
        // A transient GGG patch-server outage (timeout, refused, unparseable reply)
        // must not fail the scheduled run: skip this tick and try again next time.
        try {
            $version = $patchServer->currentVersion();
        } catch (\RuntimeException $e) {
            Log::info('poe2:watch-patch skipped: patch server unreachable', ['error' => $e->getMessage()]);
            $this->warn("Patch server unreachable, skipping: {$e->getMessage()}");

            return self::SUCCESS;
        }

        // Stamp the poll time on every run - the nav shows "last checked" even
        // when the version has not moved.
        $status->record($version);

        // createOrFirst is race-safe (a concurrent manual run and the cron can't both
        // insert): it inserts, or on the unique-version violation fetches the existing row.
        $release = PatchRelease::query()->createOrFirst(['version' => $version]);

        if (! $release->wasRecentlyCreated) {
            $this->nudgeStalledValidation($version, $releases);
            $this->info("No new patch (current: {$version}).");

            return self::SUCCESS;
        }

        $this->info("New patch detected: {$version}");

        // Stage the new data next to the live release and ask CI to validate it;
        // the swap happens only after the Contract suite goes green (the workflow
        // calls the activation endpoint). Seed the retry key so the next ticks do
        // not re-dispatch while the extraction is still running. Delayed: see
        // FIRST_STAGE_DELAY_MINUTES.
        Cache::put($this->retryKey($version), now()->toIso8601String(), now()->addHours(self::RETRY_INTERVAL_HOURS));
        StageGameData::dispatch($version)->delay(now()->addMinutes(self::FIRST_STAGE_DELAY_MINUTES));

        // Announce the patch on Discord immediately - subscribers want to know a
        // patch is out now, independent of when staging gets around to running.
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

    /**
     * A known patch that never went live needs a nudge: the staging job may have
     * died, the CI dispatch may have been lost, or a red run was fixed after the
     * fact. Re-dispatch at most once per interval; staging is idempotent, so an
     * already staged release only re-triggers the CI validation. Once the patch
     * is activated (or GGG moves on to a newer version) this stops firing.
     */
    private function nudgeStalledValidation(string $version, GameDataReleases $releases): void
    {
        if ($releases->currentVersion() === $version) {
            return;
        }

        if (Cache::add($this->retryKey($version), now()->toIso8601String(), now()->addHours(self::RETRY_INTERVAL_HOURS))) {
            $this->warn("Patch {$version} is not live yet - re-dispatching staging + validation.");
            StageGameData::dispatch($version);
        }
    }

    private function retryKey(string $version): string
    {
        return "poe2:stage-retry:{$version}";
    }
}
