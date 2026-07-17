<?php

declare(strict_types=1);

namespace App\Support\Planner;

/**
 * The plan's phase tabs and their immutable-base-prefix rule: a plan always opens
 * with the fixed base phases in order (at least "Act I"), and custom tabs may only
 * follow the last base tab present - a guide author can neither reorder the base
 * phases nor slip a tab between them.
 */
final class PlanTabs
{
    /**
     * The fixed base phases, in their immutable display order.
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

    public const int MAX_CUSTOM_TABS = 4;

    /**
     * The six base tabs, each stamped with kind "base".
     *
     * @return list<array{id: string, label: string, kind: string}>
     */
    public static function base(): array
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
    public static function initial(): array
    {
        return [self::base()[0]];
    }

    /**
     * @return list<string>
     */
    public static function baseIds(): array
    {
        return array_column(self::BASE_TABS, 'id');
    }

    /**
     * Validate a submitted tabs list against the immutable-base-tabs rule. Returns
     * the first violation message, or null when the list is well-formed: a leading
     * prefix of the base tabs (at least "Act I"), unchanged and in order, optionally
     * followed by custom tabs.
     */
    public static function error(mixed $tabs): ?string
    {
        if (! is_array($tabs)) {
            return 'The tabs list is malformed.';
        }

        $tabs = array_values($tabs);
        $base = self::base();

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

        $seen = self::baseIds();

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
    public static function canonical(array $tabs): array
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

        foreach (self::base() as $baseTab) {
            if (! isset($present[$baseTab['id']])) {
                break;
            }

            $canonical[] = $baseTab;
        }

        // Every plan keeps at least the first phase.
        if ($canonical === []) {
            $canonical[] = self::base()[0];
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
}
