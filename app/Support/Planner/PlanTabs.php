<?php

declare(strict_types=1);

namespace App\Support\Planner;

/**
 * The plan's phase tabs. The six base phases (Act I..Early Endgame) are optional,
 * freely orderable and renameable - a guide author picks which ones to use, arranges
 * them however they like, and can rename any of them, alongside up to
 * {@see MAX_CUSTOM_TABS} custom tabs. Only a base tab's id is fixed (it still means
 * the same phase and drives the fixed act order "Add phase" suggests next); its
 * label and position are not.
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
     * Validate a submitted tabs list. Returns the first violation message, or null
     * when the list is well-formed: at least one tab, each either a base tab (a known
     * id from {@see BASE_TABS}, any non-empty label) or a well-formed custom tab, all
     * ids distinct, custom tabs within {@see MAX_CUSTOM_TABS}. Base tabs may be any
     * subset of the fixed list, in any order and under any name - the author picks,
     * arranges and renames phases freely.
     */
    public static function error(mixed $tabs): ?string
    {
        if (! is_array($tabs)) {
            return 'The tabs list is malformed.';
        }

        $tabs = array_values($tabs);

        if ($tabs === []) {
            return 'At least one phase must be present.';
        }

        $baseIds = self::baseIds();
        $seen = [];
        $customCount = 0;

        foreach ($tabs as $tab) {
            if (! is_array($tab)) {
                return 'The tabs list is malformed.';
            }

            $id = $tab['id'] ?? null;
            $kind = $tab['kind'] ?? null;
            $label = $tab['label'] ?? null;

            if (! is_string($id) || $id === '') {
                return 'Every phase needs an id.';
            }

            if (in_array($id, $seen, true)) {
                return 'Phases must have distinct ids.';
            }

            if (! is_string($label) || trim($label) === '') {
                return 'Every phase needs a name.';
            }

            if ($kind === 'base') {
                if (! in_array($id, $baseIds, true)) {
                    return 'A base phase tab has an unknown id.';
                }
            } elseif ($kind === 'custom') {
                if (in_array($id, $baseIds, true)) {
                    return 'A custom tab cannot use a base phase id.';
                }

                $customCount++;

                if ($customCount > self::MAX_CUSTOM_TABS) {
                    return 'Too many custom tabs.';
                }
            } else {
                return 'A phase tab has an unknown kind.';
            }

            $seen[] = $id;
        }

        return null;
    }

    /**
     * Force a tabs list into canonical form, preserving the submitted order: any base
     * tabs the blob carries (known id, any non-empty label - renamed or not), any
     * well-formed custom tabs up to {@see MAX_CUSTOM_TABS}, de-duplicated by id. Used
     * on the read path where the blob is trusted-but-verified rather than freshly
     * validated.
     *
     * @param  array<int|string, mixed>  $tabs
     * @return list<array{id: string, label: string, kind: string}>
     */
    public static function canonical(array $tabs): array
    {
        $baseIds = self::baseIds();
        $canonical = [];
        $seen = [];
        $customCount = 0;

        foreach (array_values($tabs) as $tab) {
            if (! is_array($tab)) {
                continue;
            }

            $id = $tab['id'] ?? null;
            $label = $tab['label'] ?? null;

            if (! is_string($id) || $id === '' || in_array($id, $seen, true) || ! is_string($label) || trim($label) === '') {
                continue;
            }

            if (($tab['kind'] ?? null) === 'base' && in_array($id, $baseIds, true)) {
                $canonical[] = ['id' => $id, 'label' => trim($label), 'kind' => 'base'];
                $seen[] = $id;

                continue;
            }

            if (($tab['kind'] ?? null) === 'custom' && ! in_array($id, $baseIds, true) && $customCount < self::MAX_CUSTOM_TABS) {
                $canonical[] = ['id' => $id, 'label' => trim($label), 'kind' => 'custom'];
                $seen[] = $id;
                $customCount++;
            }
        }

        // Every plan keeps at least one phase.
        if ($canonical === []) {
            $canonical[] = self::base()[0];
        }

        return $canonical;
    }
}
