<?php

namespace App\Console\Commands;

use App\Services\GameDataReleases;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Sweeps the game-data release store on a schedule. Activation prunes as it
 * swaps the current symlink, but that only fires when a patch actually ships:
 * a quiet month, or a run of extractions that never reach a green Contract
 * suite, leaves superseded releases and dead staging dirs sitting on the
 * server's disk with nothing to clear them.
 */
#[Signature('poe2:prune-game-data')]
#[Description('Remove superseded game-data releases and the leftovers a release cycle drops')]
class PruneGameData extends Command
{
    public function handle(GameDataReleases $releases): int
    {
        ['releases' => $removed, 'staging' => $staging, 'artifacts' => $artifacts] = $releases->prune();

        foreach ([...$removed, ...$staging, ...$artifacts] as $name) {
            $this->line("removed {$name}");
        }

        $this->info(sprintf(
            'Pruned %d release(s), %d stale staging dir(s), %d orphaned artifact(s).',
            count($removed),
            count($staging),
            count($artifacts),
        ));

        return self::SUCCESS;
    }
}
