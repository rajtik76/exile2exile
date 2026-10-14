<?php

declare(strict_types=1);

namespace App\Pob\Gems;

use App\Pob\Uniques\PobUniqueStore;
use App\Services\GameDataReleases;
use Illuminate\Support\Facades\File;

/**
 * The on-disk store for the synced PoB gem list, outside the GGPK release symlink like
 * {@see PobUniqueStore}: it moves on PoB's daily cadence, not the patch cycle.
 *
 * Layout (under poe.pob_gems.storage_path, storage/game-data/pob-gems by default):
 *
 *   current.json          the live snapshot, written atomically (temp file + rename)
 */
final class PobGemStore
{
    /**
     * The live snapshot's file, also read by {@see GameDataReleases} to freeze it
     * alongside the release of a game era that is ending.
     */
    public function path(): string
    {
        return rtrim(config()->string('poe.pob_gems.storage_path'), '/').'/current.json';
    }

    /**
     * Write the snapshot atomically, the same temp file + rename(2) idiom as
     * {@see PobUniqueStore::write()}.
     *
     * @param  list<string>  $gemIds  gem ids keyed like the GGPK gem catalogue (the last segment of PoB's gameId)
     */
    public function write(array $gemIds, string $sourceRef): void
    {
        $path = $this->path();
        File::ensureDirectoryExists(dirname($path));

        $payload = [
            'syncedAt' => now()->toIso8601String(),
            'sourceRef' => $sourceRef,
            'gems' => $gemIds,
        ];

        $tempPath = $path.'.'.bin2hex(random_bytes(4)).'.tmp';
        File::put($tempPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        rename($tempPath, $path);
    }

    /**
     * The live snapshot, or null before the first successful sync.
     *
     * @return array{syncedAt: string, sourceRef: string, gems: list<string>}|null
     */
    public function read(): ?array
    {
        $path = $this->path();

        if (! File::exists($path)) {
            return null;
        }

        /** @var array{syncedAt: string, sourceRef: string, gems: list<string>}|null $decoded */
        $decoded = json_decode(File::get($path), true);

        return $decoded;
    }
}
