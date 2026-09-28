<?php

namespace App\Jobs;

use App\Services\GameDataReleases;
use App\Support\GameEra;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Stages a newly detected patch next to the live data, then asks CI to validate it.
 *
 * The extractor pipeline (`npm run refresh:data`) runs with the detected version
 * and DATA_OUT pointed at releases/<version>.staging, so the live release behind
 * the `current` symlink is never touched. On success the staging dir becomes
 * releases/<version>, is packed into a tarball for CI to download, and the
 * data-contract workflow is dispatched with the version and the tarball's
 * checksum. The swap to the new release happens only when that workflow goes
 * green and calls the activation endpoint. Source of truth: GGPK only.
 *
 * Re-dispatching for an already staged version skips the extraction and only
 * re-triggers the CI validation, so the watcher can safely nudge a release that
 * never went live (a lost dispatch, a failed run fixed later). Pass force to
 * re-run the extraction anyway - needed when only the extractor packages
 * changed (poe2:restage-data), since the game patch itself did not move.
 *
 * A patch that belongs to no configured game era (`poe.eras`) is put on hold
 * before anything is downloaded: an era change is a human call, and a new era
 * usually needs extractor changes first, so an extraction now would only stage
 * output of the old extractor that a later run would then reuse. The operator is
 * told once on Discord; once the prefix is mapped and deployed, the watcher's
 * next nudge extracts and validates it like any other release.
 */
class StageGameData implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /** The extractor downloads and re-encodes the whole art set; give it headroom. */
    public int $timeout = 1800;

    public function __construct(public string $version, public bool $force = false) {}

    /**
     * Seconds to wait between retries.
     *
     * A retry only ever happens because the extractor threw - typically a patch
     * CDN that has not finished propagating every bundle right after a fresh
     * release (see buildCentre.ts's fail-loud DDS check). 15 minutes gives that
     * propagation real time to catch up before trying again.
     *
     * @return list<int>
     */
    public function backoff(): array
    {
        return [900, 900, 900, 900];
    }

    public function handle(GameDataReleases $releases): void
    {
        if (! GameDataReleases::isValidVersion($this->version)) {
            throw new RuntimeException("refusing to stage an invalid version: {$this->version}");
        }

        if (app(GameEra::class)->forPatch($this->version) === null) {
            $this->holdUnmappedEra();

            return;
        }

        $extracted = $this->force || ! $releases->has($this->version);

        if ($extracted) {
            $this->extract($releases);
        }

        // A forced re-extraction overwrites the release dir with fresh output, so
        // a stale tarball/checksum from before must be repacked rather than reused.
        $checksum = $extracted ? null : $releases->checksum($this->version);
        $checksum ??= $releases->pack($this->version);

        TriggerContractRun::dispatch($this->version, $checksum);
    }

    /**
     * Leave a patch of no configured era untouched and tell the operator. The
     * watcher re-dispatches this job every few hours while the patch is not live,
     * so the Discord notice is sent once per version, not on every nudge.
     */
    private function holdUnmappedEra(): void
    {
        Log::warning("Patch {$this->version} belongs to no configured game era and is on hold; map its prefix in poe.eras to stage it.");

        if (Cache::add("poe2:unmapped-era:{$this->version}", now()->toIso8601String())) {
            SendDiscordUnmappedEraNotification::dispatch($this->version);
        }
    }

    private function extract(GameDataReleases $releases): void
    {
        $staging = $releases->stagingPath($this->version);

        File::deleteDirectory($staging);
        File::ensureDirectoryExists($staging);

        Process::path(base_path())
            ->env(['PATCH' => $this->version, 'DATA_OUT' => $staging])
            ->timeout($this->timeout)
            ->run(['npm', 'run', 'refresh:data'])
            ->throw();

        // The rename publishes the staging dir as a release only once the whole
        // extraction succeeded; a failed run leaves at most a .staging leftover.
        // overwrite: true lets a forced re-extraction replace an already staged
        // release dir instead of failing because the destination exists.
        if (! File::moveDirectory($staging, $releases->releasePath($this->version), overwrite: true)) {
            throw new RuntimeException("could not publish {$staging} as a release");
        }
    }
}
