<?php

declare(strict_types=1);

namespace App\Pob;

use App\Pob\GameData\GameDataStore;
use App\Pob\GameData\GemCatalog;
use App\Pob\GameData\ItemCatalog;
use App\Pob\GameData\NotableCatalog;
use App\Pob\GameData\ReferenceResolver;
use App\Pob\GameData\RuneCatalog;
use App\Pob\GameData\UniqueCatalog;
use App\Pob\Uniques\PobUniqueStore;
use App\Pob\Uniques\UniqueModLine;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Resolves canonical build identifiers (gem ids, item base types) to icon URLs.
 *
 * This is the source-agnostic seam between the build model and its art: today it
 * maps onto locally vendored PoE2 game icons, but the same {@see Gem::$icon} /
 * {@see EquippedItem::$icon} fields are filled straight from a signed `icon` URL
 * when a build arrives via the GGG OAuth API instead of a PoB export.
 *
 * A facade over the per-domain catalogues in {@see GameData}: gems, items,
 * runes, uniques and notables each live in their own class, with reference
 * search/resolution composed on top by {@see ReferenceResolver}.
 *
 * @phpstan-import-type ReferenceEntry from ReferenceResolver
 */
final readonly class IconResolver
{
    private GemCatalog $gems;

    private ItemCatalog $items;

    private RuneCatalog $runes;

    private UniqueCatalog $uniques;

    private ReferenceResolver $references;

    /**
     * The derived indices are built from multi-MB GGPK JSON. When a cache is given
     * (the container binding passes one, keyed by the data version) each index is
     * built once and reused across requests. Container-free callers (unit tests, the
     * import path) pass no cache and simply build in-process.
     */
    public function __construct(
        ?Cache $cache = null,
        string $dataVersion = 'dev',
        ?PobUniqueStore $pobUniqueStore = null,
        GemRequirements $gemRequirements = new GemRequirements,
    ) {
        $store = new GameDataStore($cache, $dataVersion);

        $this->gems = new GemCatalog($store, $gemRequirements);
        $this->items = new ItemCatalog($store);
        $this->runes = new RuneCatalog($store);
        $this->uniques = new UniqueCatalog($pobUniqueStore);
        $this->references = new ReferenceResolver(
            $this->gems,
            $this->items,
            $this->runes,
            $this->uniques,
            new NotableCatalog($store),
        );
    }

    /**
     * Web path to a gem's icon, or null when the gem is unknown or its art is missing.
     */
    public function gemIcon(?string $gemId): ?string
    {
        return $this->gems->icon($gemId);
    }

    /**
     * Gem socket colour as a single letter: b (int), g (dex), r (str), w (white).
     */
    public function gemColor(?string $gemId): ?string
    {
        return $this->gems->color($gemId);
    }

    /**
     * Human label for a gem's kind: "Skill Gem", "Support Gem" or "Spirit Gem".
     */
    public function gemCategory(?string $gemId): ?string
    {
        return $this->gems->category($gemId);
    }

    /**
     * Readable gem description (see {@see GemCatalog::description}).
     */
    public function gemDescription(?string $gemId): ?string
    {
        return $this->gems->description($gemId);
    }

    /**
     * Gem tags (e.g. attack, projectile, melee), in reference-data order.
     *
     * @return list<string>
     */
    public function gemTags(?string $gemId): array
    {
        return $this->gems->tags($gemId);
    }

    /**
     * Web path to a gem's hover-art background (see {@see GemCatalog::hoverImage}).
     */
    public function gemHoverImage(?string $gemId): ?string
    {
        return $this->gems->hoverImage($gemId);
    }

    /**
     * Per-level tooltip scaling for a gem (see {@see GemCatalog::scaling}).
     *
     * @return array{name: string, levels: list<array{level: int, cost: ?int, castTime: ?float, cooldown: ?float, reservation: ?float, spellCritChance: ?float, attackCritChance: ?float, stats: list<array{text: string, min: float, max: float}>}>, qualityStats: list<array{text: string, min: float, max: float}>}|null
     */
    public function gemScaling(?string $gemId): ?array
    {
        return $this->gems->scaling($gemId);
    }

    /**
     * A gem's level/attribute requirement range (see {@see GemCatalog::requires}).
     *
     * @return array{level: array{int, int}, str: array{int, int}|null, dex: array{int, int}|null, int: array{int, int}|null}|null
     */
    public function gemRequires(?string $gemId): ?array
    {
        return $this->gems->requires($gemId);
    }

    /**
     * Web path to an equipment base type's icon, or null when the base type is
     * unknown or its art is missing from the locally vendored Art/** tree.
     */
    public function itemIcon(?string $baseType): ?string
    {
        return $this->items->icon($baseType);
    }

    /**
     * Extract a known base type from a magic item's full affixed name (see
     * {@see ItemCatalog::matchBaseType}).
     */
    public function matchBaseType(?string $name): ?string
    {
        return $this->items->matchBaseType($name);
    }

    /**
     * Whether a name is a real GGPK base type, matched exactly (see
     * {@see ItemCatalog::knowsBaseType}).
     */
    public function knowsBaseType(?string $name): bool
    {
        return $this->items->knowsBaseType($name);
    }

    /**
     * Keep only the names that are real GGPK base types, preserving order.
     *
     * @param  list<string>  $names
     * @return list<string>
     */
    public function keepKnownBaseTypes(array $names): array
    {
        return $this->items->keepKnownBaseTypes($names);
    }

    /**
     * Whether an equipment base type is a two-handed weapon.
     */
    public function isTwoHanded(?string $baseType): bool
    {
        return $this->items->isTwoHanded($baseType);
    }

    /**
     * A base type's mod-matching tags (see {@see ItemCatalog::tags}).
     *
     * @return list<string>
     */
    public function itemTags(?string $baseType): array
    {
        return $this->items->tags($baseType);
    }

    /**
     * A base type's GGPK mod domain (see {@see ItemCatalog::modDomain}).
     */
    public function itemModDomain(?string $baseType): ?string
    {
        return $this->items->modDomain($baseType);
    }

    /**
     * The mod domain shared by the normal bases in the given equipment categories
     * (see {@see ItemCatalog::categoryDomain}).
     *
     * @param  list<string>  $categories
     */
    public function categoryDomain(array $categories): ?string
    {
        return $this->items->categoryDomain($categories);
    }

    /**
     * A base type's rendered implicit modifier lines (see {@see ItemCatalog::implicits}).
     *
     * @return list<string>
     */
    public function itemImplicits(?string $baseType): array
    {
        return $this->items->implicits($baseType);
    }

    /**
     * The union of mod-matching tags across every normal base in the given equipment
     * categories (see {@see ItemCatalog::categoryTags}).
     *
     * @param  list<string>  $categories
     * @return list<string>
     */
    public function categoryTags(array $categories): array
    {
        return $this->items->categoryTags($categories);
    }

    /**
     * Whether the given name is a known non-unique base type (any rarity item the
     * author can build on: normal/magic/rare gear).
     */
    public function isBaseType(?string $name): bool
    {
        return $this->items->isBaseType($name);
    }

    /**
     * Whether a display name is a known unique item (as opposed to a normal base
     * type), or null when the name is unknown to the GGPK item mapping.
     */
    public function isUnique(?string $name): ?bool
    {
        return $this->items->isUnique($name);
    }

    /**
     * Base attribute requirements (str/dex/int) for a base type, or null if unknown.
     *
     * @return array{str: int, dex: int, int: int}|null
     */
    public function itemRequirements(?string $baseType): ?array
    {
        return $this->items->requirements($baseType);
    }

    /**
     * A base type's own defensive stats (see {@see ItemCatalog::armour}).
     *
     * @return array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null
     */
    public function itemArmour(?string $baseType): ?array
    {
        return $this->items->armour($baseType);
    }

    /**
     * The item class of a base type (e.g. "Crossbow", "Ring"), or null if unknown.
     */
    public function itemClass(?string $baseType): ?string
    {
        return $this->items->itemClass($baseType);
    }

    /**
     * Granted stats for a rune (level requirement + effect lines), or null if unknown.
     *
     * @return array{levelRequirement: ?int, effects: list<string>}|null
     */
    public function runeData(?string $name): ?array
    {
        return $this->runes->data($name);
    }

    /**
     * Icon for a rune (soul core). Runes carry no art of their own - the icon lives
     * on the matching SoulCore base type in the item table, keyed by the same name.
     */
    public function runeIcon(?string $name): ?string
    {
        return $this->items->icon($name);
    }

    /**
     * The structured (key/rolls) form of a unique's synced mods (see
     * {@see UniqueCatalog::modLines}).
     *
     * @return array{implicits: list<UniqueModLine>, mods: list<UniqueModLine>}
     */
    public function uniqueModLines(string $name): array
    {
        return $this->uniques->modLines($name);
    }

    /**
     * A unique's underlying base item (see {@see UniqueCatalog::baseType}).
     */
    public function uniqueBaseType(?string $name): ?string
    {
        return $this->uniques->baseType($name);
    }

    /**
     * Search the gem, rune and unique-item catalogues by name for the reference
     * picker (see {@see ReferenceResolver::search}).
     *
     * @param  list<string>  $types  any of 'gem', 'rune', 'unique'
     * @param  list<string>  $categories  restrict uniques to these base categories (e.g. equipment slots); empty = any
     * @param  ?string  $gemKind  restrict gems to a picker slot: 'skill' (active/spirit) or 'support'; null = any
     * @return list<ReferenceEntry>
     */
    public function searchReferences(string $query, array $types, array $categories = [], ?string $gemKind = null, int $limit = 20): array
    {
        return $this->references->search($query, $types, $categories, $gemKind, $limit);
    }

    /**
     * Resolve a single reference token (type + id) to its display data, or null when
     * the id is unknown or the type is unsupported.
     *
     * @return ReferenceEntry|null
     */
    public function resolveReference(string $type, string $id): ?array
    {
        return $this->references->resolve($type, $id);
    }
}
