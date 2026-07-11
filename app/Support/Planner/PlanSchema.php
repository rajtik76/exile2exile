<?php

declare(strict_types=1);

namespace App\Support\Planner;

use App\Models\BuildPlan;
use App\Pob\ModCatalogue;

/**
 * The single source of truth for a build plan's stored JSON shape.
 *
 * A plan's whole guide lives in one JSON blob ({@see BuildPlan::$data}).
 * This class owns that shape: the fixed phase tabs, an empty-plan template, the
 * per-version upgrade path, and the canonicaliser that repairs and normalises any
 * blob before it is stored or rendered.
 *
 * Versioning is deliberate: production rows are written under {@see CURRENT_VERSION},
 * and when the shape changes we bump the constant and add an `upgradeVXtoVY` step so
 * an older row is migrated on read (and can be rewritten by a data migration). Never
 * change the meaning of an existing version in place - add a new one.
 */
final class PlanSchema
{
    /**
     * Current JSON schema version. Bump this (and add an upgrade step below) on any
     * change to the stored shape.
     */
    public const int CURRENT_VERSION = 1;

    /**
     * The fixed base phases, in their immutable display order. A plan always opens
     * with exactly these, and custom tabs may only follow the last one - a guide
     * author can neither reorder them nor slip a tab between them.
     *
     * @var list<array{id: string, label: string}>
     */
    public const array BASE_TABS = [
        ['id' => 'act-1', 'label' => 'Act I'],
        ['id' => 'act-2', 'label' => 'Act II'],
        ['id' => 'act-3', 'label' => 'Act III'],
        ['id' => 'act-4', 'label' => 'Act IV'],
        ['id' => 'interlude', 'label' => 'Interlude'],
        ['id' => 'early-endgame', 'label' => 'Early Endgame'],
    ];

    /**
     * The three content groups every phase holds.
     *
     * @var list<string>
     */
    public const array SECTION_KEYS = ['items', 'gems', 'tree'];

    /**
     * The reserved section key used when tabs are switched off (mode "single"): the
     * whole plan then has one set of sections under this id instead of one per tab.
     */
    public const string SINGLE_KEY = 'single';

    /**
     * @var list<string>
     */
    public const array MODES = ['phases', 'single'];

    /**
     * @var list<string>
     */
    public const array GEM_KINDS = ['active', 'support'];

    /**
     * @var list<string>
     */
    public const array ATTRIBUTES = ['str', 'dex', 'int'];

    /**
     * Rarities an equipment item may have (a unique carries a unique ref, the rest a
     * base-type ref plus author-typed mod lines).
     *
     * @var list<string>
     */
    public const array ITEM_RARITIES = ['normal', 'magic', 'rare', 'unique'];

    /** Most author-typed modifier lines an item may carry. */
    private const int MAX_ITEM_STATS = 20;

    /** Most rune sockets an item may carry (a corrupted weapon/body: 3 natural + 1 Vaal). */
    private const int MAX_ITEM_SOCKETS = 4;

    /**
     * Highest item level the game produces - a character/monster tops out at 100, and
     * PoB's PoE2 affix data bottoms out its highest tiers at required level 100. Item
     * level (req.level) is validated against this on save and on editor close.
     */
    public const int MAX_ITEM_LEVEL = 100;

    /**
     * The requirement keys an item shows. Only the level requirement is authored now -
     * an item's attribute cost isn't part of build planning, so str/dex/int were dropped
     * in favour of the defensive {@see ITEM_PROP_KEYS} the paper-doll actually reasons about.
     *
     * @var list<string>
     */
    private const array ITEM_REQ_KEYS = ['level'];

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
     * Equipment slots the items paper-doll fills, each holding one item reference.
     *
     * @var list<string>
     */
    public const array EQUIPMENT_SLOTS = [
        'weapon1', 'weapon2', 'helmet', 'amulet', 'body',
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
    public const int MAX_PRIORITY = 15;

    /**
     * Per-slot rune-socket ceiling. Weapons and body armour take the most, smaller
     * armour fewer; jewellery and belts take none. Each cap is the natural maximum
     * plus the one socket a Vaal corruption can add. Mirrors the client's
     * SLOT_MAX_SOCKETS so a forged payload can't exceed what the paper-doll allows.
     *
     * @var array<string, int>
     */
    public const array SLOT_MAX_SOCKETS = [
        'weapon1' => 4, 'weapon2' => 4, 'body' => 4,
        'helmet' => 3, 'gloves' => 3, 'boots' => 3,
        'belt' => 0, 'amulet' => 0, 'ring1' => 0, 'ring2' => 0,
        'flask1' => 0, 'flask2' => 0,
        'charm1' => 0, 'charm2' => 0, 'charm3' => 0,
    ];

    /** Upper bound on allocated passive nodes stored per phase tree. */
    private const int MAX_ALLOCATED = 600;

    /** A build runs at most 12 skill gems (one per group). */
    private const int MAX_GEM_GROUPS = 12;

    /** One active skill plus its 5 support gems - the in-game per-skill support cap. */
    private const int MAX_GEMS_PER_GROUP = 6;

    private const int MAX_ENTRIES_PER_SECTION = 200;

    public const int MAX_CUSTOM_TABS = 4;

    /**
     * A blank plan: no description, phase mode, only the first phase ("Act I") and an
     * empty set of sections (plus the single-mode set, so toggling loses nothing).
     *
     * @return array<string, mixed>
     */
    public static function blank(): array
    {
        return self::canonicalize([
            'description' => '',
            'mode' => 'phases',
            'tabs' => self::initialTabs(),
            'sections' => [],
        ]);
    }

    /**
     * The six base tabs, each stamped with kind "base".
     *
     * @return list<array{id: string, label: string, kind: string}>
     */
    public static function baseTabs(): array
    {
        return array_map(
            static fn (array $tab): array => ['id' => $tab['id'], 'label' => $tab['label'], 'kind' => 'base'],
            self::BASE_TABS,
        );
    }

    /**
     * The tabs a brand-new plan opens with: only the first phase ("Act I"). Further
     * phases are revealed one at a time via "Add phase", each copying the previous
     * phase's data on the client.
     *
     * @return list<array{id: string, label: string, kind: string}>
     */
    public static function initialTabs(): array
    {
        return [self::baseTabs()[0]];
    }

    /**
     * @return list<string>
     */
    public static function baseTabIds(): array
    {
        return array_column(self::BASE_TABS, 'id');
    }

    /**
     * Bring a stored blob up to {@see CURRENT_VERSION}, then canonicalise it. Older
     * rows are stepped forward one version at a time; the result is always a clean,
     * fully-populated current-shape plan safe to render.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function normalize(array $data, int $fromVersion): array
    {
        $version = max(1, $fromVersion);
        $upgraders = self::upgraders();

        // Step the blob forward one version at a time through whatever upgraders
        // sit above its stored version. Empty today (v1 is current); each future
        // schema bump adds one entry here.
        while (isset($upgraders[$version])) {
            $data = $upgraders[$version]($data);
            $version++;
        }

        return self::canonicalize($data);
    }

    /**
     * Ordered upgrade steps keyed by the from-version they migrate: entry N takes a
     * vN blob to v(N+1). Add one whenever {@see CURRENT_VERSION} is bumped - never
     * rewrite an existing step, so an ancient row still walks the whole chain.
     *
     * @return array<int, callable(array<string, mixed>): array<string, mixed>>
     */
    private static function upgraders(): array
    {
        // Empty until the app ships and has real stored plans. The shape still evolves
        // freely during development - canonicalize() fills any missing keys - so there
        // is nothing to migrate yet. The first post-launch shape change adds a step
        // here (and bumps CURRENT_VERSION) to migrate real production rows.
        return [];
    }

    /**
     * Repair any plan blob into the canonical current shape: force the base-tab
     * prefix, keep only custom tabs after it, guarantee a section set for every tab
     * (and for single mode), drop orphaned sections, and normalise every entry with
     * its priority recomputed from list order.
     *
     * @param  array<string, mixed>  $data
     * @return array{description: string, mode: string, build: array{className: ?string, ascendId: ?string}, tabs: list<array{id: string, label: string, kind: string}>, sections: array<string, array<string, mixed>>}
     */
    public static function canonicalize(array $data): array
    {
        $mode = in_array($data['mode'] ?? null, self::MODES, true) ? (string) $data['mode'] : 'phases';
        $tabs = self::canonicalTabs(is_array($data['tabs'] ?? null) ? $data['tabs'] : []);
        $rawSections = is_array($data['sections'] ?? null) ? $data['sections'] : [];

        // A section set for every tab plus the reserved single-mode key; anything
        // else (e.g. a removed custom tab's leftovers) is dropped.
        $keepKeys = [...array_column($tabs, 'id'), self::SINGLE_KEY];
        $sections = [];

        foreach ($keepKeys as $key) {
            $sections[$key] = self::canonicalSection(is_array($rawSections[$key] ?? null) ? $rawSections[$key] : []);
        }

        return [
            'description' => is_string($data['description'] ?? null) ? $data['description'] : '',
            'mode' => $mode,
            'build' => self::canonicalBuild(is_array($data['build'] ?? null) ? $data['build'] : []),
            'tabs' => $tabs,
            'sections' => $sections,
        ];
    }

    /**
     * The build-level class + ascendancy (one per plan), or nulls when unset.
     *
     * @param  array<int|string, mixed>  $build
     * @return array{className: ?string, ascendId: ?string}
     */
    private static function canonicalBuild(array $build): array
    {
        return [
            'className' => is_string($build['className'] ?? null) && $build['className'] !== '' ? $build['className'] : null,
            'ascendId' => is_string($build['ascendId'] ?? null) && $build['ascendId'] !== '' ? $build['ascendId'] : null,
        ];
    }

    /**
     * The visual gem groups: an ordered list of groups, each an ordered list of gem
     * references (the first is the active skill, the rest its supports). Malformed
     * gems and empty groups are dropped.
     *
     * @param  array<int|string, mixed>  $groups
     * @return list<array{id: string, gems: list<array{type: string, id: string}>}>
     */
    private static function canonicalGemGroups(array $groups): array
    {
        $result = [];

        foreach (array_slice(array_values($groups), 0, self::MAX_GEM_GROUPS) as $index => $group) {
            if (! is_array($group)) {
                continue;
            }

            $gems = [];
            $rawGems = is_array($group['gems'] ?? null) ? $group['gems'] : [];

            foreach (array_slice(array_values($rawGems), 0, self::MAX_GEMS_PER_GROUP) as $gem) {
                if (is_array($gem) && ($gem['type'] ?? null) === 'gem' && is_string($gem['id'] ?? null) && $gem['id'] !== '') {
                    $gems[] = ['type' => 'gem', 'id' => $gem['id']];
                }
            }

            if ($gems === []) {
                continue;
            }

            $id = $group['id'] ?? null;
            $result[] = [
                'id' => is_string($id) && $id !== '' ? $id : 'g-'.($index + 1),
                'gems' => $gems,
            ];
        }

        return $result;
    }

    /**
     * The equipment slot map: known slot => an item (rarity, base/unique ref, attribute
     * requirements, author mod references and rune sockets). Empty items and unknown
     * slots are dropped.
     *
     * @param  array<int|string, mixed>  $slots
     * @return array<string, array{rarity: string, base: array{type: string, id: string}|null, req: array{level: int}, props: array{quality: int, armour: int, evasion: int, energyShield: int, block: int}, stats: list<array{modId: string, values: list<int|float>}>, sockets: list<array{type: string, id: string}|null>, priority: int|null}>
     */
    private static function canonicalSlots(array $slots): array
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
     * Coerce one equipment item; returns null when it carries nothing (no base ref,
     * no mod lines and no runes).
     *
     * @param  array<string, mixed>  $entry
     * @return array{rarity: string, base: array{type: string, id: string}|null, req: array{level: int}, props: array{quality: int, armour: int, evasion: int, energyShield: int, block: int}, stats: list<array{modId: string, values: list<int|float>}>, sockets: list<array{type: string, id: string}|null>, priority: int|null}|null
     */
    private static function canonicalItem(array $entry): ?array
    {
        $rarity = $entry['rarity'] ?? null;
        $rarity = in_array($rarity, self::ITEM_RARITIES, true) ? (string) $rarity : 'rare';

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

        $sockets = self::canonicalSockets(is_array($entry['sockets'] ?? null) ? $entry['sockets'] : []);
        $props = self::canonicalProps(is_array($entry['props'] ?? null) ? $entry['props'] : []);

        if ($base === null && $stats === [] && $sockets === [] && array_sum($props) === 0) {
            return null;
        }

        $rawPriority = $entry['priority'] ?? null;
        $priority = is_numeric($rawPriority) && (int) $rawPriority >= 1 && (int) $rawPriority <= self::MAX_PRIORITY
            ? (int) $rawPriority
            : null;

        return [
            'rarity' => $rarity,
            'base' => $base,
            'req' => self::canonicalReq(is_array($entry['req'] ?? null) ? $entry['req'] : []),
            'props' => $props,
            'stats' => $stats,
            'sockets' => $sockets,
            'priority' => $priority,
        ];
    }

    /**
     * Shape-level validation messages for one authored equipment item, empty when it is
     * legal. These mirror the paper-doll's own limits so a forged payload can't bypass
     * what the UI already prevents: sockets within the slot's ceiling (jewellery/belts
     * take none) and a unique carrying neither author-typed modifiers nor requirements
     * (its real stats come from the GGPK unique it references). The affix rules that need
     * the GGPK mod catalogue (per-rarity prefix/suffix counts, families, value ranges,
     * base compatibility) live in {@see ModCatalogue::modErrors}.
     *
     * @param  array<string, mixed>  $item
     * @return list<string>
     */
    public static function itemErrors(string $slot, array $item): array
    {
        $errors = [];
        $stats = is_array($item['stats'] ?? null) ? array_values($item['stats']) : [];
        $sockets = is_array($item['sockets'] ?? null) ? $item['sockets'] : [];
        $req = is_array($item['req'] ?? null) ? $item['req'] : [];
        $props = is_array($item['props'] ?? null) ? $item['props'] : [];

        $level = $req['level'] ?? 0;

        if (is_numeric($level) && (int) $level > self::MAX_ITEM_LEVEL) {
            $errors[] = 'Item level cannot exceed '.self::MAX_ITEM_LEVEL.'.';
        }

        $quality = $props['quality'] ?? 0;

        if (is_numeric($quality) && (int) $quality > self::MAX_ITEM_QUALITY) {
            $errors[] = 'Quality cannot exceed '.self::MAX_ITEM_QUALITY.'%.';
        }

        if (($item['rarity'] ?? null) === 'rare' && in_array($slot, self::NO_RARE_SLOTS, true)) {
            $errors[] = 'A flask or charm cannot be rare.';
        }

        $maxSockets = self::SLOT_MAX_SOCKETS[$slot] ?? 0;

        // A unique can carry more sockets than its slot's rares (Greymake and The
        // Bringer of Rain wear four on a helmet), so uniques take the global ceiling.
        if (($item['rarity'] ?? null) === 'unique' && $maxSockets > 0) {
            $maxSockets = self::MAX_ITEM_SOCKETS;
        }

        if (count($sockets) > $maxSockets) {
            $errors[] = $maxSockets === 0
                ? 'This slot cannot hold rune sockets.'
                : "This slot holds at most {$maxSockets} rune sockets.";
        }

        // A unique's modifiers are fixed by the unique itself, so the author adds none.
        // Its level requirement and defensive properties are legitimate to record though
        // (the planner holds no base defence data - typing them is the only way to plan a
        // unique's armour/ES), so those are not rejected here.
        if (($item['rarity'] ?? null) === 'unique' && $stats !== []) {
            $errors[] = 'A unique item carries its own modifiers and cannot add more.';
        }

        return $errors;
    }

    /**
     * Coerce an item's level requirement: a non-negative int (0 = the line is hidden).
     *
     * @param  array<string, mixed>  $req
     * @return array{level: int}
     */
    private static function canonicalReq(array $req): array
    {
        $result = [];

        foreach (self::ITEM_REQ_KEYS as $key) {
            $value = $req[$key] ?? 0;
            $result[$key] = is_numeric($value) ? max(0, (int) $value) : 0;
        }

        return $result;
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
     * Coerce one modifier: a reference to a GGPK affix (`Mods.Id`) plus the author's
     * rolled values (one per range in the tier). The wording, ranges and generation
     * type are resolved live from {@see ModCatalogue}, so only the id and the
     * values are stored. Returns null when there is no mod id.
     *
     * @return array{modId: string, values: list<int|float>}|null
     */
    private static function canonicalMod(mixed $stat): ?array
    {
        if (! is_array($stat)) {
            return null;
        }

        $modId = is_string($stat['modId'] ?? null) ? trim((string) $stat['modId']) : '';

        if ($modId === '') {
            return null;
        }

        $values = [];
        $rawValues = is_array($stat['values'] ?? null) ? $stat['values'] : [];

        foreach (array_slice(array_values($rawValues), 0, 8) as $value) {
            if (is_int($value) || is_float($value)) {
                $values[] = $value;
            } elseif (is_string($value) && is_numeric($value)) {
                $values[] = $value + 0;
            }
        }

        return ['modId' => mb_substr($modId, 0, 120), 'values' => $values];
    }

    /**
     * A phase's passive-tree allocation: the allocated node ids plus the choices the
     * renderer replays (per-node attributes, weapon sets, jewels) and the tree
     * version. Ids are coerced to clean integer lists; unknown extras are dropped.
     *
     * @param  array<int|string, mixed>  $allocation
     * @return array{allocated: list<int>, attributeChoices: array<int, string>, weaponSets: array<int, int>, jewels: array<int|string, mixed>, treeVersion: ?string}
     */
    private static function canonicalAllocation(array $allocation): array
    {
        $allocated = is_array($allocation['allocated'] ?? null)
            ? array_values(array_slice(array_map(intval(...), $allocation['allocated']), 0, self::MAX_ALLOCATED))
            : [];

        $attributeChoices = [];

        if (is_array($allocation['attributeChoices'] ?? null)) {
            foreach ($allocation['attributeChoices'] as $node => $attribute) {
                if (in_array($attribute, self::ATTRIBUTES, true)) {
                    $attributeChoices[(int) $node] = (string) $attribute;
                }
            }
        }

        $weaponSets = [];

        if (is_array($allocation['weaponSets'] ?? null)) {
            foreach ($allocation['weaponSets'] as $node => $set) {
                if (in_array((int) $set, [1, 2], true)) {
                    $weaponSets[(int) $node] = (int) $set;
                }
            }
        }

        return [
            'allocated' => $allocated,
            'attributeChoices' => $attributeChoices,
            'weaponSets' => $weaponSets,
            'jewels' => is_array($allocation['jewels'] ?? null) ? $allocation['jewels'] : [],
            'treeVersion' => is_string($allocation['treeVersion'] ?? null) && $allocation['treeVersion'] !== '' ? $allocation['treeVersion'] : null,
        ];
    }

    /**
     * The passive-tree priority: notable/keystone ids in the author's take order.
     * Coerced to a unique integer list and capped. The client reconciles it against the
     * live allocation on render, so a stale id here is harmless (dropped on display).
     *
     * @param  array<mixed>  $priority
     * @return list<int>
     */
    private static function canonicalNotablePriority(array $priority): array
    {
        return array_values(array_slice(
            array_unique(array_map(intval(...), $priority)),
            0,
            self::MAX_ALLOCATED,
        ));
    }

    /**
     * Validate a submitted tabs list against the immutable-base-tabs rule. Returns
     * the first violation message, or null when the list is well-formed: a leading
     * prefix of the base tabs (at least "Act I"), unchanged and in order, optionally
     * followed by custom tabs.
     *
     * @param  mixed  $tabs
     */
    public static function tabsError($tabs): ?string
    {
        if (! is_array($tabs)) {
            return 'The tabs list is malformed.';
        }

        $tabs = array_values($tabs);
        $base = self::baseTabs();

        if ($tabs === []) {
            return 'At least the first phase must be present.';
        }

        // The base tabs present must be a leading prefix of the fixed list - in order,
        // no gaps, none renamed - starting at "Act I". Later phases are revealed one at
        // a time, so a plan may hold just "Act I", or "Act I".."Act III", etc.
        $baseCount = 0;

        foreach ($tabs as $index => $tab) {
            if (! is_array($tab)) {
                return 'The tabs list is malformed.';
            }

            if (($tab['kind'] ?? null) !== 'base') {
                break;
            }

            $expected = $base[$baseCount] ?? null;

            if ($index !== $baseCount || $expected === null || ($tab['id'] ?? null) !== $expected['id'] || ($tab['label'] ?? null) !== $expected['label']) {
                return 'The base phase tabs must be a leading prefix of the fixed list, in order.';
            }

            $baseCount++;
        }

        if ($baseCount < 1 || ($tabs[0]['id'] ?? null) !== $base[0]['id']) {
            return '"Act I" must be the first phase.';
        }

        // Everything after the base prefix must be a well-formed custom tab.
        $customTabs = array_slice($tabs, $baseCount);

        if (count($customTabs) > self::MAX_CUSTOM_TABS) {
            return 'Too many custom tabs.';
        }

        $seen = self::baseTabIds();

        foreach ($customTabs as $tab) {
            if (! is_array($tab) || ($tab['kind'] ?? null) !== 'custom') {
                return 'A custom tab is malformed or placed before "Early Endgame".';
            }

            $id = $tab['id'] ?? null;
            $label = $tab['label'] ?? null;

            if (! is_string($id) || $id === '' || ! is_string($label) || trim($label) === '') {
                return 'Every custom tab needs a name.';
            }

            if (in_array($id, $seen, true)) {
                return 'Custom tabs must have distinct ids.';
            }

            $seen[] = $id;
        }

        return null;
    }

    /**
     * Force a tabs list into canonical form: the leading prefix of base tabs the blob
     * carries (in fixed order, no gaps, at least "Act I") followed by any well-formed
     * custom tabs, de-duplicated. Used on the read path where the blob is
     * trusted-but-verified rather than freshly validated.
     *
     * @param  array<int|string, mixed>  $tabs
     * @return list<array{id: string, label: string, kind: string}>
     */
    private static function canonicalTabs(array $tabs): array
    {
        $present = [];

        foreach (array_values($tabs) as $tab) {
            if (is_array($tab) && is_string($tab['id'] ?? null)) {
                $present[$tab['id']] = true;
            }
        }

        // Keep base tabs as a leading prefix: stop at the first one the blob omits, so
        // a gap (e.g. Act III without Act II) can never resurrect a skipped phase.
        $canonical = [];

        foreach (self::baseTabs() as $baseTab) {
            if (! isset($present[$baseTab['id']])) {
                break;
            }

            $canonical[] = $baseTab;
        }

        // Every plan keeps at least the first phase.
        if ($canonical === []) {
            $canonical[] = self::baseTabs()[0];
        }

        $seen = array_column($canonical, 'id');
        $customCount = 0;

        foreach (array_values($tabs) as $tab) {
            if ($customCount >= self::MAX_CUSTOM_TABS) {
                break;
            }

            if (! is_array($tab) || ($tab['kind'] ?? null) !== 'custom') {
                continue;
            }

            $id = $tab['id'] ?? null;
            $label = $tab['label'] ?? null;

            if (! is_string($id) || $id === '' || in_array($id, $seen, true) || ! is_string($label) || trim($label) === '') {
                continue;
            }

            $canonical[] = ['id' => $id, 'label' => trim($label), 'kind' => 'custom'];
            $seen[] = $id;
            $customCount++;
        }

        return $canonical;
    }

    /**
     * Normalise one phase's three groups.
     *
     * @param  array<int|string, mixed>  $section
     * @return array<string, array<string, mixed>>
     */
    private static function canonicalSection(array $section): array
    {
        $result = [];

        foreach (self::SECTION_KEYS as $key) {
            $group = is_array($section[$key] ?? null) ? $section[$key] : [];
            $entries = is_array($group['entries'] ?? null) ? array_values($group['entries']) : [];

            $result[$key] = [
                'notes' => is_string($group['notes'] ?? null) ? $group['notes'] : '',
                'entries' => self::canonicalEntries($entries, $key),
            ];

            // Only the tree group carries a visual passive-tree allocation and the
            // notable priority the author built from it.
            if ($key === 'tree') {
                $result[$key]['allocation'] = self::canonicalAllocation(
                    is_array($group['allocation'] ?? null) ? $group['allocation'] : [],
                );
                $result[$key]['notablePriority'] = self::canonicalNotablePriority(
                    is_array($group['notablePriority'] ?? null) ? $group['notablePriority'] : [],
                );
            }

            // Only the items group carries the equipment paper-doll's slots.
            if ($key === 'items') {
                $result[$key]['slots'] = self::canonicalSlots(
                    is_array($group['slots'] ?? null) ? $group['slots'] : [],
                );
            }

            // Only the gems group carries the visual gem groups (skill + supports).
            if ($key === 'gems') {
                $result[$key]['groups'] = self::canonicalGemGroups(
                    is_array($group['groups'] ?? null) ? $group['groups'] : [],
                );
            }
        }

        return $result;
    }

    /**
     * Coerce a group's entries and recompute their priority from list order (1..n):
     * the array order the author arranged is the priority.
     *
     * @param  list<mixed>  $entries
     * @return list<array<string, mixed>>
     */
    private static function canonicalEntries(array $entries, string $sectionKey): array
    {
        $result = [];

        foreach (array_slice($entries, 0, self::MAX_ENTRIES_PER_SECTION) as $index => $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $id = $entry['id'] ?? null;
            $clean = [
                'id' => is_string($id) && $id !== '' ? $id : 'e-'.($index + 1),
                'name' => is_string($entry['name'] ?? null) ? $entry['name'] : '',
                'note' => is_string($entry['note'] ?? null) ? $entry['note'] : '',
                'priority' => count($result) + 1,
            ];

            if ($sectionKey === 'gems') {
                $clean['kind'] = in_array($entry['kind'] ?? null, self::GEM_KINDS, true) ? (string) $entry['kind'] : 'active';
            }

            $result[] = $clean;
        }

        return $result;
    }
}
