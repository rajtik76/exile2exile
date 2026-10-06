<?php

declare(strict_types=1);

namespace App\Pob\Uniques;

use App\Pob\GameData\UniqueCatalog;
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
    /**
     * The live snapshot's file, also read by {@see GameDataReleases} to freeze it
     * alongside the release of a game era that is ending.
     */
    public function path(): string
    {
        return rtrim(config()->string('poe.pob_uniques.storage_path'), '/').'/current.json';
    }

    /**
     * Write the synced snapshot atomically: a torn/partial write must never be visible to
     * a concurrent reader, so the payload lands in a temp file first and rename(2) swaps it
     * into place in one step - the same idiom {@see GameDataReleases} uses
     * for the release `current` symlink.
     *
     * Entries are keyed by unique id: the unique's name, or "Name, Base" when PoB has the
     * same name on more than one base (Grand Spectrum on Ruby, Emerald and Sapphire) - the
     * same "Title, BaseName" key PoB's own uniqueDB uses (`Classes/Item.lua`). Older
     * snapshots carry `implicitCount` + `mods` instead of `lines` (see {@see UniqueCatalog}).
     *
     * @param  array<string, array{name: string, base: string, league: ?string, variants?: ?array<string, mixed>, lines?: list<array{text: string, implicit: bool, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, implicitCount?: int, mods?: list<string>}>  $uniques  keyed by unique id
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
     * @return array{syncedAt: string, sourceRef: string, uniques: array<string, array{name: string, base: string, league: ?string, variants?: ?array<string, mixed>, lines?: list<array{text: string, implicit: bool, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, implicitCount?: int, mods?: list<string>}>}|null
     */
    public function read(): ?array
    {
        $path = $this->path();

        if (! File::exists($path)) {
            return null;
        }

        /** @var array{syncedAt: string, sourceRef: string, uniques: array<string, array{name: string, base: string, league: ?string, variants?: ?array<string, mixed>, lines?: list<array{text: string, implicit: bool, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, implicitCount?: int, mods?: list<string>}>}|null $decoded */
        $decoded = json_decode(File::get($path), true);

        return $decoded;
    }
}
