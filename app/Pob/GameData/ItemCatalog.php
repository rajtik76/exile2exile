<?php

declare(strict_types=1);

namespace App\Pob\GameData;

/**
 * The item catalogue built from the GGPK-derived mapping, keyed by base type display
 * name: icons, equipment categories, mod-matching tags, implicits, requirements and
 * defensive stats for every base type and unique.
 */
final class ItemCatalog
{
    /**
     * Maps a base item's raw GGPK `itemClass` to the canonical equipment category
     * shared with uniques (which carry `category` directly). Non-equipment classes
     * (currency, quest items, gems, …) are absent, so bases of those never surface as
     * gear. This unifies the vocabulary so one slot category list matches both.
     *
     * @var array<string, string>
     */
    private const array EQUIPMENT_CLASS_CATEGORY = [
        'Body Armour' => 'Body Armour',
        'Helmet' => 'Helmet',
        'Gloves' => 'Gloves',
        'Boots' => 'Boots',
        'Amulet' => 'Amulet',
        'Ring' => 'Ring',
        'Belt' => 'Belt',
        'Talisman' => 'Talisman',
        'Shield' => 'Shield',
        'Buckler' => 'Shield',
        'Focus' => 'Focii',
        'Quiver' => 'Quiver',
        'One Hand Mace' => 'Mace',
        'Two Hand Mace' => 'Mace',
        'One Hand Axe' => 'Axe',
        'Two Hand Axe' => 'Axe',
        'One Hand Sword' => 'Sword',
        'Two Hand Sword' => 'Sword',
        'Claw' => 'Claw',
        'Dagger' => 'Dagger',
        'Flail' => 'Flail',
        'Spear' => 'Spear',
        'Bow' => 'Bow',
        'Crossbow' => 'Crossbow',
        'Staff' => 'Staff',
        'Warstaff' => 'Warstaff',
        'Sceptre' => 'Sceptre',
        'Wand' => 'Wand',
        // Life and mana flasks are separate slot categories so a life-flask slot never
        // offers a mana flask (and vice versa); they still share the "Flask" mod domain.
        'LifeFlask' => 'Life Flask',
        'ManaFlask' => 'Mana Flask',
        // Utility flasks are PoE2's charms (they take the charm slots), even though they
        // share the flask mod domain - the category is the slot grouping, not the domain.
        'UtilityFlask' => 'Charm',
        'Jewel' => 'Jewel',
    ];

    /**
     * @var array<string, ?string>|null Base type display name => icon web path (or null).
     */
    private ?array $itemIndex = null;

    /**
     * @var array<string, bool>|null Base type display name => is a two-handed weapon.
     */
    private ?array $twoHandedIndex = null;

    /**
     * @var array<string, ?string>|null Base type display name => item class (e.g. "Crossbow").
     */
    private ?array $classIndex = null;

    /**
     * @var array<string, ?string>|null Display name => base category label (e.g. "Body
     *                                  Armour"), used for unique items whose own item class is not set.
     */
    private ?array $categoryIndex = null;

    /**
     * @var array<string, ?string>|null Unique display name => flavour/lore text (lines
     *                                  joined by "\n"), or null. Only uniques carry it.
     */
    private ?array $flavourIndex = null;

    /**
     * @var array<string, array{str: int, dex: int, int: int}|null>|null
     */
    private ?array $reqIndex = null;

    /**
     * @var array<string, array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null>|null
     */
    private ?array $armourIndex = null;

    /**
     * @var array<string, array{damageMin: int, damageMax: int, critical: int, attackTime: int, rangeMax: int, reloadTime: int}|null>|null
     */
    private ?array $weaponIndex = null;

    /**
     * @var array<string, int>|null Base type display name => Spirit granted (sceptres; 0 elsewhere).
     */
    private ?array $spiritIndex = null;

    /**
     * @var array<string, string>|null Display name => rarity ("normal" | "unique").
     */
    private ?array $rarityIndex = null;

    /**
     * @var array<string, list<string>>|null Base type display name => its mod-matching tags.
     */
    private ?array $tagIndex = null;

    /**
     * @var array<string, list<string>>|null Base type display name => rendered implicit lines.
     */
    private ?array $implicitIndex = null;

    /**
     * @var array<string, ?string>|null Base type display name => its GGPK mod domain
     *                                  ("Item" for gear, "Flask" for flasks/charms, null
     *                                  for uniques). Joined domain-first to the mod catalogue.
     */
    private ?array $modDomainIndex = null;

    public function __construct(private readonly GameDataStore $store) {}

    /**
     * Every display name in the item mapping (bases and uniques alike), for callers
     * that scan the whole catalogue (the reference-picker search).
     *
     * @return list<string>
     */
    public function names(): array
    {
        return array_map(strval(...), array_keys($this->items()));
    }

    /**
     * Web path to an equipment base type's icon, or null when the base type is
     * unknown or its art is missing from the locally vendored Art/** tree.
     */
    public function icon(?string $baseType): ?string
    {
        if ($baseType === null || $baseType === '') {
            return null;
        }

        return $this->store->webPathIfPresent($this->items()[$baseType] ?? null);
    }

    /**
     * Extract a known base type from a magic item's full affixed name.
     *
     * Magic items carry no separate base-type line - the base is embedded in
     * "<prefix> <Base Type> of <suffix>" - so match the longest known base
     * type that occurs in the name.
     */
    public function matchBaseType(?string $name): ?string
    {
        if ($name === null || $name === '') {
            return null;
        }

        $best = null;

        foreach (array_keys($this->items()) as $base) {
            $base = (string) $base;

            // Only real bases can be embedded in a magic item's affixed name;
            // uniques share the same map since item-extractor 0.5.0, so skip them.
            if ($base === '' || $this->isUnique($base) === true || ! str_contains($name, $base)) {
                continue;
            }

            if ($best === null || strlen($base) > strlen($best)) {
                $best = $base;
            }
        }

        return $best;
    }

    /**
     * Whether a name is a real GGPK base type, matched exactly. Loot-filter `BaseType`
     * rules must reference only these: the game refuses to load a whole filter if any one
     * rule names a base it doesn't know (e.g. a poe2scout economy label like "Precursor
     * Tablet" that isn't an actual base), so callers gate emitted base types through here.
     */
    public function knowsBaseType(?string $name): bool
    {
        if ($name === null || $name === '') {
            return false;
        }

        return array_key_exists($name, $this->items());
    }

    /**
     * Keep only the names that are real GGPK base types, preserving order.
     *
     * @param  list<string>  $names
     * @return list<string>
     */
    public function keepKnownBaseTypes(array $names): array
    {
        return array_values(array_filter($names, $this->knowsBaseType(...)));
    }

    /**
     * Whether an equipment base type is a two-handed weapon.
     */
    public function isTwoHanded(?string $baseType): bool
    {
        if ($baseType === null || $baseType === '') {
            return false;
        }

        $this->items();

        return $this->twoHandedIndex[$baseType] ?? false;
    }

    /**
     * A base type's mod-matching tags (the `Tags.Id` vocabulary the mod catalogue joins
     * on), or an empty list when unknown. Uniques carry none (their base type is unknown).
     *
     * @return list<string>
     */
    public function tags(?string $baseType): array
    {
        if ($baseType === null || $baseType === '') {
            return [];
        }

        $this->items();

        return $this->tagIndex[$baseType] ?? [];
    }

    /**
     * A base type's GGPK mod domain ("Item" for gear, "Flask" for flasks/charms), or null
     * when unknown (a unique, whose base type - and thus domain - is unknown). The mod
     * catalogue is joined domain-first, so a base only ever sees mods of its own domain.
     */
    public function modDomain(?string $baseType): ?string
    {
        if ($baseType === null || $baseType === '') {
            return null;
        }

        $this->items();

        return $this->modDomainIndex[$baseType] ?? null;
    }

    /**
     * The mod domain shared by the normal bases in the given equipment categories (e.g.
     * "Body Armour" → "Item", "Flask" → "Flask"), or null when none match. Used as the
     * domain filter before a specific base is picked, alongside {@see categoryTags}.
     *
     * @param  list<string>  $categories
     */
    public function categoryDomain(array $categories): ?string
    {
        if ($categories === []) {
            return null;
        }

        $this->items();

        foreach ($this->modDomainIndex ?? [] as $name => $domain) {
            if ($domain !== null
                && ($this->rarityIndex[$name] ?? null) === 'normal'
                && in_array($this->categoryIndex[$name] ?? null, $categories, true)) {
                return $domain;
            }
        }

        return null;
    }

    /**
     * A base type's rendered implicit modifier lines (its own fixed mods), or an empty
     * list when it has none. Read-only - shown above the author's explicit affixes.
     *
     * @return list<string>
     */
    public function implicits(?string $baseType): array
    {
        if ($baseType === null || $baseType === '') {
            return [];
        }

        $this->items();

        return $this->implicitIndex[$baseType] ?? [];
    }

    /**
     * The union of mod-matching tags across every normal base in the given equipment
     * categories (e.g. "Body Armour" spans str/dex/int armour). Used as the looser mod
     * filter before a specific base is picked. Empty when no categories are given.
     *
     * @param  list<string>  $categories
     * @return list<string>
     */
    public function categoryTags(array $categories): array
    {
        if ($categories === []) {
            return [];
        }

        $this->items();

        $tags = [];

        foreach ($this->tagIndex ?? [] as $name => $baseTags) {
            if (($this->rarityIndex[$name] ?? null) === 'normal'
                && in_array($this->categoryIndex[$name] ?? null, $categories, true)) {
                foreach ($baseTags as $tag) {
                    $tags[$tag] = true;
                }
            }
        }

        return array_keys($tags);
    }

    /**
     * Whether the given name is a known non-unique base type (any rarity item the
     * author can build on: normal/magic/rare gear).
     */
    public function isBaseType(?string $name): bool
    {
        if ($name === null || $name === '') {
            return false;
        }

        $this->items();

        return ($this->rarityIndex[$name] ?? null) === 'normal';
    }

    /**
     * Whether a display name is a known unique item (as opposed to a normal base
     * type), or null when the name is unknown to the GGPK item mapping.
     */
    public function isUnique(?string $name): ?bool
    {
        if ($name === null || $name === '') {
            return null;
        }

        $this->items();

        $rarity = $this->rarityIndex[$name] ?? null;

        return $rarity === null ? null : $rarity === 'unique';
    }

    /**
     * Base attribute requirements (str/dex/int) for a base type, or null if unknown.
     *
     * @return array{str: int, dex: int, int: int}|null
     */
    public function requirements(?string $baseType): ?array
    {
        if ($baseType === null || $baseType === '') {
            return null;
        }

        $this->items();

        return $this->reqIndex[$baseType] ?? null;
    }

    /**
     * A base type's own defensive stats (GGPK `ArmourTypes`/`ShieldTypes`), or null when
     * the base carries no defensive row at all (weapons, jewellery, flasks, ...). A
     * present result's individual values are 0 for a defence type the base doesn't have
     * (e.g. a pure-evasion base has `armour: 0, energyShield: 0`) - distinct from the
     * whole result being null. Always null for a unique: .dat has no unique-to-base-type
     * link (same caveat as {@see requirements}), so a unique's defence can only be
     * hand-entered, not looked up.
     *
     * @return array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null
     */
    public function armour(?string $baseType): ?array
    {
        if ($baseType === null || $baseType === '') {
            return null;
        }

        $this->items();

        return $this->armourIndex[$baseType] ?? null;
    }

    /**
     * A base type's own offensive stats (GGPK `WeaponTypes`, raw units: `critical` is
     * crit chance x 100, `attackTime`/`reloadTime` in milliseconds, `rangeMax` in
     * tenths of a metre, damage is physical only - elemental damage exists solely
     * through local mods), or null when the base carries no weapon row at all
     * (armour, jewellery, and caster weapons - sceptres/wands/staves have no
     * WeaponTypes row). Always null for a unique: .dat has no unique-to-base-type
     * link (same caveat as {@see armour}), so callers resolve a unique's weapon
     * stats through its synced base type instead.
     *
     * @return array{damageMin: int, damageMax: int, critical: int, attackTime: int, rangeMax: int, reloadTime: int}|null
     */
    public function weapon(?string $baseType): ?array
    {
        if ($baseType === null || $baseType === '') {
            return null;
        }

        $this->items();

        return $this->weaponIndex[$baseType] ?? null;
    }

    /**
     * The Spirit a base type grants (GGPK `ItemSpirit`) - non-zero only on sceptres.
     */
    public function spirit(?string $baseType): int
    {
        if ($baseType === null || $baseType === '') {
            return 0;
        }

        $this->items();

        return $this->spiritIndex[$baseType] ?? 0;
    }

    /**
     * The item class of a base type (e.g. "Crossbow", "Ring"), or null if unknown.
     */
    public function itemClass(?string $baseType): ?string
    {
        if ($baseType === null || $baseType === '') {
            return null;
        }

        $this->items();

        return $this->classIndex[$baseType] ?? null;
    }

    /**
     * The canonical equipment category of a display name (base or unique), or null
     * when unknown or not equipment.
     */
    public function category(?string $name): ?string
    {
        if ($name === null || $name === '') {
            return null;
        }

        $this->items();

        return $this->categoryIndex[$name] ?? null;
    }

    /**
     * A unique's flavour/lore text (lines joined by "\n"), or null. Only uniques carry it.
     */
    public function flavour(?string $name): ?string
    {
        if ($name === null || $name === '') {
            return null;
        }

        $this->items();

        return $this->flavourIndex[$name] ?? null;
    }

    /**
     * Build the item indices from the GGPK-derived mapping (keyed by base type
     * display name).
     *
     * @return array<string, ?string> Base type display name => Art/** png path (or null).
     */
    private function items(): array
    {
        if ($this->itemIndex !== null) {
            return $this->itemIndex;
        }

        $built = $this->store->remembered('items', fn (): array => $this->buildItems());

        $this->twoHandedIndex = $built['twoHanded'];
        $this->classIndex = $built['class'];
        $this->categoryIndex = $built['category'];
        $this->flavourIndex = $built['flavour'];
        $this->reqIndex = $built['req'];
        $this->armourIndex = $built['armour'];
        $this->weaponIndex = $built['weapon'];
        $this->spiritIndex = $built['spirit'];
        $this->rarityIndex = $built['rarity'];
        $this->tagIndex = $built['tag'];
        $this->implicitIndex = $built['implicit'];
        $this->modDomainIndex = $built['modDomain'];

        return $this->itemIndex = $built['index'];
    }

    /**
     * Parse the GGPK item mapping into every derived index in one pass. Split out so
     * the whole bundle can be cached by {@see items} - the source is a 2 MB file, so
     * it must never be re-parsed per request.
     *
     * @return array{
     *     index: array<string, ?string>,
     *     twoHanded: array<string, bool>,
     *     class: array<string, ?string>,
     *     category: array<string, ?string>,
     *     flavour: array<string, ?string>,
     *     req: array<string, array{str: int, dex: int, int: int}|null>,
     *     armour: array<string, array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null>,
     *     weapon: array<string, array{damageMin: int, damageMax: int, critical: int, attackTime: int, rangeMax: int, reloadTime: int}|null>,
     *     spirit: array<string, int>,
     *     rarity: array<string, string>,
     *     tag: array<string, list<string>>,
     *     implicit: array<string, list<string>>,
     *     modDomain: array<string, ?string>,
     * }
     */
    private function buildItems(): array
    {
        $index = [];
        $twoHanded = [];
        $classes = [];
        $categories = [];
        $flavours = [];
        $reqs = [];
        $armours = [];
        $weapons = [];
        $spirits = [];
        $rarities = [];
        $tags = [];
        $implicits = [];
        $modDomains = [];

        foreach ($this->store->load('ggpk/items.json') as $name => $value) {
            $name = (string) $name;

            $index[$name] = $this->store->ddsToPng($value['icon'] ?? null);
            $twoHanded[$name] = (bool) ($value['twoHanded'] ?? false);
            $rarities[$name] = ($value['rarity'] ?? null) === 'unique' ? 'unique' : 'normal';

            $modDomain = $value['modDomain'] ?? null;
            $modDomains[$name] = is_string($modDomain) && $modDomain !== '' ? $modDomain : null;

            $tags[$name] = is_array($value['tags'] ?? null)
                ? array_values(array_filter($value['tags'], is_string(...)))
                : [];
            $implicits[$name] = is_array($value['implicits'] ?? null)
                ? array_values(array_filter($value['implicits'], is_string(...)))
                : [];

            $class = $value['itemClass'] ?? null;
            $classes[$name] = is_string($class) && $class !== '' ? $class : null;

            // Uniques carry `category` directly; bases only an `itemClass` we map to
            // the same canonical equipment category (non-gear classes map to null).
            $category = $value['category'] ?? null;

            if (! is_string($category) || $category === '') {
                $itemClass = $value['itemClass'] ?? null;
                $category = is_string($itemClass) ? (self::EQUIPMENT_CLASS_CATEGORY[$itemClass] ?? null) : null;
            }

            $categories[$name] = is_string($category) ? $category : null;

            $flavour = $value['flavourText'] ?? null;
            $lines = is_array($flavour) ? array_values(array_filter($flavour, is_string(...))) : [];
            $flavours[$name] = $lines === [] ? null : implode("\n", $lines);

            $req = $value['req'] ?? null;
            $reqs[$name] = is_array($req)
                ? [
                    'str' => (int) ($req['str'] ?? 0),
                    'dex' => (int) ($req['dex'] ?? 0),
                    'int' => (int) ($req['int'] ?? 0),
                ]
                : null;

            $armour = $value['armour'] ?? null;
            $armours[$name] = is_array($armour)
                ? [
                    'armour' => (int) ($armour['armour'] ?? 0),
                    'evasion' => (int) ($armour['evasion'] ?? 0),
                    'energyShield' => (int) ($armour['energyShield'] ?? 0),
                    'ward' => (int) ($armour['ward'] ?? 0),
                    'block' => (int) ($armour['block'] ?? 0),
                ]
                : null;

            $weapon = $value['weapon'] ?? null;
            $weapons[$name] = is_array($weapon)
                ? [
                    'damageMin' => (int) ($weapon['damageMin'] ?? 0),
                    'damageMax' => (int) ($weapon['damageMax'] ?? 0),
                    'critical' => (int) ($weapon['critical'] ?? 0),
                    'attackTime' => (int) ($weapon['attackTime'] ?? 0),
                    'rangeMax' => (int) ($weapon['rangeMax'] ?? 0),
                    'reloadTime' => (int) ($weapon['reloadTime'] ?? 0),
                ]
                : null;

            $spirit = $value['spirit'] ?? 0;
            $spirits[$name] = is_numeric($spirit) ? (int) $spirit : 0;
        }

        return [
            'index' => $index,
            'twoHanded' => $twoHanded,
            'class' => $classes,
            'category' => $categories,
            'flavour' => $flavours,
            'req' => $reqs,
            'armour' => $armours,
            'weapon' => $weapons,
            'spirit' => $spirits,
            'rarity' => $rarities,
            'tag' => $tags,
            'implicit' => $implicits,
            'modDomain' => $modDomains,
        ];
    }
}
