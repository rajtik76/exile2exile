<?php

declare(strict_types=1);

namespace App\Support\Planner;

use App\Models\BuildPlan;
use App\Tree\TreeAllocation;

/**
 * The single source of truth for a build plan's stored JSON shape.
 *
 * A plan's whole guide lives in one JSON blob ({@see BuildPlan::$data}).
 * This class owns that shape: the empty-plan template, the per-version upgrade path,
 * and the canonicaliser that repairs and normalises any blob before it is stored or
 * rendered. The phase-tab rules live in {@see PlanTabs} and the equipped-item shape
 * in {@see PlanItemSchema}; their public constants are re-exported here so callers
 * keep one schema entry point.
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
    public const int CURRENT_VERSION = 2;

    /**
     * The fixed base phases, in their immutable display order (see {@see PlanTabs}).
     *
     * @var list<array{id: string, label: string}>
     */
    public const array BASE_TABS = PlanTabs::BASE_TABS;

    public const int MAX_CUSTOM_TABS = PlanTabs::MAX_CUSTOM_TABS;

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
    public const array ATTRIBUTES = TreeAllocation::ATTRIBUTES;

    /**
     * The equipped-item shape's limits, re-exported from {@see PlanItemSchema}.
     *
     * @var list<string>
     */
    public const array ITEM_RARITIES = PlanItemSchema::ITEM_RARITIES;

    public const int MAX_ITEM_NAME_LENGTH = PlanItemSchema::MAX_ITEM_NAME_LENGTH;

    /** @var list<string> */
    public const array ITEM_PROP_KEYS = PlanItemSchema::ITEM_PROP_KEYS;

    /** @var list<string> */
    public const array ITEM_DEFENCE_KEYS = PlanItemSchema::ITEM_DEFENCE_KEYS;

    public const int MAX_ITEM_QUALITY = PlanItemSchema::MAX_ITEM_QUALITY;

    /** @var list<string> */
    public const array EQUIPMENT_SLOTS = PlanItemSchema::EQUIPMENT_SLOTS;

    /** @var list<string> */
    public const array NO_RARE_SLOTS = PlanItemSchema::NO_RARE_SLOTS;

    public const int MAX_PRIORITY = PlanItemSchema::MAX_PRIORITY;

    /** @var array<string, int> */
    public const array SLOT_MAX_SOCKETS = PlanItemSchema::SLOT_MAX_SOCKETS;

    /** Upper bound on allocated passive nodes stored per phase tree. */
    private const int MAX_ALLOCATED = TreeAllocation::MAX_NODES;

    /** A build runs at most 12 skill gems (one per group). */
    private const int MAX_GEM_GROUPS = 12;

    /** One active skill plus its 5 support gems - the in-game per-skill support cap. */
    private const int MAX_GEMS_PER_GROUP = 6;

    private const int MAX_ENTRIES_PER_SECTION = 200;

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
        return PlanTabs::base();
    }

    /**
     * The tabs a brand-new plan opens with: only the first phase ("Act I").
     *
     * @return list<array{id: string, label: string, kind: string}>
     */
    public static function initialTabs(): array
    {
        return PlanTabs::initial();
    }

    /**
     * @return list<string>
     */
    public static function baseTabIds(): array
    {
        return PlanTabs::baseIds();
    }

    /**
     * Validate a submitted tabs list against the immutable-base-tabs rule (see
     * {@see PlanTabs::error}). Returns the first violation message, or null.
     */
    public static function tabsError(mixed $tabs): ?string
    {
        return PlanTabs::error($tabs);
    }

    /**
     * Shape-level validation messages for one authored equipment item, empty when it
     * is legal (see {@see PlanItemSchema::itemErrors}).
     *
     * @param  array<string, mixed>  $item
     * @return list<string>
     */
    public static function itemErrors(string $slot, array $item): array
    {
        return PlanItemSchema::itemErrors($slot, $item);
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
        // sit above its stored version.
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
        return [
            // v1 -> v2: dropped the author-typed "item level" (req.level) - it never
            // tracked anything real (no requirement/level distinction existed), and
            // duplicated as a mislabeled "Item Level" line in the tooltip. Strip the
            // retired key from every item slot; canonicalize() no longer reads it.
            1 => function (array $data): array {
                $sections = is_array($data['sections'] ?? null) ? $data['sections'] : [];

                foreach ($sections as $sectionKey => $section) {
                    $slots = is_array($section['items']['slots'] ?? null) ? $section['items']['slots'] : [];

                    foreach ($slots as $slotKey => $slot) {
                        if (is_array($slot)) {
                            unset($sections[$sectionKey]['items']['slots'][$slotKey]['req']);
                        }
                    }
                }

                $data['sections'] = $sections;

                return $data;
            },
        ];
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
        $tabs = PlanTabs::canonical(is_array($data['tabs'] ?? null) ? $data['tabs'] : []);
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
     * A phase's passive-tree allocation: the same shape every tree surface uses,
     * repaired by {@see TreeAllocation::fromArray()} (integer node ids, whitelisted
     * attribute choices and weapon sets, unknown extras dropped).
     *
     * @param  array<int|string, mixed>  $allocation
     * @return array{allocated: list<int>, attributeChoices: array<int, string>, weaponSets: array<int, int>, jewels: array<int|string, mixed>, treeVersion: ?string}
     */
    private static function canonicalAllocation(array $allocation): array
    {
        return TreeAllocation::fromArray($allocation)->toArray();
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
                $result[$key]['slots'] = PlanItemSchema::canonicalSlots(
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
