<?php

declare(strict_types=1);

namespace App\Services;

use App\Pob\GameData\GameDataStore;
use App\Pob\GemRequirements;
use App\Pob\Gems\PobGemStore;
use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Pob\Uniques\PobUniqueStore;
use App\Support\GameEra;
use App\Tree\CachedTreeIndex;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Builds the catalogues a saved build of a finished game era is resolved against.
 */
class ArchivedGameData
{
    public function __construct(
        private readonly GameDataReleases $releases,
        private readonly GameEra $eras,
        private readonly TreeSnapshots $trees,
        private readonly GameDataDirectories $directories,
        private readonly Cache $cache,
    ) {}

    /**
     * Null when the patch belongs to the live era, to no era, or to an era whose
     * release or passive tree was never archived.
     */
    public function forPatch(string $gamePatch): ?ArchivedCatalogues
    {
        $era = $this->eras->forPatch($gamePatch);

        if ($era === null || $this->eras->isLive($gamePatch)) {
            return null;
        }

        $archive = $this->archiveOf($era);
        $treePatch = $this->trees->forPatch($gamePatch);

        if ($archive === null || $treePatch === null) {
            return null;
        }

        $root = $this->releases->archivePath($archive);
        $disk = Storage::build(['driver' => 'local', 'root' => $root, 'throw' => false, 'report' => false]);
        $hash = $this->directories->treeStamp($root.'/public/tree/current')['hash'] ?? '';
        $version = "archive:{$archive}:{$hash}";

        return new ArchivedCatalogues(
            gameEra: $era,
            eraName: $this->eras->nameOf($era),
            treePatch: $treePatch,
            treeVersion: $this->trees->version($treePatch),
            icons: new IconResolver(
                pobUniqueStore: new PobUniqueStore($root.'/pob-uniques'),
                gemRequirements: new GemRequirements(disk: $disk),
                pobGemStore: new PobGemStore($root.'/pob-gems'),
                store: new GameDataStore($this->cache, $version, $disk, $this->releases->eraIconWebBase($archive)),
            ),
            mods: new ModCatalogue($this->cache, $version, $disk),
            tree: new CachedTreeIndex($this->cache, $version, 'public/tree/current/data.json', $disk),
        );
    }

    private function archiveOf(string $era): ?string
    {
        foreach ($this->releases->archivedVersions() as $archive) {
            if ($this->eras->forPatch($archive) === $era) {
                return $archive;
            }
        }

        return null;
    }
}
