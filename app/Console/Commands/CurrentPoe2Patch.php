<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Poe2PatchServer;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * Prints the current PoE2 patch version, queried live from GGG's own patch
 * server - nothing more (no decoration), so a caller can capture stdout
 * directly. Used by the GGPK extractor (`tools/poe-data-extract/refresh.mjs`)
 * as its default when no `PATCH` env override is given: the extractor pins no
 * version of its own, so a fresh clone or a manual run always targets whatever
 * GGG currently serves rather than a stale committed default.
 */
#[Signature('poe2:current-patch')]
#[Description('Print the current PoE2 patch version from the GGG patch server')]
class CurrentPoe2Patch extends Command
{
    public function handle(Poe2PatchServer $patchServer): int
    {
        try {
            $this->line($patchServer->currentVersion());
        } catch (RuntimeException $e) {
            $this->error("Patch server unreachable: {$e->getMessage()}");

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
