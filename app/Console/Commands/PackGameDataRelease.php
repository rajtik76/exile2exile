<?php

namespace App\Console\Commands;

use App\Services\GameDataReleases;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('poe2:pack-release {version : The staged release to pack, e.g. 4.5.4.3}')]
#[Description('Pack a staged game-data release into its CI download tarball')]
class PackGameDataRelease extends Command
{
    /**
     * Repair tool: rebuilds the tarball + sha256 sidecar from a release dir that
     * is already on disk, for when the archive went missing (a prune bug, a
     * cleaned volume). Staging a release packs it automatically.
     */
    public function handle(GameDataReleases $releases): int
    {
        $version = (string) $this->argument('version');

        if (! GameDataReleases::isValidVersion($version)) {
            $this->error("Invalid version: {$version}");

            return self::FAILURE;
        }

        if (! $releases->has($version)) {
            $this->error("Release {$version} is not staged under {$releases->releasePath($version)}.");

            return self::FAILURE;
        }

        $checksum = $releases->pack($version);

        $this->info("Packed {$releases->tarballPath($version)}");
        $this->info("sha256: {$checksum}");

        return self::SUCCESS;
    }
}
