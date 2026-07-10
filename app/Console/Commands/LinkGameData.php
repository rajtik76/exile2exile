<?php

namespace App\Console\Commands;

use App\Services\GameDataReleases;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

#[Signature('poe2:link-game-data {--force : Replace an existing real directory with the symlink}')]
#[Description('Point the app\'s game-data paths at the current release symlink')]
class LinkGameData extends Command
{
    /**
     * Deploy-time setup: the extracted data lives outside the checkout (on a
     * persistent volume, under the releases root), so the three paths the app
     * and webserver read must be symlinks through the `current` release pointer.
     * Run this once per deploy - a container rebuild recreates public/ and
     * resources/ and drops the links.
     *
     * Paths already extracted in place (a local dev checkout) are left alone
     * unless --force is given, so this command cannot eat a real extraction.
     */
    public function handle(GameDataReleases $releases): int
    {
        $links = [
            public_path('tree/current') => $releases->root().'/current/public/tree/current',
            public_path('icons/poe2') => $releases->root().'/current/public/icons/poe2',
            resource_path('poe2/ggpk') => $releases->root().'/current/resources/poe2/ggpk',
        ];

        foreach ($links as $link => $target) {
            if (is_link($link)) {
                File::delete($link);
            } elseif (file_exists($link)) {
                if (! $this->option('force')) {
                    $this->error("{$link} exists and is not a symlink; use --force to replace it.");

                    return self::FAILURE;
                }

                File::deleteDirectory($link);
            }

            File::ensureDirectoryExists(dirname($link));

            if (! symlink($target, $link)) {
                $this->error("Could not link {$link} -> {$target}");

                return self::FAILURE;
            }

            $this->info("{$link} -> {$target}");
        }

        return self::SUCCESS;
    }
}
