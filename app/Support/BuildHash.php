<?php

declare(strict_types=1);

namespace App\Support;

use App\Http\Controllers\SharedBuildController;

final class BuildHash
{
    /**
     * A stable sha256 of an allocation, order-independent: node lists are sorted
     * and the attribute/jewel maps keyed-sorted, so the same tree always hashes
     * the same regardless of the order the client sent its nodes in. weaponSets is
     * omitted when empty so a build with no set assignments hashes exactly like one
     * shared before weapon sets existed.
     *
     * The single hasher shared by {@see SharedBuildController}
     * (on create) and any data fix that re-hashes a row (e.g. the ascendancy-id
     * normalisation migration), so a rewritten build still dedups to its own row.
     * Null-safe for older rows that predate a field.
     *
     * @param  array<string, mixed>  $build
     */
    public static function canonical(array $build): string
    {
        $allocated = $build['allocated'] ?? [];
        sort($allocated);

        $attributeChoices = $build['attributeChoices'] ?? [];
        ksort($attributeChoices);

        $weaponSets = $build['weaponSets'] ?? [];
        ksort($weaponSets);

        $jewels = $build['jewels'] ?? [];
        ksort($jewels);

        // Build the payload in a fixed key order. weaponSets is omitted entirely
        // when empty so a build with no set assignments hashes exactly like one
        // shared before weapon sets existed - re-sharing an old link dedups to its
        // original row instead of minting a duplicate.
        $payload = [
            'className' => $build['className'] ?? '',
            'ascendId' => $build['ascendId'] ?? null,
            'allocated' => $allocated,
            'attributeChoices' => $attributeChoices,
        ];

        if ($weaponSets !== []) {
            $payload['weaponSets'] = $weaponSets;
        }

        $payload['jewels'] = $jewels;
        $payload['treeVersion'] = $build['treeVersion'] ?? null;

        return hash('sha256', (string) json_encode($payload));
    }
}
