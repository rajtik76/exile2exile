<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Process;

/**
 * Builds the derived game-data indices into the cache right after a release goes live,
 * so no web request has to (see the poe2:warm-game-data command).
 *
 * Runs the command in its own process rather than inline: the data version every cache
 * key carries is read at config-load time, and a long-running queue worker still holds
 * the one from before the swap.
 */
class WarmGameDataCache implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function handle(): void
    {
        Process::path(base_path())
            ->timeout(600)
            ->run([PHP_BINARY, 'artisan', 'poe2:warm-game-data'])
            ->throw();
    }
}
