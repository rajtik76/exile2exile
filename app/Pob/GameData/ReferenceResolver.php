<?php

declare(strict_types=1);

namespace App\Pob\GameData;

use App\Pob\TextSearch;
use App\Pob\Uniques\TaggedLine;
use App\Pob\Uniques\UniqueModLine;

/**
 * Searches and resolves reference tokens (gems, runes, uniques, bases, notables) to
 * the display payload the reference picker and tooltips render from, composing the
 * per-domain catalogues.
 *
 * @phpstan-type ReferenceEntry array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, variants?: array{variants: list<string>, versions: list<string>, altSlots: list<int>, groups: array<int, array<int, list<int>>>, defaults: array{variant?: int, alts?: array<int, int>, version?: int, groups?: array<int, int>}}|null, baseType?: ?string, armour?: array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null, weapon?: array{damageMin: int, damageMax: int, critical: int, attackTime: int, rangeMax: int, reloadTime: int}|null, spirit?: int, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null, hoverImage?: ?string, scaling?: array{name: string, levels: list<array{level: int, cost: ?int, castTime: ?float, cooldown: ?float, reservation: ?float, spellCritChance: ?float, attackCritChance: ?float, stats: list<array{text: string, min: float, max: float}>}>, qualityStats: list<array{text: string, min: float, max: float}>}|null, requires?: array{level: array{int, int}, str: array{int, int}|null, dex: array{int, int}|null, int: array{int, int}|null}|null, levelRequirement?: ?int}
 */
final readonly class ReferenceResolver
{
    public function __construct(
        private GemCatalog $gems,
        private ItemCatalog $items,
        private RuneCatalog $runes,
        private UniqueCatalog $uniques,
        private NotableCatalog $notables,
    ) {}

    /**
     * Search the gem, rune and unique-item catalogues by name for the reference
     * picker. Returns a flat, ranked list (prefix matches first, then shorter names)
     * of at most $limit entries.
     *
     * @param  list<string>  $types  any of 'gem', 'rune', 'unique'
     * @param  list<string>  $categories  restrict uniques to these base categories (e.g. equipment slots); empty = any
     * @param  ?string  $gemKind  restrict gems to a picker slot: 'skill' (active/spirit) or 'support'; null = any
     * @return list<ReferenceEntry>
     */
    public function search(string $query, array $types, array $categories = [], ?string $gemKind = null, int $limit = 20): array
    {
        $terms = TextSearch::terms($query);

        if ($terms === []) {
            return [];
        }

        $matches = [];

        if (in_array('gem', $types, true)) {
            foreach ($this->gems->all() as $id => $entry) {
                if ($gemKind !== null && ! $this->gems->matchesKind($entry['type'], $gemKind)) {
                    continue;
                }

                if (TextSearch::matches($entry['name'], $terms)) {
                    $matches[] = $this->gemReference((string) $id, $entry);
                }
            }
        }

        if (in_array('rune', $types, true)) {
            foreach ($this->runes->all() as $name => $data) {
                if (TextSearch::matches((string) $name, $terms)) {
                    $matches[] = $this->runeReference((string) $name, $data);
                }
            }
        }

        if (in_array('unique', $types, true)) {
            foreach ($this->items->names() as $name) {
                if ($this->items->isUnique($name) !== true || ! TextSearch::matches($name, $terms)) {
                    continue;
                }

                // Restrict to the slot's base categories (Bow, Helmet, …) when given.
                if ($categories !== [] && ! in_array($this->items->category($name), $categories, true)) {
                    continue;
                }

                // A name PoB has on several bases (Grand Spectrum) is one entry per base.
                foreach ($this->uniques->idsNamed($name) ?: [$name] as $id) {
                    $matches[] = $this->uniqueReference($id);
                }
            }
        }

        if (in_array('notable', $types, true)) {
            foreach ($this->notables->all() as $name => $data) {
                if (TextSearch::matches((string) $name, $terms)) {
                    $matches[] = $this->notableReference((string) $name, $data);
                }
            }
        }

        if (in_array('base', $types, true)) {
            foreach ($this->items->names() as $name) {
                if (! $this->items->isBaseType($name) || ! TextSearch::matches($name, $terms)) {
                    continue;
                }

                if ($categories !== [] && ! in_array($this->items->category($name), $categories, true)) {
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
     * @return ReferenceEntry|null
     */
    public function resolve(string $type, string $id): ?array
    {
        return match ($type) {
            'gem' => ($entry = $this->gems->all()[$id] ?? null) !== null
                ? $this->gemReference($id, $entry)
                : null,
            'rune' => ($data = $this->runes->data($id)) !== null
                ? $this->runeReference($id, $data)
                : null,
            'notable' => ($node = $this->notables->all()[$id] ?? null) !== null
                ? $this->notableReference($id, $node)
                : null,
            'unique' => $this->items->isUnique($this->uniques->nameOf($id)) === true
                ? $this->uniqueReference($id)
                : null,
            'base' => $this->items->isBaseType($id)
                ? $this->baseReference($id)
                : null,
            default => null,
        };
    }

    /**
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, variants?: array{variants: list<string>, versions: list<string>, altSlots: list<int>, groups: array<int, array<int, list<int>>>, defaults: array{variant?: int, alts?: array<int, int>, version?: int, groups?: array<int, int>}}|null, baseType?: ?string, armour?: array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null, weapon?: array{damageMin: int, damageMax: int, critical: int, attackTime: int, rangeMax: int, reloadTime: int}|null, spirit?: int, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}
     */
    private function baseReference(string $name): array
    {
        return [
            'type' => 'base',
            'id' => $name,
            'name' => $name,
            'icon' => $this->items->icon($name),
            'category' => $this->items->category($name),
            'color' => null,
            'tags' => [],
            'tooltip' => null,
            'flavour' => null,
            'twoHanded' => $this->items->isTwoHanded($name),
            // A base's own fixed implicit lines (read-only), rendered from GGPK.
            'implicits' => $this->items->implicits($name),
            // The base's own defensive stats, used to know *which* of Armour/Evasion/
            // Energy Shield a base actually has (see ItemCatalog::armour) - null for a
            // base GGPK has no defensive row for (weapons, jewellery, ...).
            'armour' => $this->items->armour($name),
            // The base's own offensive stats (raw GGPK units - see ItemCatalog::weapon);
            // null for anything without a WeaponTypes row, caster weapons included. The
            // editor derives the displayed weapon lines from these plus local mods.
            'weapon' => $this->items->weapon($name),
            'spirit' => $this->items->spirit($name),
            'sprite' => null,
        ];
    }

    /**
     * @param  array{name: string, icon: ?string, color: string, type: string, description: ?string, tags: list<string>, hoverImage: ?string}  $entry
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, variants?: array{variants: list<string>, versions: list<string>, altSlots: list<int>, groups: array<int, array<int, list<int>>>, defaults: array{variant?: int, alts?: array<int, int>, version?: int, groups?: array<int, int>}}|null, baseType?: ?string, armour?: array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null, hoverImage: ?string, scaling: array{name: string, levels: list<array{level: int, cost: ?int, castTime: ?float, cooldown: ?float, reservation: ?float, spellCritChance: ?float, attackCritChance: ?float, stats: list<array{text: string, min: float, max: float}>}>, qualityStats: list<array{text: string, min: float, max: float}>}|null, requires: array{level: array{int, int}, str: array{int, int}|null, dex: array{int, int}|null, int: array{int, int}|null}|null}
     */
    private function gemReference(string $id, array $entry): array
    {
        return [
            'type' => 'gem',
            'id' => $id,
            'name' => $entry['name'],
            'icon' => $this->gems->icon($id),
            'category' => $this->gems->category($id),
            // Socket colour letter (b/g/r/w) - tints the chip and its tooltip.
            'color' => $entry['color'],
            'tags' => $this->gems->tags($id),
            'tooltip' => $this->gems->description($id),
            'flavour' => null,
            'twoHanded' => false,
            'implicits' => [],
            'sprite' => null,
            // Background art the tooltip paints behind its header (null for most
            // gems - see GemCatalog::hoverImage's own doc on why that's expected).
            'hoverImage' => $this->gems->hoverImage($id),
            'scaling' => $this->gems->scaling($id),
            'requires' => $this->gems->requires($id),
        ];
    }

    /**
     * @param  array{levelRequirement: ?int, effects: list<string>}  $data
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, variants?: array{variants: list<string>, versions: list<string>, altSlots: list<int>, groups: array<int, array<int, list<int>>>, defaults: array{variant?: int, alts?: array<int, int>, version?: int, groups?: array<int, int>}}|null, baseType?: ?string, armour?: array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null, levelRequirement?: ?int}
     */
    private function runeReference(string $name, array $data): array
    {
        $effects = implode("\n", array_filter($data['effects'], is_string(...)));

        return [
            'type' => 'rune',
            'id' => $name,
            'name' => $name,
            // Runes carry no art of their own - the icon lives on the matching
            // SoulCore base type in the item table, keyed by the same name.
            'icon' => $this->items->icon($name),
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
            'levelRequirement' => $data['levelRequirement'],
        ];
    }

    /**
     * @param  array{stats: list<string>, ascendancy: bool, keystone: bool, icon: ?string}  $node
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, variants?: array{variants: list<string>, versions: list<string>, altSlots: list<int>, groups: array<int, array<int, list<int>>>, defaults: array{variant?: int, alts?: array<int, int>, version?: int, groups?: array<int, int>}}|null, baseType?: ?string, armour?: array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}
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
            'sprite' => $this->notables->sprite($node['icon'], $node['keystone']),
        ];
    }

    /**
     * @return array{type: string, id: string, name: string, icon: ?string, category: ?string, color: ?string, tags: list<string>, tooltip: ?string, flavour: ?string, twoHanded: bool, implicits: list<string>, modLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, implicitLines?: list<array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}>, variants?: array{variants: list<string>, versions: list<string>, altSlots: list<int>, groups: array<int, array<int, list<int>>>, defaults: array{variant?: int, alts?: array<int, int>, version?: int, groups?: array<int, int>}}|null, baseType?: ?string, armour?: array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null, weapon?: array{damageMin: int, damageMax: int, critical: int, attackTime: int, rangeMax: int, reloadTime: int}|null, spirit?: int, sprite: array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null}
     */
    private function uniqueReference(string $id): array
    {
        // Icon, category and flavour come from GGPK, keyed by the unique's name; a name
        // PoB has on several bases shares them across its ids.
        $name = $this->uniques->nameOf($id);
        $category = $this->items->category($name);
        // Not in .dat at all - the game composes a unique's rolls at runtime, so this is
        // the one field on this reference sourced from Path of Building, not GGPK (see
        // UniqueCatalog). Absent (no sync yet, or an unmatched id) just means no mods show
        // yet; the reference itself (icon, category, flavour) still resolves from GGPK.
        // The plain-text tooltip and implicits show PoB's default variant.
        $default = $this->uniques->modLines($id);
        $tagged = $this->uniques->taggedModLines($id);
        $base = $this->uniques->baseType($id);

        return [
            'type' => 'unique',
            'id' => $id,
            'name' => $name,
            'icon' => $this->items->icon($name),
            'category' => $category !== null ? 'Unique '.$category : 'Unique',
            'color' => null,
            'tags' => [],
            'tooltip' => $default['mods'] !== [] ? implode("\n", array_map(static fn (UniqueModLine $line): string => $line->template, $default['mods'])) : null,
            'flavour' => $this->items->flavour($name),
            'twoHanded' => $this->items->isTwoHanded($name),
            'implicits' => array_map(static fn (UniqueModLine $line): string => $line->template, $default['implicits']),
            // Structured (key/rolls) form of every variant's lines, each with its PoB
            // variant tags, plus the variant model itself: the equipped-item editor shows
            // the lines of the item's own variant pick and substitutes stored rolled values
            // into them (resources/js/lib/uniqueVariants.ts).
            'modLines' => array_values(array_map(
                static fn (array $entry): array => self::uniqueModLineArray($entry['line'], $entry['tags']),
                array_filter($tagged, static fn (array $entry): bool => ! $entry['implicit']),
            )),
            'implicitLines' => array_values(array_map(
                static fn (array $entry): array => self::uniqueModLineArray($entry['line'], $entry['tags']),
                array_filter($tagged, static fn (array $entry): bool => $entry['implicit']),
            )),
            'variants' => $this->uniques->variants($id)?->toArray(),
            // The unique's underlying base item (e.g. "Viper Cap" for Constricting
            // Command) - synced from Path of Building alongside its mods, since .dat
            // carries no unique-to-base-type link either. Shown under the item's name
            // in the tooltip, same as the game's own unique tooltip does. Absent when
            // unsynced, same as the mods themselves.
            'baseType' => $base,
            // The unique's own defensive stats, looked up via its synced base type -
            // .dat itself has no unique-to-base-type link, but the PoB-sourced base name
            // above is a real GGPK base, so its ArmourTypes/ShieldTypes row still
            // resolves. Null when unsynced (no base name to look up yet).
            'armour' => $this->items->armour($base),
            // Same synced-base lookup for the weapon row and Spirit - a unique weapon
            // shows its base's stats (its own mod lines carry no stat ids to derive from).
            'weapon' => $this->items->weapon($base),
            'spirit' => $this->items->spirit($base),
            'sprite' => null,
        ];
    }

    /**
     * @return array{key: string, template: string, rolls: list<array{min: float, max: float}>, variants?: list<int>, versions?: list<int>, groups?: list<int>}
     */
    private static function uniqueModLineArray(UniqueModLine $line, TaggedLine $tags): array
    {
        return array_filter([
            'key' => $line->key,
            'template' => $line->template,
            'rolls' => $line->rolls,
            'variants' => $tags->variants,
            'versions' => $tags->versions,
            'groups' => $tags->groups,
        ], static fn (mixed $value): bool => $value !== null);
    }
}
