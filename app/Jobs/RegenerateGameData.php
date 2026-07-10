<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Process;

/**
 * Regenerates the app's GGPK-derived art in place for a newly detected patch.
 *
 * The watcher dispatches this when it sees a version it has not recorded. It runs
 * the extractor pipeline (`npm run refresh:data`) on the host, pinning the detected
 * version, so the item/gem/rune icons and passive-tree atlases under public/ are
 * rebuilt straight from the patch CDN - the committed art was removed from the repo,
 * so this is what puts it on disk. Source of truth: GGPK only.
 */
class RegenerateGameData implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** The extractor downloads and re-encodes the whole art set; give it headroom. */
    public int $timeout = 1800;

    public function __construct(public string $version) {}

    public function handle(): void
    {
        Process::path(base_path())
            ->env(['PATCH' => $this->version])
            ->timeout($this->timeout)
            ->run(['npm', 'run', 'refresh:data'])
            ->throw();
    }
}
