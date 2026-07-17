<?php

declare(strict_types=1);

namespace App\Support\Planner;

use App\Pob\Data\BuildSnapshot;
use App\Pob\Data\EquippedItem;
use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Support\Planner\Matching\AffixMatcher;
use App\Support\Planner\Matching\UniqueModMatcher;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Turns a decoded {@see BuildSnapshot} (from a PoB export or pobb.in link) into the
 * build planner's stored JSON shape - a fresh single-mode plan carrying the build's
 * class/ascendancy, its passive-tree allocation, its gem groups and its equipment.
 *
 * The mapping is exact where the snapshot already carries GGPK identifiers (passive
 * node ids, gem ids, base-type and rune names) and best-effort where it carries only
 * PoB's rendered mod text: an item's author modifiers are reverse-matched against the
 * GGPK affix catalogue ({@see AffixMatcher} over {@see ModCatalogue}) and any line
 * that doesn't resolve to a known affix with an in-range roll is dropped, so the
 * produced plan is always valid (it passes the same {@see PlanSchema}/{@see ModCatalogue}
 * rules the editor enforces). Uniques carry their own mods in-game, so their author-mod
 * lines are matched against the synced unique catalogue instead ({@see UniqueModMatcher}).
 *
 * The result is pre-canonical: the caller runs it through {@see PlanSchema::canonicalize}
 * before storing, which drops empty items/slots and normalises everything else.
 */
final class PobPlanMapper
{
    /**
     * PoB's equipment slot names mapped to the planner's slot keys. Weapon-swap slots,
     * the third ring and any flask/charm beyond the planner's paper-doll are dropped
     * (they have no home in the fixed slot set).
     *
     * @var array<string, string>
     */
    private const array SLOT_MAP = [
        'Weapon 1' => 'weapon1',
        'Weapon 2' => 'weapon2',
        'Helmet' => 'helmet',
        'Body Armour' => 'body',
        'Gloves' => 'gloves',
        'Boots' => 'boots',
        'Amulet' => 'amulet',
        'Ring 1' => 'ring1',
        'Ring 2' => 'ring2',
        'Belt' => 'belt',
        'Flask 1' => 'flask1',
        'Flask 2' => 'flask2',
        'Charm 1' => 'charm1',
        'Charm 2' => 'charm2',
        'Charm 3' => 'charm3',
    ];

    /** Most prefixes/most suffixes an imported item keeps, per rarity. */
    private const array MODS_PER_TYPE = ['normal' => 0, 'magic' => 1, 'rare' => 3];

    /**
     * Planner slots whose items take catalysts. Catalyst quality inflates a rendered
     * roll and PoB exports no quality line for jewellery, so on these slots an
     * out-of-range value may be the quality-inflated render of a real top-tier roll
     * (see {@see AffixMatcher}).
     */
    private const array CATALYST_SLOTS = ['ring1', 'ring2', 'amulet', 'belt'];

    /**
     * @var array<string, string>|null "class|ascendancy" (both lowercased) => the tree's
     *                                 ascendancy id, built once from the tree data.
     */
    private ?array $ascendancyIndex = null;

    /**
     * Author-mod lines the last {@see map} could not reverse-match to a GGPK affix, kept
     * per planner slot so the caller can tell the author what the import left off (a
     * hybrid it can't split, quality-inflated defences, unknown wording).
     *
     * @var array<string, list<string>>
     */
    private array $droppedMods = [];

    private readonly AffixMatcher $affixMatcher;

    private readonly UniqueModMatcher $uniqueMatcher;

    public function __construct(
        private readonly IconResolver $icons,
        ModCatalogue $mods,
    ) {
        $this->affixMatcher = new AffixMatcher($mods);
        $this->uniqueMatcher = new UniqueModMatcher($icons);
    }

    /**
     * The pre-canonical plan data for an imported build: single mode, one section set
     * holding the tree, gems and equipment.
     *
     * @return array<string, mixed>
     */
    public function map(BuildSnapshot $snapshot): array
    {
        $this->droppedMods = [];

        return [
            'description' => 'Imported from Path of Building.',
            'mode' => 'single',
            'build' => [
                // The class is identified by name (PoB's numeric classId is not stable
                // across versions); the ascendancy is resolved to the live tree id the
                // planner stores.
                'className' => $snapshot->class->value,
                'ascendId' => $this->ascendId($snapshot),
            ],
            'tabs' => PlanSchema::initialTabs(),
            'sections' => [
                PlanSchema::SINGLE_KEY => [
                    'tree' => ['allocation' => $this->allocation($snapshot)],
                    'gems' => ['groups' => $this->gemGroups($snapshot)],
                    'items' => ['slots' => $this->slots($snapshot)],
                ],
            ],
        ];
    }

    /**
     * The author-mod lines the last {@see map} dropped, keyed by planner slot, in the
     * order they appeared on the item. Empty when everything mapped. Read after map().
     *
     * @return array<string, list<string>>
     */
    public function droppedMods(): array
    {
        return $this->droppedMods;
    }

    /**
     * A concise default title from the build's identity: its ascendancy (or class) and
     * level, e.g. "Blood Mage · Level 80".
     */
    public function title(BuildSnapshot $snapshot): string
    {
        $identity = $snapshot->ascendancy !== null
            ? $snapshot->ascendancy->value
            : $snapshot->class->value;

        return Str::limit("{$identity} · Level {$snapshot->level}", 120, '');
    }

    /**
     * The snapshot's passive allocation in the planner's shape: allocated node ids, the
     * per-node attribute choices (inverted from the snapshot's per-attribute lists),
     * weapon-set tags, socketed jewels and the tree version.
     *
     * @return array{allocated: list<int>, attributeChoices: array<int, string>, weaponSets: array<int, int>, jewels: array<int, mixed>, treeVersion: string}
     */
    private function allocation(BuildSnapshot $snapshot): array
    {
        $attributeChoices = [];

        foreach ($snapshot->attributeNodes as $attribute => $nodeIds) {
            foreach ($nodeIds as $nodeId) {
                $attributeChoices[$nodeId] = $attribute;
            }
        }

        return [
            'allocated' => $snapshot->passiveNodes,
            'attributeChoices' => $attributeChoices,
            'weaponSets' => $snapshot->weaponSets,
            'jewels' => $snapshot->jewels,
            'treeVersion' => $snapshot->treeVersion,
        ];
    }

    /**
     * The build's skill groups as the planner's visual gem groups: each group's gems in
     * source order (the active skill first, then its supports), keeping only gems whose
     * id resolves to a known GGPK gem.
     *
     * @return list<array{id: string, gems: list<array{type: string, id: string}>}>
     */
    private function gemGroups(BuildSnapshot $snapshot): array
    {
        $groups = [];

        foreach ($snapshot->skillGroups as $index => $group) {
            $gems = [];

            foreach ($group->gems as $gem) {
                if ($gem->gemId !== null && $this->icons->resolveReference('gem', $gem->gemId) !== null) {
                    $gems[] = ['type' => 'gem', 'id' => $gem->gemId];
                }
            }

            if ($gems !== []) {
                $groups[] = ['id' => 'g-'.($index + 1), 'gems' => $gems];
            }
        }

        return $groups;
    }

    /**
     * The build's equipped items as the planner's slot map: known slots only, each
     * turned into a planner item (base/unique reference, requirements, matched author
     * modifiers and rune sockets).
     *
     * @return array<string, array<string, mixed>>
     */
    private function slots(BuildSnapshot $snapshot): array
    {
        $slots = [];

        foreach ($snapshot->items as $item) {
            $slotKey = self::SLOT_MAP[$item->slot] ?? null;

            if ($slotKey === null) {
                continue;
            }

            $slots[$slotKey] = $this->item($item, $slotKey);
        }

        return $slots;
    }

    /**
     * One equipped item in the planner's shape. A unique carries its own modifiers in
     * game, so its author-mod lines are left off; a base/magic/rare item keeps the
     * reverse-matched affixes that resolve. The item's own rolled name (e.g. "Rift
     * Pelt" on a "Slipstrike Vest") and defensive properties (quality, armour, evasion,
     * energy shield, block) come across for every rarity.
     *
     * @return array{rarity: string, base: array{type: string, id: string}|null, name: string, corrupted: bool, props: array{quality: int, armour: int, evasion: int, energyShield: int, block: int}, stats: list<array{modId: string, values: list<int|float>}>, uniqueMods: list<array{key: string, values: list<float>}>, sockets: list<array{type: string, id: string}>}
     */
    private function item(EquippedItem $item, string $slotKey): array
    {
        $rarity = $this->rarity($item->rarity);
        $isUnique = $rarity === 'unique';
        $base = $this->baseReference($item, $isUnique);

        return [
            'rarity' => $rarity,
            'base' => $base,
            // A unique's own name equals the reference it resolves through (the game's
            // canonical unique name), so it never duplicates as a redundant subtitle;
            // canonicalize() trims/caps this before storage.
            'name' => $item->name,
            'corrupted' => $item->corrupted,
            // The item's computed defensive properties as the game shows them; block is
            // only present on shields. Carried for every rarity - for a unique these are
            // the only way to record its defences (the planner holds no base defence data).
            'props' => [
                'quality' => $item->quality ?? 0,
                'armour' => $item->armour ?? 0,
                'evasion' => $item->evasion ?? 0,
                'energyShield' => $item->energyShield ?? 0,
                'block' => $item->block ?? 0,
            ],
            'stats' => $isUnique ? [] : $this->matchMods($item, $rarity, $slotKey),
            'uniqueMods' => $isUnique ? $this->matchUniqueMods($item, $slotKey) : [],
            'sockets' => $this->sockets($item),
        ];
    }

    /**
     * The item's base/unique reference: a unique points at the unique by name, everything
     * else at its base type. Null when neither is a known GGPK item (a defunct or
     * mis-parsed name), which drops the reference but keeps any mods/runes the item has.
     *
     * @return array{type: string, id: string}|null
     */
    private function baseReference(EquippedItem $item, bool $isUnique): ?array
    {
        if ($isUnique && $this->icons->isUnique($item->name) === true) {
            return ['type' => 'unique', 'id' => $item->name];
        }

        if ($this->icons->isBaseType($item->baseType)) {
            return ['type' => 'base', 'id' => $item->baseType];
        }

        return null;
    }

    /**
     * Reverse-match a unique's rendered mod lines to its synced catalogue lines via
     * {@see UniqueModMatcher}, recording anything unmatched as dropped for the slot.
     *
     * @return list<array{key: string, values: list<float>}>
     */
    private function matchUniqueMods(EquippedItem $item, string $slotKey): array
    {
        $result = $this->uniqueMatcher->match($item->name, $item->mods);

        $this->recordDropped($slotKey, $result['unmatched']);

        return $result['matched'];
    }

    /**
     * Reverse-match an item's rendered author-mod lines to GGPK affix ids via
     * {@see AffixMatcher}, feeding it the base's domain/tags/class, the rarity's
     * prefix/suffix cap and whether the slot takes catalysts. Lines that don't resolve
     * are recorded as dropped for the slot and left off.
     *
     * @return list<array{modId: string, values: list<int|float>}>
     */
    private function matchMods(EquippedItem $item, string $rarity, string $slotKey): array
    {
        $result = $this->affixMatcher->match(
            $item->explicitMods(),
            $this->icons->itemModDomain($item->baseType),
            $this->icons->itemTags($item->baseType),
            $this->icons->itemClass($item->baseType),
            self::MODS_PER_TYPE[$rarity] ?? 0,
            in_array($slotKey, self::CATALYST_SLOTS, true),
        );

        $this->recordDropped($slotKey, $result['dropped']);

        return $result['stats'];
    }

    /**
     * Record author-mod lines the reverse-match left off, appended to the slot's running
     * list so {@see droppedMods} can report them after the map.
     *
     * @param  list<string>  $lines
     */
    private function recordDropped(string $slotKey, array $lines): void
    {
        if ($lines === []) {
            return;
        }

        $this->droppedMods[$slotKey] = [...($this->droppedMods[$slotKey] ?? []), ...$lines];
    }

    /**
     * The item's socketed runes as planner rune references, keeping only runes that
     * resolve to a known GGPK rune. Trailing empties are trimmed by canonicalisation.
     *
     * @return list<array{type: string, id: string}>
     */
    private function sockets(EquippedItem $item): array
    {
        $sockets = [];

        foreach ($item->runes as $rune) {
            $name = $rune['name'];

            if ($this->icons->resolveReference('rune', $name) !== null) {
                $sockets[] = ['type' => 'rune', 'id' => $name];
            }
        }

        return $sockets;
    }

    /**
     * Resolve the ascendancy the planner stores (the live tree's ascendancy id, e.g.
     * "Witch2"), matching the snapshot's ascendancy display name within its class. Null
     * when the build has not ascended or the name is unknown to the tree.
     */
    private function ascendId(BuildSnapshot $snapshot): ?string
    {
        if ($snapshot->ascendancy === null) {
            return null;
        }

        return $this->ascendancyIndex()[$this->key($snapshot->class->value, $snapshot->ascendancy->value)] ?? null;
    }

    /**
     * Class name + ascendancy name (both lowercased) => the tree's ascendancy id, built
     * once from the passive-tree class list the renderer draws from.
     *
     * @return array<string, string>
     */
    private function ascendancyIndex(): array
    {
        if ($this->ascendancyIndex !== null) {
            return $this->ascendancyIndex;
        }

        $index = [];
        $disk = Storage::disk('game-data');

        if ($disk->exists('public/tree/current/data.json')) {
            $data = json_decode((string) $disk->get('public/tree/current/data.json'), true);

            foreach ((is_array($data) ? $data['classes'] ?? [] : []) as $class) {
                $className = (string) ($class['name'] ?? '');

                foreach (is_array($class['ascendancies'] ?? null) ? $class['ascendancies'] : [] as $ascendancy) {
                    $id = $ascendancy['id'] ?? null;
                    $name = $ascendancy['name'] ?? null;

                    if (is_string($id) && is_string($name) && $name !== '') {
                        $index[$this->key($className, $name)] = $id;
                    }
                }
            }
        }

        return $this->ascendancyIndex = $index;
    }

    private function key(string $className, string $ascendancyName): string
    {
        return mb_strtolower($className).'|'.mb_strtolower($ascendancyName);
    }

    /**
     * Map PoB's uppercase rarity to the planner's, defaulting to rare for anything
     * unexpected (relics and the like keep author mods).
     */
    private function rarity(string $rarity): string
    {
        return match (mb_strtolower($rarity)) {
            'normal' => 'normal',
            'magic' => 'magic',
            'unique' => 'unique',
            default => 'rare',
        };
    }
}
