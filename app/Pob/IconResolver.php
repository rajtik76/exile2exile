<?php

declare(strict_types=1);

namespace App\Pob;

use App\Pob\Uniques\PobUniqueStore;
use App\Pob\Uniques\UniqueModLine;
use Closure;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Resolves canonical build identifiers (gem ids, item base types) to icon URLs.
 *
 * This is the source-agnostic seam between the build model and its art: today it
 * maps onto locally vendored PoE2 game icons, but the same {@see Gem::$icon} /
 * {@see EquippedItem::$icon} fields are filled straight from a signed `icon` URL
 * when a build arrives via the GGG OAuth API instead of a PoB export.
 */
final class IconResolver
{
    /**
     * Public web base for locally vendored icons (mirrors the Art/** tree from the GGPK).
     */
    private const string ICON_WEB_BASE = '/icons/poe2';

    /**
     * Tags already surfaced elsewhere and redundant as gameplay descriptors:
     * "Support" duplicates the "Support Gem" category line.
     *
     * @var list<string>
     */
    private const array HIDDEN_GEM_TAGS = ['Support'];

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
     * @var array<string, array{name: string, icon: ?string, color: string, type: string, description: ?string, tags: list<string>}>|null
     */
    private ?array $gemIndex = null;

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
     * @var array<string, string>|null Display name => rarity ("normal" | "unique").
     */
    private ?array $rarityIndex = null;

    /**
     * @var array<string, array{levelRequirement: ?int, effects: list<string>}>|null
     */
    private ?array $runeIndex = null;

    /**
     * @var array<string, array{stats: list<string>, ascendancy: bool, keystone: bool, icon: ?string}>|null
     *                                                                                                      Notable/keystone display name => its granted stat lines and atlas icon path.
     */
    private ?array $notableIndex = null;

    /**
     * @var array{frames: array<string, array{x: int, y: int, w: int, h: int}>, sheetW: int, sheetH: int}|null
     *                                                                                                         The skill-icon sprite atlas frame map + sheet pixel size.
     */
    private ?array $skillSprites = null;

    /**
     * @var array<string, list<string>>|null Base type display name => its mod-matching tags.
     */
    private ?array $tagIndex = null;

    /**
     * @var array<string, list<string>>|null Base type display name => rendered implicit lines.
     */
    private ?array $implicitIndex = null;

    /**
     * @var array<string, array{base: string, implicits: list<string>, mods: list<string>}>|null
     *                                                                                           Unique display name => its base type and implicit/explicit mod lines, synced from Path of Building
     *                                                                                           (see {@see PobUniqueStore}) - the one documented exception to this file's
     *                                                                                           otherwise GGPK-only sourcing, since unique mods aren't in GGG's own data files.
     */
    private ?array $pobUniqueModsIndex = null;

    /**
     * @var array<string, ?string>|null Base type display name => its GGPK mod domain
     *                                  ("Item" for gear, "Flask" for flasks/charms, null
     *                                  for uniques). Joined domain-first to the mod catalogue.
     */
    private ?array $modDomainIndex = null;

    /**
     * The derived indices below are built from multi-MB GGPK JSON. When a cache is
     * given (the container binding passes one, keyed by the data version) each index
     * is built once and reused across requests, so a reference search / resolve no
     * longer re-parses the source every time. Container-free callers (unit tests, the
     * import path) pass no cache and simply build in-process.
     */
    public function __construct(
        private readonly ?Cache $cache = null,
        private readonly string $dataVersion = 'dev',
        private readonly ?PobUniqueStore $pobUniqueStore = null,
    ) {}

    /**
     * Derived-index cache schema. Bump when an index's SHAPE changes (not its data),
     * so a deploy busts caches the old code populated even though the game data - and
     * thus the data version - is unchanged. v2: notables carry a `keystone` flag.
     */
    private const string CACHE_SCHEMA = 'v2';

    /**
     * Build a derived index once, caching it across requests (keyed by the data
     * version) when a cache is available; otherwise build in-process every call.
     *
     * @template TValue
     *
     * @param  Closure(): TValue  $build
     * @return TValue
     */
    private function remembered(string $key, Closure $build): mixed
    {
        if ($this->cache === null) {
            return $build();
        }

        return $this->cache->rememberForever("icons.{$key}:{$this->dataVersion}:".self::CACHE_SCHEMA, $build);
    }

    /**
     * Web path to a gem's icon, or null when the gem is unknown or its art is missing.
     */
    public function gemIcon(?string $gemId): ?string
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        $entry = $this->gems()[$gemId] ?? null;

        return $entry === null ? null : $this->webPathIfPresent($entry['icon']);
    }

    /**
     * Gem socket colour as a single letter: b (int), g (dex), r (str), w (white).
     */
    public function gemColor(?string $gemId): ?string
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        return $this->gems()[$gemId]['color'] ?? null;
    }

    /**
     * Human label for a gem's kind: "Skill Gem", "Support Gem" or "Spirit Gem".
     */
    public function gemCategory(?string $gemId): ?string
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        return match ($this->gems()[$gemId]['type'] ?? null) {
            'support' => 'Support Gem',
            'spirit' => 'Spirit Gem',
            'active' => 'Skill Gem',
            default => null,
        };
    }

    /**
     * Readable gem description. The GGPK mapping carries text for every gem kind
     * (active/spirit from the skill description, support from its support text).
     */
    public function gemDescription(?string $gemId): ?string
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        $text = $this->gems()[$gemId]['description'] ?? null;

        return is_string($text) && $text !== '' ? $this->stripBbcode($text) : null;
    }

    /**
     * Gem tags (e.g. attack, projectile, melee), in reference-data order.
     *
     * @return list<string>
     */
    public function gemTags(?string $gemId): array
    {
        if ($gemId === null || $gemId === '') {
            return [];
        }

        return $this->gems()[$gemId]['tags'] ?? [];
    }

    /**
     * Strip PoE bbcode markup from descriptive text: "[Curse]" -> "Curse",
     * "[Charges|Power Charges]" -> "Power Charges" (the display half after the pipe).
     */
    private function stripBbcode(string $text): string
    {
        return (string) preg_replace_callback(
            '/\[([^\]]+)\]/',
            static function (array $m): string {
                $inner = $m[1];
                $pipe = strrpos($inner, '|');

                return $pipe === false ? $inner : substr($inner, $pipe + 1);
            },
            $text,
        );
    }

    /**
     * Web path to an equipment base type's icon, or null when the base type is
     * unknown or its art is missing from the locally vendored Art/** tree.
     */
    public function itemIcon(?string $baseType): ?string
    {
        if ($baseType === null || $baseType === '') {
            return null;
        }

        return $this->webPathIfPresent($this->items()[$baseType] ?? null);
    }

    /**
     * Build the gem index from the GGPK-derived mapping (already keyed by the
     * gem id's last path segment, matching {@see PobImport::normalizeGemId}).
     *
     * @return array<string, array{name: string, icon: ?string, color: string, type: string, description: ?string, tags: list<string>}>
     */
    private function gems(): array
    {
        return $this->gemIndex ??= $this->remembered('gems', function (): array {
            $index = [];

            foreach ($this->load('ggpk/gems.json') as $segment => $value) {
                $index[(string) $segment] = [
                    'name' => (string) ($value['name'] ?? ''),
                    'icon' => $this->ddsToPng($value['icon'] ?? null),
                    'color' => (string) ($value['color'] ?? 'w'),
                    'type' => (string) ($value['kind'] ?? 'active'),
                    'description' => $value['description'] ?? null,
                    'tags' => array_values(array_filter(
                        (array) ($value['tags'] ?? []),
                        fn (mixed $tag): bool => is_string($tag) && ! in_array($tag, self::HIDDEN_GEM_TAGS, true),
                    )),
                ];
            }

            return $index;
        });
    }

    /**
     * Whether a gem of the given GGPK kind ('active', 'support', 'spirit') belongs in
     * the requested picker slot: a group's first slot is a skill (active or spirit),
     * every later slot is a support - so the two never mix.
     */
    private function gemMatchesKind(string $type, string $gemKind): bool
    {
        return $gemKind === 'support'
            ? $type === 'support'
            : $type !== 'support';
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
     * Granted stats for a rune (level requirement + effect lines), or null if unknown.
     *
     * @return array{levelRequirement: ?int, effects: list<string>}|null
     */
    public function runeData(?string $name): ?array
    {
        if ($name === null || $name === '') {
            return null;
        }

        return $this->runes()[$name] ?? null;
    }

    /**
     * Icon for a rune (soul core). Runes carry no art of their own - the icon lives
     * on the matching SoulCore base type in the item table, keyed by the same name.
     */
    public function runeIcon(?string $name): ?string
    {
        return $this->itemIcon($name);
    }

    /**
     * Search the gem, rune and unique-item catalogues by name for the reference
     * picker. Returns a flat, ranked list (prefix matches first, then shorter names)
     * of at most $limit entries.
     *
     * @param  list<string>  $types  any of 'gem', 'rune', 'unique'
     * @param  list<string>  $categories  restrict uniques to these base categories (e.g. equipment slots); empty = any
     * @param  ?string  $gemKind  restrict gems to a picker slot: 'skill' (active/spirit) or 'support'; null = any
     * @return list<array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, baseType?: ?string, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}>
     */
    public function searchReferences(string $query, array $types, array $categories = [], ?string $gemKind = null, int $limit = 20): array
    {
        $terms = TextSearch::terms($query);

        if ($terms === []) {
            return [];
        }

        $matches = [];

        if (in_array('gem', $types, true)) {
            foreach ($this->gems() as $id => $entry) {
                if ($gemKind !== null && ! $this->gemMatchesKind($entry['type'], $gemKind)) {
                    continue;
                }

                if (TextSearch::matches($entry['name'], $terms)) {
                    $matches[] = $this->gemReference((string) $id, $entry);
                }
            }
        }

        if (in_array('rune', $types, true)) {
            foreach ($this->runes() as $name => $data) {
                if (TextSearch::matches((string) $name, $terms)) {
                    $matches[] = $this->runeReference((string) $name, $data);
                }
            }
        }

        if (in_array('unique', $types, true)) {
            $this->items();

            foreach (array_keys($this->rarityIndex ?? []) as $name) {
                $name = (string) $name;

                if ($this->rarityIndex[$name] !== 'unique' || ! TextSearch::matches($name, $terms)) {
                    continue;
                }

                // Restrict to the slot's base categories (Bow, Helmet, …) when given.
                if ($categories !== [] && ! in_array($this->categoryIndex[$name] ?? null, $categories, true)) {
                    continue;
                }

                $matches[] = $this->uniqueReference($name);
            }
        }

        if (in_array('notable', $types, true)) {
            foreach ($this->notables() as $name => $data) {
                if (TextSearch::matches((string) $name, $terms)) {
                    $matches[] = $this->notableReference((string) $name, $data);
                }
            }
        }

        if (in_array('base', $types, true)) {
            $this->items();

            foreach (array_keys($this->rarityIndex ?? []) as $name) {
                $name = (string) $name;

                if ($this->rarityIndex[$name] !== 'normal' || ! TextSearch::matches($name, $terms)) {
                    continue;
                }

                if ($categories !== [] && ! in_array($this->categoryIndex[$name] ?? null, $categories, true)) {
                    continue;
                }

                $matches[] = $this->baseReference($name);
            }
        }

        $first = $terms[0];
        usort($matches, function (array $a, array $b) use ($first): int {
            $aStarts = str_starts_with(mb_strtolower($a['name']), $first) ? 0 : 1;
            $bStarts = str_starts_with(mb_strtolower($b['name']), $first) ? 0 : 1;

            return [$aStarts, mb_strlen($a['name']), $a['name']]
                <=> [$bStarts, mb_strlen($b['name']), $b['name']];
        });

        return array_slice($matches, 0, max(1, $limit));
    }

    /**
     * Resolve a single reference token (type + id) to its display data, or null when
     * the id is unknown or the type is unsupported.
     *
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, baseType?: ?string, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}|null
     */
    public function resolveReference(string $type, string $id): ?array
    {
        return match ($type) {
            'gem' => ($entry = $this->gems()[$id] ?? null) !== null
                ? $this->gemReference($id, $entry)
                : null,
            'rune' => ($data = $this->runes()[$id] ?? null) !== null
                ? $this->runeReference($id, $data)
                : null,
            'notable' => ($node = $this->notables()[$id] ?? null) !== null
                ? $this->notableReference($id, $node)
                : null,
            'unique' => $this->isUnique($id) === true
                ? $this->uniqueReference($id)
                : null,
            'base' => $this->isBaseType($id)
                ? $this->baseReference($id)
                : null,
            default => null,
        };
    }

    /**
     * A base type's mod-matching tags (the `Tags.Id` vocabulary the mod catalogue joins
     * on), or an empty list when unknown. Uniques carry none (their base type is unknown).
     *
     * @return list<string>
     */
    public function itemTags(?string $baseType): array
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
    public function itemModDomain(?string $baseType): ?string
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
    public function itemImplicits(?string $baseType): array
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
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, baseType?: ?string, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}
     */
    private function baseReference(string $name): array
    {
        $this->items();

        return [
            'type' => 'base',
            'id' => $name,
            'name' => $name,
            'icon' => $this->itemIcon($name),
            'category' => $this->categoryIndex[$name] ?? null,
            'color' => null,
            'tags' => [],
            'tooltip' => null,
            'flavour' => null,
            'twoHanded' => $this->isTwoHanded($name),
            // A base's own fixed implicit lines (read-only), rendered from GGPK.
            'implicits' => $this->itemImplicits($name),
            'sprite' => null,
        ];
    }

    /**
     * @param  array{name: string, icon: ?string, color: string, type: string, description: ?string, tags: list<string>}  $entry
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, baseType?: ?string, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}
     */
    private function gemReference(string $id, array $entry): array
    {
        return [
            'type' => 'gem',
            'id' => $id,
            'name' => $entry['name'],
            'icon' => $this->gemIcon($id),
            'category' => $this->gemCategory($id),
            // Socket colour letter (b/g/r/w) - tints the chip and its tooltip.
            'color' => $entry['color'],
            'tags' => $this->gemTags($id),
            'tooltip' => $this->gemDescription($id),
            'flavour' => null,
            'twoHanded' => false,
            'implicits' => [],
            'sprite' => null,
        ];
    }

    /**
     * @param  array{levelRequirement: ?int, effects: list<string>}  $data
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, baseType?: ?string, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}
     */
    private function runeReference(string $name, array $data): array
    {
        $effects = implode("\n", array_filter($data['effects'], is_string(...)));

        return [
            'type' => 'rune',
            'id' => $name,
            'name' => $name,
            'icon' => $this->runeIcon($name),
            // GGPK files both under the one "SoulCore" item class; the name is the only
            // signal that splits soul cores from plain runes, so label from it.
            'category' => str_contains($name, 'Soul Core') ? 'Soul Core' : 'Rune',
            'color' => null,
            'tags' => [],
            'tooltip' => $effects !== '' ? $effects : null,
            'flavour' => null,
            'twoHanded' => false,
            'implicits' => [],
            'sprite' => null,
        ];
    }

    /**
     * @param  array{stats: list<string>, ascendancy: bool, keystone: bool, icon: ?string}  $node
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, baseType?: ?string, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}
     */
    private function notableReference(string $name, array $node): array
    {
        $stats = implode("\n", array_filter($node['stats'], is_string(...)));

        return [
            'type' => 'notable',
            'id' => $name,
            'name' => $name,
            // Notable/keystone art has no single-file PNG - it is cropped from the tree
            // sprite atlas instead (see the `sprite` rect below), so flat `icon` is null.
            'icon' => null,
            'category' => match (true) {
                $node['ascendancy'] => 'Ascendancy Notable',
                $node['keystone'] => 'Keystone',
                default => 'Notable Passive',
            },
            'color' => null,
            'tags' => [],
            'tooltip' => $stats !== '' ? $stats : null,
            'flavour' => null,
            'twoHanded' => false,
            'implicits' => [],
            'sprite' => $this->notableSprite($node['icon'], $node['keystone']),
        ];
    }

    /**
     * The sprite-atlas rect for a notable's icon: its frame within the shared skill
     * atlas plus the sheet size, so a chip can crop it with CSS. Null when the icon is
     * unknown or absent from the atlas.
     *
     * @return array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null
     */
    private function notableSprite(?string $icon, bool $keystone = false): ?array
    {
        if ($icon === null) {
            return null;
        }

        $atlas = $this->skillSprites();
        // Notables render from the "notableActive" atlas state, keystones from
        // "keystoneActive"; fall back to the other state if the expected one lacks the
        // icon, both keyed by the node's Art path.
        $frame = $keystone
            ? ($atlas['frames']['keystoneActive:'.$icon] ?? $atlas['frames']['notableActive:'.$icon] ?? null)
            : ($atlas['frames']['notableActive:'.$icon] ?? $atlas['frames']['keystoneActive:'.$icon] ?? null);

        if ($frame === null || $atlas['sheetW'] === 0) {
            return null;
        }

        return [
            'url' => '/tree/current/assets/skills.webp',
            'x' => $frame['x'],
            'y' => $frame['y'],
            'w' => $frame['w'],
            'h' => $frame['h'],
            'sheetW' => $atlas['sheetW'],
            'sheetH' => $atlas['sheetH'],
        ];
    }

    /**
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>}>, baseType?: ?string, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}
     */
    private function uniqueReference(string $name): array
    {
        $this->items();
        $category = $this->categoryIndex[$name] ?? null;
        // Not in .dat at all - the game composes a unique's rolls at runtime, so this is
        // the one field on this reference sourced from Path of Building, not GGPK (see
        // pobUniqueMods()). Absent (no sync yet, or an unmatched name) just means no mods
        // show yet; the reference itself (icon, category, flavour) still resolves from GGPK.
        $mods = $this->pobUniqueMods()[$name] ?? null;
        $lines = $this->uniqueModLines($name);

        return [
            'type' => 'unique',
            'id' => $name,
            'name' => $name,
            'icon' => $this->itemIcon($name),
            'category' => $category !== null ? 'Unique '.$category : 'Unique',
            'color' => null,
            'tags' => [],
            'tooltip' => $mods !== null && $mods['mods'] !== [] ? implode("\n", $mods['mods']) : null,
            'flavour' => $this->flavourIndex[$name] ?? null,
            'twoHanded' => $this->isTwoHanded($name),
            'implicits' => $mods['implicits'] ?? [],
            // Structured (key/rolls) form of the same mods, for the equipped-item editor to
            // render inputs and substitute a stored rolled value into.
            'modLines' => array_map(self::uniqueModLineArray(...), $lines['mods']),
            'implicitLines' => array_map(self::uniqueModLineArray(...), $lines['implicits']),
            // The unique's underlying base item (e.g. "Viper Cap" for Constricting
            // Command) - synced from Path of Building alongside its mods, since .dat
            // carries no unique-to-base-type link either. Shown under the item's name
            // in the tooltip, same as the game's own unique tooltip does. Absent when
            // unsynced, same as the mods themselves.
            'baseType' => $mods['base'] ?? null,
            'sprite' => null,
        ];
    }

    /**
     * @return array{key: string, template: string, rolls: list<array{min: float, max: float}>}
     */
    private static function uniqueModLineArray(UniqueModLine $line): array
    {
        return ['key' => $line->key, 'template' => $line->template, 'rolls' => $line->rolls];
    }

    /**
     * The structured (key/rolls) form of a unique's synced mods, for callers that only need
     * the parsed lines - the plan mapper's import-value matching, the plan request's range
     * validation - without the rest of {@see uniqueReference()}'s payload.
     *
     * @return array{implicits: list<UniqueModLine>, mods: list<UniqueModLine>}
     */
    public function uniqueModLines(string $name): array
    {
        $mods = $this->pobUniqueMods()[$name] ?? null;

        if ($mods === null) {
            return ['implicits' => [], 'mods' => []];
        }

        return [
            'implicits' => array_map(UniqueModLine::parse(...), $mods['implicits']),
            'mods' => array_map(UniqueModLine::parse(...), $mods['mods']),
        ];
    }

    /**
     * The rune catalogue keyed by display name (GGPK soul-core stats).
     *
     * @return array<string, array{levelRequirement: ?int, effects: list<string>}>
     */
    private function runes(): array
    {
        return $this->runeIndex ??= $this->remembered('runes', function (): array {
            /** @var array<string, array{levelRequirement: ?int, effects: list<string>}> $decoded */
            $decoded = $this->load('ggpk/runes.json');

            return $decoded;
        });
    }

    /**
     * Unique display name => its mod lines, split into implicit/explicit by the synced
     * `implicitCount`. Read straight from {@see PobUniqueStore} rather than through
     * {@see remembered()}: that cache is keyed by the GGPK data version, but the PoB sync
     * moves on its own daily cadence unrelated to a GGPK patch, so caching this against
     * the data version would keep serving yesterday's mods until the next deploy. The
     * store's own JSON read is cheap enough to just do once per request/instance.
     *
     * @return array<string, array{base: string, implicits: list<string>, mods: list<string>}>
     */
    private function pobUniqueMods(): array
    {
        if ($this->pobUniqueModsIndex !== null) {
            return $this->pobUniqueModsIndex;
        }

        $snapshot = $this->pobUniqueStore?->read();

        if ($snapshot === null) {
            return $this->pobUniqueModsIndex = [];
        }

        $index = [];

        foreach ($snapshot['uniques'] as $name => $unique) {
            $index[$name] = [
                'base' => $unique['base'],
                'implicits' => array_slice($unique['mods'], 0, $unique['implicitCount']),
                'mods' => array_slice($unique['mods'], $unique['implicitCount']),
            ];
        }

        return $this->pobUniqueModsIndex = $index;
    }

    /**
     * Notable passives keyed by display name, built from the GGPK-derived passive
     * tree ({@see public/tree/current/data.json}) the renderer draws from. Only the
     * notable nodes are kept, mapped to their granted stat lines; ascendancy notables
     * are flagged so the reference can label them apart from base-tree notables.
     *
     * @return array<string, array{stats: list<string>, ascendancy: bool, keystone: bool, icon: ?string}>
     */
    private function notables(): array
    {
        return $this->notableIndex ??= $this->remembered('notables', function (): array {
            $index = [];
            $data = $this->loadJson('public/tree/current/data.json');

            foreach ($data['nodes'] ?? [] as $node) {
                // Notables and keystones are both cite-worthy "big" nodes; plain
                // passives (no name/effect worth a chip) are skipped.
                if (! is_array($node) || (empty($node['isNotable']) && empty($node['isKeystone']))) {
                    continue;
                }

                $name = (string) ($node['name'] ?? '');

                if ($name === '') {
                    continue;
                }

                $icon = $node['icon'] ?? null;

                $index[$name] = [
                    'stats' => is_array($node['stats'] ?? null)
                        ? array_values(array_filter($node['stats'], is_string(...)))
                        : [],
                    'ascendancy' => isset($node['ascendancyId']),
                    'keystone' => ! empty($node['isKeystone']),
                    'icon' => is_string($icon) && $icon !== '' ? $icon : null,
                ];
            }

            return $index;
        });
    }

    /**
     * The passive-tree skill-icon sprite atlas: each frame's pixel rect keyed by its
     * `<state>:<Art path>` id, plus the sheet's own pixel size (parsed from the WebP
     * header). Notable art has no single-file PNG - it is cropped from this atlas the
     * renderer already ships, so a notable reference can point a chip at its rect.
     *
     * @return array{frames: array<string, array{x: int, y: int, w: int, h: int}>, sheetW: int, sheetH: int}
     */
    private function skillSprites(): array
    {
        return $this->skillSprites ??= $this->remembered('skillSprites', function (): array {
            $frames = [];
            $sprites = $this->loadJson('public/tree/current/assets/skills.json');

            foreach ($sprites['frames'] ?? [] as $key => $entry) {
                $frame = is_array($entry) ? ($entry['frame'] ?? null) : null;

                if (is_string($key) && is_array($frame)) {
                    $frames[$key] = [
                        'x' => (int) ($frame['x'] ?? 0),
                        'y' => (int) ($frame['y'] ?? 0),
                        'w' => (int) ($frame['w'] ?? 0),
                        'h' => (int) ($frame['h'] ?? 0),
                    ];
                }
            }

            // The sheet's pixel size is carried in the frame map by publish.mjs, so no
            // binary atlas is read server-side (the JSON-only extraction ships no webp).
            $sheet = is_array($sprites['sheet'] ?? null) ? $sprites['sheet'] : [];

            return [
                'frames' => $frames,
                'sheetW' => (int) ($sheet['w'] ?? 0),
                'sheetH' => (int) ($sheet['h'] ?? 0),
            ];
        });
    }

    /**
     * Base attribute requirements (str/dex/int) for a base type, or null if unknown.
     *
     * @return array{str: int, dex: int, int: int}|null
     */
    public function itemRequirements(?string $baseType): ?array
    {
        if ($baseType === null || $baseType === '') {
            return null;
        }

        $this->items();

        return $this->reqIndex[$baseType] ?? null;
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

        $built = $this->remembered('items', fn (): array => $this->buildItems());

        $this->twoHandedIndex = $built['twoHanded'];
        $this->classIndex = $built['class'];
        $this->categoryIndex = $built['category'];
        $this->flavourIndex = $built['flavour'];
        $this->reqIndex = $built['req'];
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
        $rarities = [];
        $tags = [];
        $implicits = [];
        $modDomains = [];

        foreach ($this->load('ggpk/items.json') as $name => $value) {
            $name = (string) $name;

            $index[$name] = $this->ddsToPng($value['icon'] ?? null);
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
        }

        return [
            'index' => $index,
            'twoHanded' => $twoHanded,
            'class' => $classes,
            'category' => $categories,
            'flavour' => $flavours,
            'req' => $reqs,
            'rarity' => $rarities,
            'tag' => $tags,
            'implicit' => $implicits,
            'modDomain' => $modDomains,
        ];
    }

    private function ddsToPng(mixed $dds): ?string
    {
        if (! is_string($dds) || ! str_ends_with($dds, '.dds')) {
            return is_string($dds) ? $dds : null;
        }

        return substr($dds, 0, -4).'.png';
    }

    /**
     * Map an Art/** relative path to its web path, but only if the file is vendored.
     */
    private function webPathIfPresent(?string $relative): ?string
    {
        if ($relative === null) {
            return null;
        }

        return Storage::disk('game-data')->exists('public/icons/poe2/'.$relative)
            ? self::ICON_WEB_BASE.'/'.$relative
            : null;
    }

    /**
     * @return array<array-key, array<string, mixed>>
     */
    private function load(string $file): array
    {
        return $this->loadJson('resources/poe2/'.$file);
    }

    /**
     * Decode a JSON file addressed relative to the project root (unlike {@see load},
     * which is scoped to the vendored `resources/poe2` data dir).
     *
     * @return array<array-key, mixed>
     */
    private function loadJson(string $relative): array
    {
        $disk = Storage::disk('game-data');

        if (! $disk->exists($relative)) {
            return [];
        }

        $decoded = json_decode((string) $disk->get($relative), true);

        return is_array($decoded) ? $decoded : [];
    }
}
