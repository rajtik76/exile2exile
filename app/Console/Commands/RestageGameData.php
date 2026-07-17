<?php

namespace App\Console\Commands;

use App\Jobs\StageGameData;
use App\Services\GameDataReleases;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('poe2:restage-data {version? : Patch to (re-)stage; defaults to the current live release} {--force : Re-run the GGPK extraction even if this version is already staged}')]
#[Description('Manually stage a game-data release and dispatch CI validation, without waiting for a new game patch')]
class RestageGameData extends Command
{
    /**
     * The watcher only stages a release when GGG ships a new patch version, so
     * a change to the extractor packages alone (poe2-toolkit bump) never gets
     * exercised against production data on its own. This dispatches the same
     * StageGameData + TriggerContractRun pipeline by hand, for the currently
     * pinned patch or one given explicitly, going through the usual CI gate
     * before anything is activated.
     */
    public function handle(GameDataReleases $releases): int
    {
        $version = (string) ($this->argument('version') ?: $releases->currentVersion());

        if ($version === '') {
            $this->error('No version given and no current release to default to.');

            return self::FAILURE;
        }

        if (! GameDataReleases::isValidVersion($version)) {
            $this->error("Invalid version: {$version}");

            return self::FAILURE;
        }

        $force = (bool) $this->option('force');

        StageGameData::dispatch($version, $force);

        $this->info("Dispatched StageGameData for {$version}".($force ? ' (forced re-extraction)' : ' (extraction skipped if already staged)'));

        return self::SUCCESS;
    }
}
