<?php

declare(strict_types=1);

namespace App\Pob\Uniques;

use App\Services\GameDataReleases;
use Illuminate\Support\Facades\File;

/**
 * The on-disk store for synced PoB unique mods, deliberately outside
 * storage/game-data/releases/<version> and its `current` symlink: a GGPK patch swap must
 * never touch this, since unique mods update on their own daily cadence, not the patch
 * cycle. Same persistent volume, sibling directory.
 *
 * Layout (under poe.pob_uniques.storage_path, storage/game-data/pob-uniques by default):
 *
 *   current.json          the live snapshot, written atomically (temp file + rename)
 */
final class PobUniqueStore
{
    private function path(): string
    {
        return rtrim(config()->string('poe.pob_uniques.storage_path'), '/').'/current.json';
    }

    /**
     * Write the synced snapshot atomically: a torn/partial write must never be visible to
     * a concurrent reader, so the payload lands in a temp file first and rename(2) swaps it
     * into place in one step - the same idiom {@see GameDataReleases} uses
     * for the release `current` symlink.
     *
     * @param  array<string, array{name: string, base: string, league: ?string, implicitCount: int, mods: list<string>}>  $uniques  keyed by unique name
     */
    public function write(array $uniques, string $sourceRef): void
    {
        $path = $this->path();
        File::ensureDirectoryExists(dirname($path));

        $payload = [
            'syncedAt' => now()->toIso8601String(),
            'sourceRef' => $sourceRef,
            'uniques' => $uniques,
        ];

        $tempPath = $path.'.'.bin2hex(random_bytes(4)).'.tmp';
        File::put($tempPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        rename($tempPath, $path);
    }

    /**
     * The live snapshot, or null before the first successful sync.
     *
     * @return array{syncedAt: string, sourceRef: string, uniques: array<string, array{name: string, base: string, league: ?string, implicitCount: int, mods: list<string>}>}|null
     */
    public function read(): ?array
    {
        $path = $this->path();

        if (! File::exists($path)) {
            return null;
        }

        /** @var array{syncedAt: string, sourceRef: string, uniques: array<string, array{name: string, base: string, league: ?string, implicitCount: int, mods: list<string>}>}|null $decoded */
        $decoded = json_decode(File::get($path), true);

        return $decoded;
    }
}
