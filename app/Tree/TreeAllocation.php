<?php

declare(strict_types=1);

namespace App\Tree;

/**
 * The passive-tree selection every surface shares: the allocated node ids plus
 * the choices the renderer replays (per-node attribute picks, weapon-set
 * assignments, socketed jewels) and the tree version they were made against.
 *
 * The one shape a shared tree stores (inside {@see TreeSnapshot}), a build plan
 * embeds per phase and the PoB decode endpoint returns - so the surfaces can
 * never drift apart.
 */
final readonly class TreeAllocation
{
    /**
     * Upper bound on allocated nodes. A full build spends ~123 points plus its
     * ascendancy and any pathing; this leaves generous head-room while capping
     * the payload so a junk blob can't carry an arbitrarily large list.
     */
    public const int MAX_NODES = 600;

    /**
     * The three choices a generic +attribute node offers.
     *
     * @var list<string>
     */
    public const array ATTRIBUTES = ['str', 'dex', 'int'];

    /**
     * @param  list<int>  $allocated
     * @param  array<int, string>  $attributeChoices  node id -> chosen attribute
     * @param  array<int, int>  $weaponSets  node id -> weapon set (1 or 2)
     * @param  array<int|string, mixed>  $jewels  socketed jewels keyed by socket node id (display-only blob)
     */
    public function __construct(
        public array $allocated = [],
        public array $attributeChoices = [],
        public array $weaponSets = [],
        public array $jewels = [],
        public ?string $treeVersion = null,
    ) {}

    /**
     * Coerce any allocation blob into a clean instance: node ids become integer
     * lists (capped), an attribute choice outside str/dex/int and a weapon set
     * outside 1/2 are dropped. Trusted data passes through unchanged, so the
     * same constructor serves the DB read path and the repair path alike.
     *
     * @param  array<int|string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $allocated = is_array($data['allocated'] ?? null)
            ? array_values(array_slice(array_map(intval(...), $data['allocated']), 0, self::MAX_NODES))
            : [];

        $attributeChoices = [];

        if (is_array($data['attributeChoices'] ?? null)) {
            foreach ($data['attributeChoices'] as $node => $attribute) {
                if (in_array($attribute, self::ATTRIBUTES, true)) {
                    $attributeChoices[(int) $node] = (string) $attribute;
                }
            }
        }

        $weaponSets = [];

        if (is_array($data['weaponSets'] ?? null)) {
            foreach ($data['weaponSets'] as $node => $set) {
                if (in_array((int) $set, [1, 2], true)) {
                    $weaponSets[(int) $node] = (int) $set;
                }
            }
        }

        return new self(
            allocated: $allocated,
            attributeChoices: $attributeChoices,
            weaponSets: $weaponSets,
            jewels: is_array($data['jewels'] ?? null) ? $data['jewels'] : [],
            treeVersion: is_string($data['treeVersion'] ?? null) && $data['treeVersion'] !== '' ? $data['treeVersion'] : null,
        );
    }

    /**
     * The plain-array form stored in the database and embedded in plan JSON.
     *
     * @return array{allocated: list<int>, attributeChoices: array<int, string>, weaponSets: array<int, int>, jewels: array<int|string, mixed>, treeVersion: ?string}
     */
    public function toArray(): array
    {
        return [
            'allocated' => $this->allocated,
            'attributeChoices' => $this->attributeChoices,
            'weaponSets' => $this->weaponSets,
            'jewels' => $this->jewels,
            'treeVersion' => $this->treeVersion,
        ];
    }
}
