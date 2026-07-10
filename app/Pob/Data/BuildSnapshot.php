<?php

declare(strict_types=1);

namespace App\Pob\Data;

use App\Pob\Decoding\CachingBuildDecoder;

/**
 * Canonical, source-agnostic representation of a character build.
 *
 * Produced from a PoB export today; the same shape will be produced from the
 * GGG OAuth character endpoint later. The diff engine consumes only this.
 */
final readonly class BuildSnapshot
{
    /**
     * Version of this snapshot's shape. Bump it whenever the structure changes
     * (a field added/removed/retyped) so any cache keyed on it (see
     * {@see CachingBuildDecoder}) is invalidated and stale,
     * differently-shaped entries are never read back.
     */
    public const int SCHEMA_VERSION = 4;

    /**
     * @param  list<int>  $passiveNodes  Allocated passive skill node IDs.
     * @param  list<GemGroup>  $skillGroups
     * @param  list<EquippedItem>  $items
     * @param  array{str: int, dex: int, int: int}  $attributes  Total Strength/Dexterity/Intelligence of the character (tree + gear + base).
     * @param  array{str: list<int>, dex: list<int>, int: list<int>}  $attributeNodes  Chosen attribute per generic +attribute node.
     * @param  array<int, array{name: string, rarity: string, baseType: string, mods: list<string>, icon: ?string}>  $jewels  Socketed tree jewels, keyed by socket node id.
     * @param  array<int, int>  $weaponSets  Weapon set (1 or 2) per set-specific passive node id.
     */
    public function __construct(
        public int $level,
        public CharacterClass $class,
        public ?Ascendancy $ascendancy,
        public int $classId,
        public string $treeVersion,
        public array $passiveNodes,
        public array $skillGroups,
        public array $items,
        public array $attributes = ['str' => 0, 'dex' => 0, 'int' => 0],
        public array $attributeNodes = ['str' => [], 'dex' => [], 'int' => []],
        public array $jewels = [],
        public array $weaponSets = [],
    ) {}

    /**
     * @return array{
     *     level: int,
     *     className: string,
     *     ascendancy: ?string,
     *     classId: int,
     *     treeVersion: string,
     *     passiveNodeCount: int,
     *     passiveNodes: list<int>,
     *     attributes: array{str: int, dex: int, int: int},
     *     attributeNodes: array{str: list<int>, dex: list<int>, int: list<int>},
     *     jewels: array<int, array{name: string, rarity: string, baseType: string, mods: list<string>, icon: ?string}>,
     *     weaponSets: array<int, int>,
     *     skillGroups: list<array<string, mixed>>,
     *     items: list<array<string, mixed>>,
     * }
     */
    public function toArray(): array
    {
        return [
            'level' => $this->level,
            'className' => $this->class->value,
            'ascendancy' => $this->ascendancy?->value,
            'classId' => $this->classId,
            'treeVersion' => $this->treeVersion,
            'passiveNodeCount' => count($this->passiveNodes),
            'passiveNodes' => $this->passiveNodes,
            'attributes' => $this->attributes,
            'attributeNodes' => $this->attributeNodes,
            'jewels' => $this->jewels,
            'weaponSets' => $this->weaponSets,
            'skillGroups' => array_map(static fn (GemGroup $group): array => $group->toArray(), $this->skillGroups),
            'items' => array_map(static fn (EquippedItem $item): array => $item->toArray(), $this->items),
        ];
    }
}
