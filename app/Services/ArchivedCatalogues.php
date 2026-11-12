<?php

declare(strict_types=1);

namespace App\Services;

use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Tree\TreeIndex;

/**
 * The catalogues of a finished game era, read from its frozen release archive.
 */
final readonly class ArchivedCatalogues
{
    public function __construct(
        public string $gameEra,
        public ?string $eraName,
        public string $treePatch,
        public string $treeVersion,
        public IconResolver $icons,
        public ModCatalogue $mods,
        public TreeIndex $tree,
    ) {}

    /**
     * @return array{gameEra: string, eraName: ?string, treePatch: string, treeVersion: string}
     */
    public function toArray(): array
    {
        return [
            'gameEra' => $this->gameEra,
            'eraName' => $this->eraName,
            'treePatch' => $this->treePatch,
            'treeVersion' => $this->treeVersion,
        ];
    }
}
