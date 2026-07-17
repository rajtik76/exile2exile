<?php

declare(strict_types=1);

namespace App\Support\Planner;

use App\Pob\IconResolver;
use App\Pob\ModCatalogue;

/**
 * Finds and resolves the inline reference tokens embedded in a plan's Markdown
 * texts. A token - `{{type:id|Display Name}}` - points at a gem, rune or (later)
 * unique item; this collects the ones a plan uses and resolves them to display data
 * (name, icon, tooltip) so the viewer can render them as chips. All catalogue data
 * comes from {@see IconResolver} (GGPK only).
 */
final class PlanReferences
{
    /**
     * Matches an inline reference token: type, catalogue id, and a plain-text
     * fallback name. Ids can't contain the delimiters, keeping the match unambiguous.
     */
    public const string TOKEN_PATTERN = '/\{\{(gem|rune|unique):([^|{}]+)\|([^{}]*)\}\}/';

    /**
     * The distinct "type:id" references a plan's texts contain, across the build
     * description and every section's notes.
     *
     * @param  array<string, mixed>  $planData
     * @return list<array{type: string, id: string}>
     */
    public static function collect(array $planData): array
    {
        $seen = [];
        $refs = [];

        $add = static function (string $type, string $id) use (&$seen, &$refs): void {
            $key = $type.':'.$id;

            if (! isset($seen[$key])) {
                $seen[$key] = true;
                $refs[] = ['type' => $type, 'id' => $id];
            }
        };

        foreach (self::texts($planData) as $text) {
            if (preg_match_all(self::TOKEN_PATTERN, $text, $matches, PREG_SET_ORDER) === false) {
                continue;
            }

            foreach ($matches as $match) {
                $add($match[1], $match[2]);
            }
        }

        // Equipment slots and gem groups hold the same {type, id} references.
        foreach (self::slotReferences($planData) as $ref) {
            $add($ref['type'], $ref['id']);
        }

        foreach (self::gemGroupReferences($planData) as $ref) {
            $add($ref['type'], $ref['id']);
        }

        return $refs;
    }

    /**
     * Every gem reference sitting in a visual gem group across the plan's phases.
     *
     * @param  array<string, mixed>  $planData
     * @return list<array{type: string, id: string}>
     */
    private static function gemGroupReferences(array $planData): array
    {
        $refs = [];
        $sections = is_array($planData['sections'] ?? null) ? $planData['sections'] : [];

        foreach ($sections as $section) {
            $groups = is_array($section['gems']['groups'] ?? null) ? $section['gems']['groups'] : [];

            foreach ($groups as $group) {
                $gems = is_array($group['gems'] ?? null) ? $group['gems'] : [];

                foreach ($gems as $gem) {
                    if (is_array($gem) && is_string($gem['type'] ?? null) && is_string($gem['id'] ?? null)) {
                        $refs[] = ['type' => $gem['type'], 'id' => $gem['id']];
                    }
                }
            }
        }

        return $refs;
    }

    /**
     * Every item reference sitting in an equipment slot across the plan's phases.
     *
     * @param  array<string, mixed>  $planData
     * @return list<array{type: string, id: string}>
     */
    private static function slotReferences(array $planData): array
    {
        $refs = [];
        $sections = is_array($planData['sections'] ?? null) ? $planData['sections'] : [];

        foreach ($sections as $section) {
            $slots = is_array($section['items']['slots'] ?? null) ? $section['items']['slots'] : [];

            foreach ($slots as $slot) {
                // Each slot holds an item whose base/unique ref drives the icon.
                $base = is_array($slot['base'] ?? null) ? $slot['base'] : null;

                if ($base !== null && is_string($base['type'] ?? null) && is_string($base['id'] ?? null)) {
                    $refs[] = ['type' => $base['type'], 'id' => $base['id']];
                }

                // Rune sockets hold rune references.
                foreach (is_array($slot['sockets'] ?? null) ? $slot['sockets'] : [] as $socket) {
                    if (is_array($socket) && is_string($socket['type'] ?? null) && is_string($socket['id'] ?? null)) {
                        $refs[] = ['type' => $socket['type'], 'id' => $socket['id']];
                    }
                }
            }
        }

        return $refs;
    }

    /**
     * Resolve every reference a plan uses to its display data, keyed by "type:id".
     * Unknown or unsupported references are omitted - the viewer falls back to the
     * token's embedded name.
     *
     * @param  array<string, mixed>  $planData
     * @return array<string, array{type: string, id: string, name: string, icon: ?string, category: ?string, tooltip: ?string, hoverImage?: ?string, scaling?: array{name: string, levels: list<array{level: int, cost: ?int, castTime: ?float, cooldown: ?float, reservation: ?float, spellCritChance: ?float, attackCritChance: ?float, stats: list<array{text: string, min: float, max: float}>}>, qualityStats: list<array{text: string, min: float, max: float}>}|null, requires?: array{level: array{int, int}, str: array{int, int}|null, dex: array{int, int}|null, int: array{int, int}|null}|null, armour?: array{armour: int, evasion: int, energyShield: int, ward: int, block: int}|null, weapon?: array{damageMin: int, damageMax: int, critical: int, attackTime: int, rangeMax: int, reloadTime: int}|null, spirit?: int, levelRequirement?: ?int}>
     */
    public static function resolveMap(array $planData, IconResolver $icons): array
    {
        $map = [];

        foreach (self::collect($planData) as $ref) {
            $resolved = $icons->resolveReference($ref['type'], $ref['id']);

            if ($resolved !== null) {
                $map[$ref['type'].':'.$ref['id']] = $resolved;
            }
        }

        return $map;
    }

    /**
     * Resolve every equipment modifier a plan uses to its live display data (tier line,
     * ranges, generation type), keyed by mod id. The viewer renders each stored affix from
     * this; unknown ids are omitted. Only the `Mods.Id` and rolled values are persisted.
     *
     * @param  array<string, mixed>  $planData
     * @return array<string, array{id: string, name: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>
     */
    public static function resolveModMap(array $planData, ModCatalogue $catalogue): array
    {
        $map = [];

        foreach (self::modIds($planData) as $modId) {
            $mod = $catalogue->resolve($modId);

            if ($mod !== null) {
                $map[$modId] = $mod;
            }
        }

        return $map;
    }

    /**
     * The distinct modifier ids (`Mods.Id`) sitting in a plan's equipment slots.
     *
     * @param  array<string, mixed>  $planData
     * @return list<string>
     */
    private static function modIds(array $planData): array
    {
        $seen = [];
        $sections = is_array($planData['sections'] ?? null) ? $planData['sections'] : [];

        foreach ($sections as $section) {
            $slots = is_array($section['items']['slots'] ?? null) ? $section['items']['slots'] : [];

            foreach ($slots as $slot) {
                $stats = is_array($slot['stats'] ?? null) ? $slot['stats'] : [];

                foreach ($stats as $stat) {
                    if (is_array($stat) && is_string($stat['modId'] ?? null) && $stat['modId'] !== '') {
                        $seen[$stat['modId']] = true;
                    }
                }
            }
        }

        return array_keys($seen);
    }

    /**
     * Every Markdown text field in a plan: the build description plus each section's
     * notes across all tabs.
     *
     * @param  array<string, mixed>  $planData
     * @return list<string>
     */
    private static function texts(array $planData): array
    {
        $texts = [];

        if (is_string($planData['description'] ?? null)) {
            $texts[] = $planData['description'];
        }

        $sections = is_array($planData['sections'] ?? null) ? $planData['sections'] : [];

        foreach ($sections as $section) {
            if (! is_array($section)) {
                continue;
            }

            foreach ($section as $group) {
                if (is_array($group) && is_string($group['notes'] ?? null)) {
                    $texts[] = $group['notes'];
                }
            }
        }

        return $texts;
    }
}
