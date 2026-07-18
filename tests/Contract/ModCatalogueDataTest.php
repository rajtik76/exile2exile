<?php

declare(strict_types=1);

use App\Pob\ModCatalogue;
use App\Support\Planner\PlanSchema;
use Illuminate\Support\Facades\Storage;

/**
 * Guards the shape of every mod in the live GGPK affix catalogue: a mod without a
 * rendered stat line (or with a malformed roll) shows up in the modifier picker as an
 * empty row with no value to pick, and the import can never match its text. The
 * extractor skips unrenderable mods loudly; this pins that no such entry ships.
 */
it('every catalogue mod carries a rendered stat line and well-formed rolls', function () {
    $mods = json_decode((string) Storage::disk('game-data')->get('resources/poe2/ggpk/mods.json'), true);

    expect($mods)->toBeArray()->not->toBeEmpty();

    $catalogue = new ModCatalogue;
    $broken = [];

    foreach ($mods as $mod) {
        $resolved = $catalogue->resolve($mod['id']);

        if ($resolved === null) {
            $broken[] = "{$mod['id']}: not resolvable";

            continue;
        }

        if ($resolved['stats'] === [] || array_any($resolved['stats'], fn (string $line): bool => trim($line) === '')) {
            $broken[] = "{$mod['id']}: no rendered stat line";
        }

        foreach ($resolved['rolls'] as $roll) {
            if (! is_numeric($roll['min']) || ! is_numeric($roll['max']) || $roll['min'] > $roll['max']) {
                $broken[] = "{$mod['id']}: malformed roll ".json_encode($roll);
            }
        }
    }

    expect($broken)->toBe([]);
});

/**
 * A stat saved before the frozen-snapshot shape existed carries only `{modId, values}`
 * - no `text` at all. `PlanItemSchema::canonicalMod` must re-freeze it against the live
 * catalogue rather than silently drop the mod the first time such a plan (predating
 * `MigrateBuildPlanStatSnapshots`) is viewed or saved.
 */
it('canonicalize re-freezes an old-shape stat (modId + values, no text) instead of dropping it', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'slots' => [
                        'body' => [
                            'base' => ['type' => 'base', 'id' => 'Advanced Plate Vest'],
                            'stats' => [
                                ['modId' => 'IncreasedLife5', 'values' => [65]],
                                // An id no longer in the catalogue can't be recovered
                                // (no text was ever stored for it) and is dropped.
                                ['modId' => 'ThisModIdIsNotReal', 'values' => [1]],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);

    expect($data['sections']['act-1']['items']['slots']['body']['stats'])->toBe([
        [
            'modId' => 'IncreasedLife5',
            'text' => '+65 to maximum Life',
            'name' => 'Stout',
            'type' => 'prefix',
            'family' => 'IncreasedLife',
            'tier' => 5,
            'rolls' => [['stat' => 'base_maximum_life', 'min' => 60, 'max' => 69]],
            'values' => [65],
        ],
    ]);
});
