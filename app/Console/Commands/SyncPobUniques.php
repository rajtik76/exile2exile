<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Pob\Uniques\PobUniqueModsParser;
use App\Pob\Uniques\PobUniquesGithubSource;
use App\Pob\Uniques\PobUniqueStore;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Refresh the local unique-item mod snapshot from Path of Building's community-maintained
 * `Data/Uniques/*.lua` files (schedule in routes/console.php, daily - independent of the
 * GGPK patch cycle). This is the one documented exception to the project's GGPK-only rule:
 * unique mods do not exist in GGG's own data files.
 */
#[Signature('poe2:sync-pob-uniques')]
#[Description('Refresh the cached Path of Building unique-item mods')]
class SyncPobUniques extends Command
{
    public function handle(PobUniquesGithubSource $source, PobUniqueModsParser $parser, PobUniqueStore $store): int
    {
        $files = $source->listFiles();

        if ($files === []) {
            $this->error('No .lua files found - check poe.pob_uniques.repo/path/ref.');

            return self::FAILURE;
        }

        $uniques = [];
        $failed = 0;

        foreach ($files as $file) {
            try {
                $lua = $source->fetch($file['downloadUrl']);

                foreach ($parser->parse($lua) as $unique) {
                    // A later file overwriting an earlier one would silently drop a unique;
                    // names are unique across PoB's own data, so a collision means a parsing
                    // bug and is worth surfacing rather than swallowing.
                    if (isset($uniques[$unique['name']])) {
                        $this->warn("  Duplicate unique name \"{$unique['name']}\" (in {$file['name']}) - keeping the first.");

                        continue;
                    }

                    $uniques[$unique['name']] = $unique;
                }
            } catch (\Throwable $e) {
                // Isolate a per-file failure so the rest of the sync still completes - a
                // partial snapshot (missing one item class) is better than none at all.
                $failed++;
                $this->error("  Failed to sync \"{$file['name']}\": {$e->getMessage()}");
                report($e);
            }
        }

        if ($failed === count($files)) {
            $this->error('Every source file failed - not overwriting the last known-good snapshot.');

            return self::FAILURE;
        }

        // A parse-format mismatch upstream (a renamed prefix, a restructured block) can make
        // every file "succeed" over HTTP while yielding far fewer uniques than before - a
        // silent snapshot collapse the per-file try/catch above can't see. Refuse to overwrite
        // a healthy snapshot with a suspiciously small one; the app keeps serving the last
        // known-good data (a unique with no synced mods yet just renders without them, same
        // as before this feature existed) instead of losing most of its unique catalogue.
        $previous = $store->read();

        if ($previous !== null && $previous['uniques'] !== []) {
            $maxDropRatio = config()->float('poe.pob_uniques.max_drop_ratio');
            $minAcceptable = (int) ceil(count($previous['uniques']) * (1 - $maxDropRatio));

            if (count($uniques) < $minAcceptable) {
                $this->error(sprintf(
                    'Parsed only %d unique(s), down from %d in the last snapshot (more than %d%% dropped) - not overwriting.',
                    count($uniques),
                    count($previous['uniques']),
                    (int) ($maxDropRatio * 100),
                ));

                return self::FAILURE;
            }
        }

        $ref = $this->resolveSourceRef($source);
        $store->write($uniques, $ref);

        $this->info(sprintf('%d unique(s) cached from %d file(s)%s.', count($uniques), count($files), $failed > 0 ? ", {$failed} file(s) failed" : ''));

        return self::SUCCESS;
    }

    /**
     * The exact commit the synced data came from, so a bad value can be traced back - falls
     * back to the mutable "repo@ref" label if the lookup itself fails, since that failure
     * alone should not abort an otherwise-successful sync.
     */
    private function resolveSourceRef(PobUniquesGithubSource $source): string
    {
        $repo = config()->string('poe.pob_uniques.repo');
        $ref = config()->string('poe.pob_uniques.ref');

        try {
            return "{$repo}@{$source->resolveRef()}";
        } catch (\Throwable $e) {
            $this->warn("  Could not resolve \"{$ref}\" to a commit sha: {$e->getMessage()}");
            report($e);

            return "{$repo}@{$ref}";
        }
    }
}
