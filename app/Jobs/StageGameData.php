<?php

namespace App\Jobs;

use App\Services\GameDataReleases;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\File;
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
 * never went live (a lost dispatch, a failed run fixed later).
 */
class StageGameData implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** The extractor downloads and re-encodes the whole art set; give it headroom. */
    public int $timeout = 1800;

    public function __construct(public string $version) {}

    public function handle(GameDataReleases $releases): void
    {
        if (! GameDataReleases::isValidVersion($this->version)) {
            throw new RuntimeException("refusing to stage an invalid version: {$this->version}");
        }

        if (! $releases->has($this->version)) {
            $this->extract($releases);
        }

        $checksum = $releases->checksum($this->version) ?? $releases->pack($this->version);

        TriggerContractRun::dispatch($this->version, $checksum);
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
        if (! File::moveDirectory($staging, $releases->releasePath($this->version))) {
            throw new RuntimeException("could not publish {$staging} as a release");
        }
    }
}
