<?php

namespace App\Console\Commands;

use App\Services\GameDataReleases;
use App\Services\TreeSnapshots;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Snapshots the live passive tree and the tree of every archived era.
 */
#[Signature('poe2:snapshot-trees')]
#[Description('Keep a per-patch copy of the live and archived passive trees')]
class SnapshotPassiveTrees extends Command
{
    public function handle(TreeSnapshots $trees, GameDataReleases $releases): int
    {
        $sources = [
            public_path('tree/current'),
            ...array_map(
                fn (string $version): string => $releases->archivePath($version).'/public/tree/current',
                $releases->archivedVersions(),
            ),
        ];

        foreach ($sources as $source) {
            $patch = $trees->capture($source);

            $this->line($patch === null ? "skipped {$source}: no stamped tree" : "patch {$patch}: {$source}");
        }

        $this->info(sprintf('%d passive tree snapshot(s) on disk.', count($trees->patches())));

        return self::SUCCESS;
    }
}
