<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Pob\Gems\PobGemListParser;
use App\Pob\Gems\PobGemsGithubSource;
use App\Pob\Gems\PobGemStore;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Refresh the gem list the gem picker offers from Path of Building's `Data/Gems.lua`
 * (schedule in routes/console.php, daily - independent of the GGPK patch cycle). GGPK
 * carries gems no player can get and no flag to tell them apart, while PoB picks its gems
 * by hand. Only the gem ids are taken; every gem's data still comes from GGPK.
 */
#[Signature('poe2:sync-pob-gems')]
#[Description('Refresh the cached Path of Building gem list')]
class SyncPobGems extends Command
{
    public function handle(PobGemsGithubSource $source, PobGemListParser $parser, PobGemStore $store): int
    {
        try {
            $gemIds = $parser->parse($source->fetch());
        } catch (\Throwable $e) {
            $this->error("Failed to download the PoB gem list: {$e->getMessage()}");
            report($e);

            return self::FAILURE;
        }

        if ($gemIds === []) {
            $this->error('No gem ids found - check poe.pob_gems.repo/path/ref.');

            return self::FAILURE;
        }

        // An upstream format change can starve the parser without any HTTP error; never
        // replace a healthy snapshot with a gutted one, which would empty the gem picker.
        $previous = $store->read();

        if ($previous !== null && $previous['gems'] !== []) {
            $maxDropRatio = config()->float('poe.pob_gems.max_drop_ratio');
            $minAcceptable = (int) ceil(count($previous['gems']) * (1 - $maxDropRatio));

            if (count($gemIds) < $minAcceptable) {
                $this->error(sprintf(
                    'Parsed only %d gem(s), down from %d in the last snapshot (more than %d%% dropped) - not overwriting.',
                    count($gemIds),
                    count($previous['gems']),
                    (int) ($maxDropRatio * 100),
                ));

                return self::FAILURE;
            }
        }

        $store->write($gemIds, $this->resolveSourceRef($source));

        $this->info(sprintf('%d gem(s) cached.', count($gemIds)));

        return self::SUCCESS;
    }

    /**
     * The exact commit the synced list came from - falls back to the mutable "repo@ref"
     * label if the lookup itself fails, since that alone should not abort the sync.
     */
    private function resolveSourceRef(PobGemsGithubSource $source): string
    {
        $repo = config()->string('poe.pob_gems.repo');
        $ref = config()->string('poe.pob_gems.ref');

        try {
            return "{$repo}@{$source->resolveRef()}";
        } catch (\Throwable $e) {
            $this->warn("  Could not resolve \"{$ref}\" to a commit sha: {$e->getMessage()}");
            report($e);

            return "{$repo}@{$ref}";
        }
    }
}
