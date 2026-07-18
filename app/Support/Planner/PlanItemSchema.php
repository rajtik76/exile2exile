<?php

declare(strict_types=1);

namespace App\Support\Planner;

use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Pob\Uniques\UniqueModLine;

/**
 * The stored shape of one equipped item on the plan's paper-doll: its rarity,
 * base/unique reference, author-typed name, defensive properties, modifier
 * references, rune sockets and gearing priority. Owns the per-slot limits and the
 * canonicaliser/validator for that shape; the affix rules that need the GGPK mod
 * catalogue (per-rarity prefix/suffix counts, families, value ranges, base
 * compatibility) live in {@see ModCatalogue::modErrors}.
 */
final class PlanItemSchema
{
    /**
     * Rarities an equipment item may have (a unique carries a unique ref, the rest a
     * base-type ref plus author-typed mod lines).
     *
     * @var list<string>
     */
    public const array ITEM_RARITIES = ['normal', 'magic', 'rare', 'unique'];

    /** Most author-typed modifier lines an item may carry. */
    private const int MAX_ITEM_STATS = 20;

    /**
     * The lowest mod count that forces rare: magic's hard cap is 1 prefix + 1 suffix (2
     * total, see {@see ModCatalogue::MODS_PER_TYPE}), so nothing above that can be magic.
     */
    private const int MIN_MODS_FOR_RARE = 3;

    /** Most rune sockets an item may carry (a corrupted weapon/body: 3 natural + 1 Vaal). */
    private const int MAX_ITEM_SOCKETS = 4;

    /** Longest author-typed item name (e.g. a rare's rolled name, "Rift Pelt"). */
    public const int MAX_ITEM_NAME_LENGTH = 60;

    /**
     * The item's own defensive/quality properties, as the game tooltip shows them (the
     * computed totals, not affixes): quality, the three defence types, and block chance
     * (shields only). Authored per item, non-negative integers, 0 = the line is hidden.
     *
     * @var list<string>
     */
    public const array ITEM_PROP_KEYS = ['quality', 'armour', 'evasion', 'energyShield', 'block'];

    /** The three defence types; triple-hybrid bases carry all of them at once. */
    public const array ITEM_DEFENCE_KEYS = ['armour', 'evasion', 'energyShield'];

    /**
     * Validation ceiling for item quality. Ordinary gear caps at 20%, but "+X% to
     * Maximum Quality" modifiers and implicits stack well past it (a corrupted Refined
     * Breach Ring shows +73%), so the ceiling is generous rather than a game rule.
     */
    public const int MAX_ITEM_QUALITY = 100;

    /**
     * Item-level bounds. The game's item level tracks the monster level of the zone an
     * item dropped in and gates which affix tiers can roll; 100 is the level cap.
     */
    public const int MAX_ITEM_LEVEL = 100;

    /**
     * Equipment slots the items paper-doll fills, each holding one item reference.
     *
     * @var list<string>
     */
    public const array EQUIPMENT_SLOTS = [
        'weapon1', 'weapon2', 'weapon1swap', 'weapon2swap', 'helmet', 'amulet', 'body',
        'ring1', 'ring2', 'gloves', 'boots', 'belt',
        'flask1', 'flask2', 'charm1', 'charm2', 'charm3',
    ];

    /**
     * Flask and charm slots: these items have no rare tier in the game (they cap at magic),
     * so a "rare" rarity here is rejected.
     *
     * @var list<string>
     */
    public const array NO_RARE_SLOTS = ['flask1', 'flask2', 'charm1', 'charm2', 'charm3'];

    /**
     * Distinct gearing-priority numbers an author can assign - one per equipment slot,
     * so the whole gearing order is expressible without a collision.
     */
    public const int MAX_PRIORITY = 17;

    /**
     * Per-slot rune-socket ceiling. Weapons and body armour take the most, smaller
     * armour fewer; jewellery and belts take none. Each cap is the natural maximum
     * plus the one socket a Vaal corruption can add. Mirrors the client's
     * SLOT_MAX_SOCKETS so a forged payload can't exceed what the paper-doll allows.
     *
     * @var array<string, int>
     */
    public const array SLOT_MAX_SOCKETS = [
        'weapon1' => 4, 'weapon2' => 4, 'weapon1swap' => 4, 'weapon2swap' => 4, 'body' => 4,
        'helmet' => 3, 'gloves' => 3, 'boots' => 3,
        'belt' => 0, 'amulet' => 0, 'ring1' => 0, 'ring2' => 0,
        'flask1' => 0, 'flask2' => 0,
        'charm1' => 0, 'charm2' => 0, 'charm3' => 0,
    ];

    /**
     * The equipment slot map: known slot => an item (rarity, base/unique ref, attribute
     * requirements, author mod references and rune sockets). Empty items and unknown
     * slots are dropped.
     *
     * @param  array<int|string, mixed>  $slots
     * @return array<string, array{rarity: string, base: array{type: string, id: string}|null, name: string, corrupted: bool, itemLevel: int|null, props: array{quality: int, armour: int, evasion: int, energyShield: int, block: int}, stats: list<array{modId: ?string, text: string, name: ?string, type: ?string, family: ?string, tier: ?int, rolls: ?list<array{stat: string, min: int|float, max: int|float}>, values: list<int|float>}>, uniqueMods: list<array{key: string, values: list<int|float>}>, sockets: list<array{type: string, id: string}|null>, priority: int|null}>
     */
    public static function canonicalSlots(array $slots): array
    {
        $result = [];
        // A priority number is unique across a phase's equipment; a duplicate (only
        // possible from a forged payload - the UI offers free numbers only) is dropped
        // to null on the later slot, keeping the invariant even for repaired blobs.
        $usedPriorities = [];

        foreach (self::EQUIPMENT_SLOTS as $slot) {
            $entry = $slots[$slot] ?? null;

            if (! is_array($entry)) {
                continue;
            }

            $item = self::canonicalItem($entry);

            if ($item === null) {
                continue;
            }

            if ($item['priority'] !== null) {
                if (in_array($item['priority'], $usedPriorities, true)) {
                    $item['priority'] = null;
                } else {
                    $usedPriorities[] = $item['priority'];
                }
            }

            $result[$slot] = $item;
        }

        return $result;
    }

    /**
     * Shape-level validation messages for one authored equipment item, empty when it is
     * legal. These mirror the paper-doll's own limits so a forged payload can't bypass
     * what the UI already prevents: sockets within the slot's ceiling (jewellery/belts
     * take none) and a unique carrying no author-typed modifiers (its real stats come
     * from the GGPK unique it references).
     *
     * @param  array<string, mixed>  $item
     * @return list<string>
     */
    public static function itemErrors(string $slot, array $item): array
    {
        $errors = [];
        $stats = is_array($item['stats'] ?? null) ? array_values($item['stats']) : [];
        $sockets = is_array($item['sockets'] ?? null) ? $item['sockets'] : [];
        $props = is_array($item['props'] ?? null) ? $item['props'] : [];

        // The author's own `rarity` input is never trusted here, same as
        // {@see canonicalItem} - it is re-derived from the base/stats so a forged
        // payload can't slip a rarity its own equipment wouldn't actually produce
        // (e.g. a flask claiming `normal` while carrying 3 stats, to dodge the
        // {@see NO_RARE_SLOTS} rule below).
        $rawBase = is_array($item['base'] ?? null) ? $item['base'] : null;
        $rarity = self::rarityOf($rawBase, $stats);
        $isUnique = $rarity === 'unique';

        $name = $item['name'] ?? '';

        if (is_string($name) && mb_strlen($name) > self::MAX_ITEM_NAME_LENGTH) {
            $errors[] = 'Item name cannot exceed '.self::MAX_ITEM_NAME_LENGTH.' characters.';
        }

        $quality = $props['quality'] ?? 0;

        if (is_numeric($quality) && (int) $quality > self::MAX_ITEM_QUALITY) {
            $errors[] = 'Quality cannot exceed '.self::MAX_ITEM_QUALITY.'%.';
        }

        if ($rarity === 'rare' && in_array($slot, self::NO_RARE_SLOTS, true)) {
            $errors[] = 'A flask or charm cannot be rare.';
        }

        $maxSockets = self::SLOT_MAX_SOCKETS[$slot] ?? 0;

        // A unique can carry more sockets than its slot's rares (Greymake and The
        // Bringer of Rain wear four on a helmet), so uniques take the global ceiling.
        if ($isUnique && $maxSockets > 0) {
            $maxSockets = self::MAX_ITEM_SOCKETS;
        }

        if (count($sockets) > $maxSockets) {
            $errors[] = $maxSockets === 0
                ? 'This slot cannot hold rune sockets.'
                : "This slot holds at most {$maxSockets} rune sockets.";
        }

        // A unique's modifiers are fixed by the unique itself, so the author picks none -
        // it may only carry the rolled *value* of each mod the unique already has
        // (uniqueMods), never an author-picked affix (stats). Its level requirement and
        // defensive properties are legitimate to record though (the planner holds no base
        // defence data - typing them is the only way to plan a unique's armour/ES).
        if ($isUnique && $stats !== []) {
            $errors[] = 'A unique item carries its own modifiers and cannot add more.';
        }

        if (! $isUnique && is_array($item['uniqueMods'] ?? null) && $item['uniqueMods'] !== []) {
            $errors[] = 'Only a unique item can carry rolled unique-modifier values.';
        }

        return $errors;
    }

    /**
     * Coerce one equipment item; returns null when it carries nothing (no base ref,
     * no mod lines and no runes).
     *
     * @param  array<string, mixed>  $entry
     * @return array{rarity: string, base: array{type: string, id: string}|null, name: string, corrupted: bool, itemLevel: int|null, props: array{quality: int, armour: int, evasion: int, energyShield: int, block: int}, stats: list<array{modId: ?string, text: string, name: ?string, type: ?string, family: ?string, tier: ?int, rolls: ?list<array{stat: string, min: int|float, max: int|float}>, values: list<int|float>}>, uniqueMods: list<array{key: string, values: list<int|float>}>, sockets: list<array{type: string, id: string}|null>, priority: int|null}|null
     */
    private static function canonicalItem(array $entry): ?array
    {
        $base = null;
        $rawBase = $entry['base'] ?? null;

        if (is_array($rawBase)) {
            $type = $rawBase['type'] ?? null;
            $id = $rawBase['id'] ?? null;

            if (in_array($type, ['base', 'unique'], true) && is_string($id) && $id !== '') {
                $base = ['type' => (string) $type, 'id' => $id];
            }
        }

        $stats = [];
        $rawStats = is_array($entry['stats'] ?? null) ? $entry['stats'] : [];

        foreach (array_slice(array_values($rawStats), 0, self::MAX_ITEM_STATS) as $stat) {
            $mod = self::canonicalMod($stat);

            if ($mod !== null) {
                $stats[] = $mod;
            }
        }

        $rarity = self::rarityOf($base, $stats);

        $uniqueMods = [];
        $rawUniqueMods = is_array($entry['uniqueMods'] ?? null) ? $entry['uniqueMods'] : [];

        foreach (array_slice(array_values($rawUniqueMods), 0, self::MAX_ITEM_STATS) as $stat) {
            $mod = self::canonicalUniqueMod($stat);

            if ($mod !== null) {
                $uniqueMods[] = $mod;
            }
        }

        $sockets = self::canonicalSockets(is_array($entry['sockets'] ?? null) ? $entry['sockets'] : []);
        $props = self::canonicalProps(is_array($entry['props'] ?? null) ? $entry['props'] : []);

        if ($base === null && $stats === [] && $uniqueMods === [] && $sockets === [] && array_sum($props) === 0) {
            return null;
        }

        $rawPriority = $entry['priority'] ?? null;
        $priority = is_numeric($rawPriority) && (int) $rawPriority >= 1 && (int) $rawPriority <= self::MAX_PRIORITY
            ? (int) $rawPriority
            : null;

        return [
            'rarity' => $rarity,
            'base' => $base,
            'name' => self::canonicalItemName($entry['name'] ?? null),
            'corrupted' => (bool) ($entry['corrupted'] ?? false),
            'itemLevel' => self::canonicalItemLevel($entry['itemLevel'] ?? null),
            'props' => $props,
            'stats' => $stats,
            'uniqueMods' => $uniqueMods,
            'sockets' => $sockets,
            'priority' => $priority,
        ];
    }

    /**
     * An item's rarity, derived from its base and stats - never taken from the author's
     * own `rarity` input, so it can't drift out of sync with what the item actually
     * carries (or be forged to dodge a rarity-gated rule, see {@see itemErrors}). Mirrors
     * the frontend's `deriveRarity` (`itemRarity.ts`) exactly, so what the editor shows
     * while authoring is what gets stored. Works on both raw (author-submitted) and
     * already-canonicalised base/stats - both carry the same `base.type`/`stat.type`
     * shape.
     *
     * A unique base is always unique. Otherwise each stat carries its own frozen `type`
     * (see {@see canonicalMod}) when it matched a known GGPK affix; an unmatched
     * (author-typed) stat carries none. With every stat matched, the prefix/suffix split
     * is exact: none is normal, up to one of each is magic, anything past that is rare.
     * Once at least one stat is unmatched the split can't be read exactly - the total
     * count alone still pins down 0 (normal) and {@see MIN_MODS_FOR_RARE}+ (rare, past
     * magic's 1 prefix + 1 suffix cap); 1-2 falls back to magic, the overwhelmingly
     * common case in practice.
     *
     * There is no fixed ceiling on the other end - a rune ("+1 Suffix Modifier allowed")
     * or a corruption can push a real rare item's affix count past its base 3+3, so
     * nothing here rejects a high count.
     *
     * @param  array{type?: mixed}|null  $base
     * @param  list<array{type?: mixed}>  $stats
     */
    public static function rarityOf(?array $base, array $stats): string
    {
        if (($base['type'] ?? null) === 'unique') {
            return 'unique';
        }

        $prefixes = 0;
        $suffixes = 0;
        $unknown = 0;

        foreach ($stats as $stat) {
            match ($stat['type'] ?? null) {
                'prefix' => $prefixes++,
                'suffix' => $suffixes++,
                default => $unknown++,
            };
        }

        $total = $prefixes + $suffixes + $unknown;

        if ($total === 0) {
            return 'normal';
        }

        if ($unknown === 0) {
            return $prefixes <= 1 && $suffixes <= 1 ? 'magic' : 'rare';
        }

        return $total < self::MIN_MODS_FOR_RARE ? 'magic' : 'rare';
    }

    /**
     * Coerce an item's author-typed item level: an int clamped to
     * 1..{@see MAX_ITEM_LEVEL}, or null when absent/non-numeric (the line is hidden).
     */
    private static function canonicalItemLevel(mixed $level): ?int
    {
        if (! is_numeric($level)) {
            return null;
        }

        return min(self::MAX_ITEM_LEVEL, max(1, (int) $level));
    }

    /**
     * Coerce an item's author-typed name: trimmed, capped at
     * {@see MAX_ITEM_NAME_LENGTH}, empty string when absent or not a string (a blank
     * name falls back to the base/unique's own name wherever the item is displayed).
     */
    private static function canonicalItemName(mixed $name): string
    {
        if (! is_string($name)) {
            return '';
        }

        return mb_substr(trim($name), 0, self::MAX_ITEM_NAME_LENGTH);
    }

    /**
     * Coerce an item's defensive/quality properties: a non-negative int per key (0 = the
     * line is hidden), as the game tooltip shows them.
     *
     * @param  array<string, mixed>  $props
     * @return array{quality: int, armour: int, evasion: int, energyShield: int, block: int}
     */
    private static function canonicalProps(array $props): array
    {
        $result = [];

        foreach (self::ITEM_PROP_KEYS as $key) {
            $value = $props[$key] ?? 0;
            $result[$key] = is_numeric($value) ? max(0, (int) $value) : 0;
        }

        // Quality caps at 20 by ordinary means; clamp so a stored item is always legal.
        $result['quality'] = min($result['quality'], self::MAX_ITEM_QUALITY);

        return $result;
    }

    /**
     * Coerce an item's rune sockets: an ordered list of slots, each either a rune
     * reference or null (an empty socket). Trailing nulls are trimmed.
     *
     * @param  array<int|string, mixed>  $sockets
     * @return list<array{type: string, id: string}|null>
     */
    private static function canonicalSockets(array $sockets): array
    {
        $result = [];

        foreach (array_slice(array_values($sockets), 0, self::MAX_ITEM_SOCKETS) as $socket) {
            if (is_array($socket) && ($socket['type'] ?? null) === 'rune' && is_string($socket['id'] ?? null) && $socket['id'] !== '') {
                $result[] = ['type' => 'rune', 'id' => $socket['id']];
            } else {
                $result[] = null;
            }
        }

        // Drop trailing empty sockets so an untouched "+ socket" doesn't persist.
        while ($result !== [] && end($result) === null) {
            array_pop($result);
        }

        return $result;
    }

    /**
     * Coerce one modifier into its frozen shape - a matched GGPK affix's data copied out
     * at write time (see {@see ModCatalogue::modSnapshot}), or a plain-text line when
     * nothing matched. Unlike a live reference, none of this is ever resolved against the
     * catalogue again, so a future GGPK patch renaming or dropping the affix can never
     * invalidate an already-stored plan. `text` is the only field that must always be
     * present - it is the sole source of truth for display when `modId` is null; every
     * other field is metadata used only while `modId` still resolves (family/tier
     * validation, `HasExplicitMod` names, …). Returns null when there is no text at all.
     *
     * @return array{modId: ?string, text: string, name: ?string, type: ?string, family: ?string, tier: ?int, rolls: ?list<array{stat: string, min: int|float, max: int|float}>, values: list<int|float>}|null
     */
    private static function canonicalMod(mixed $stat): ?array
    {
        if (! is_array($stat)) {
            return null;
        }

        $text = is_string($stat['text'] ?? null) ? trim((string) $stat['text']) : '';
        $modId = is_string($stat['modId'] ?? null) ? trim((string) $stat['modId']) : '';

        // Backward compatibility: a stat saved before the frozen snapshot shape existed
        // carries only `{modId, values}` - no `text` at all. Re-freeze it here from the
        // live catalogue rather than dropping the mod outright - every view or save of
        // an older plan (predating `MigrateBuildPlanStatSnapshots`) re-runs this until
        // the backfill command persists its snapshot, but that's a cheap in-memory
        // catalogue lookup, not a reason to strip the mod in the meantime.
        if ($text === '' && $modId !== '') {
            $stat = app(ModCatalogue::class)->modSnapshot($modId, self::canonicalValues($stat['values'] ?? null), '');
            $text = trim($stat['text']);
            $modId = is_string($stat['modId'] ?? null) ? trim((string) $stat['modId']) : '';
        }

        if ($text === '') {
            return null;
        }

        $name = is_string($stat['name'] ?? null) ? trim((string) $stat['name']) : '';
        $type = in_array($stat['type'] ?? null, ['prefix', 'suffix'], true) ? (string) $stat['type'] : null;
        $family = is_string($stat['family'] ?? null) ? trim((string) $stat['family']) : '';
        $tier = is_numeric($stat['tier'] ?? null) ? (int) $stat['tier'] : null;

        return [
            'modId' => $modId !== '' ? mb_substr($modId, 0, 120) : null,
            'text' => mb_substr($text, 0, 200),
            'name' => $name !== '' ? mb_substr($name, 0, 120) : null,
            'type' => $type,
            'family' => $family !== '' ? mb_substr($family, 0, 120) : null,
            'tier' => $tier,
            'rolls' => self::canonicalRolls($stat['rolls'] ?? null),
            'values' => self::canonicalValues($stat['values'] ?? null),
        ];
    }

    /**
     * Coerce one modifier's frozen roll ranges (one per value it carries), capped at the
     * most ranges any tier carries. Returns null when there are none - the field only has
     * meaning for a matched (non-plain-text) stat.
     *
     * @return list<array{stat: string, min: int|float, max: int|float}>|null
     */
    private static function canonicalRolls(mixed $rawRolls): ?array
    {
        if (! is_array($rawRolls)) {
            return null;
        }

        $rolls = [];

        foreach (array_slice(array_values($rawRolls), 0, 8) as $roll) {
            if (! is_array($roll) || ! is_string($roll['stat'] ?? null) || ! is_numeric($roll['min'] ?? null) || ! is_numeric($roll['max'] ?? null)) {
                continue;
            }

            $rolls[] = ['stat' => $roll['stat'], 'min' => $roll['min'] + 0, 'max' => $roll['max'] + 0];
        }

        return $rolls === [] ? null : $rolls;
    }

    /**
     * Coerce one unique-item mod's rolled value(s): a reference to one of its synced
     * catalogue lines (by {@see UniqueModLine::$key}, stable across a
     * value changing) plus the value(s) rolled into each of that line's ranges. Unlike
     * {@see canonicalMod}, decimals are expected and kept as-is - PoB's own unique data
     * carries genuinely fractional rolls (e.g. "11.9 Life Regeneration per second").
     * The key's range(s) are resolved live from {@see IconResolver::uniqueModLines},
     * so only the key and the values are stored. Returns null when there is no key.
     *
     * @return array{key: string, values: list<int|float>}|null
     */
    private static function canonicalUniqueMod(mixed $stat): ?array
    {
        if (! is_array($stat)) {
            return null;
        }

        $key = is_string($stat['key'] ?? null) ? trim((string) $stat['key']) : '';

        if ($key === '') {
            return null;
        }

        return ['key' => mb_substr($key, 0, 200), 'values' => self::canonicalValues($stat['values'] ?? null)];
    }

    /**
     * Coerce a mod's rolled values: numbers kept (numeric strings cast), anything
     * else dropped, capped at the most ranges any tier carries.
     *
     * @return list<int|float>
     */
    private static function canonicalValues(mixed $rawValues): array
    {
        $values = [];

        foreach (array_slice(array_values(is_array($rawValues) ? $rawValues : []), 0, 8) as $value) {
            if (is_int($value) || is_float($value)) {
                $values[] = $value;
            } elseif (is_string($value) && is_numeric($value)) {
                $values[] = $value + 0;
            }
        }

        return $values;
    }
}
