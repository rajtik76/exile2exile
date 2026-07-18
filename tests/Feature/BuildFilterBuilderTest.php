<?php

declare(strict_types=1);

use App\Filter\Action;
use App\Filter\Actions;
use App\Filter\Build\BuildFilterBuilder;
use App\Filter\StyleTheme;
use App\Support\Planner\PlanSchema;

/**
 * The build overlay's LOGIC: from a plan it emits a wanted-affix block (keyed on each
 * mod's display name) and a base-upgrade block (keyed on the bases the build wears), and
 * it drops any base the GGPK doesn't know so the game never rejects the whole filter.
 *
 * Driven against a tiny arbitrary catalogue on the mocked `game-data` disk - one affix
 * whose name is "Athlete's", one known base "Amethyst Ring", and no "Precursor Tablet" -
 * so the gate and emission are tested, not the real reverse-matcher.
 */
beforeEach(function () {
    fakeGameData([
        'resources/poe2/ggpk/mods.json' => [
            ['id' => 'IncreasedLife9', 'name' => "Athlete's", 'domain' => 'Item', 'group' => 'IncreasedLife', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to maximum Life'], 'rolls' => [['stat' => 'life', 'min' => 0, 'max' => 200]], 'families' => ['IncreasedLife'], 'spawnWeights' => [['tag' => 'default', 'weight' => 1000]]],
        ],
        // "Amethyst Ring" is a real base the overlay may name; "Precursor Tablet" is absent
        // on purpose, so the known-base gate must drop it.
        'resources/poe2/ggpk/items.json' => ['Amethyst Ring' => ['rarity' => 'normal']],
    ]);
});

/**
 * @param  array<string, mixed>  $slots
 */
function buildFilter(array $slots, int $unidentifiedFloor = 2): string
{
    $plan = PlanSchema::canonicalize([
        'mode' => 'single',
        'sections' => ['single' => ['items' => ['slots' => $slots]]],
    ]);

    // A trivial theme: these tests assert block structure, not styling.
    $theme = new class implements StyleTheme
    {
        /** @return list<Action> */
        public function styleFor(int $tier): array
        {
            return [Actions::fontSize(40)];
        }
    };

    $blocks = app(BuildFilterBuilder::class)->blocks($plan, $theme, $unidentifiedFloor);

    return implode("\n", array_map(static fn ($block) => $block->render(), $blocks));
}

test('the overlay highlights the build wanted affixes and its base upgrades', function () {
    $filter = buildFilter([
        'ring1' => [
            'rarity' => 'rare',
            'base' => ['type' => 'base', 'id' => 'Amethyst Ring'],
            'stats' => [['modId' => 'IncreasedLife9', 'text' => '+130 to maximum Life', 'name' => "Athlete's", 'values' => [130]]],
        ],
    ]);

    // Identified anything carrying the build's affix (IncreasedLife9 -> "Athlete's").
    expect($filter)
        ->toContain('Identified True')
        ->toContain('HasExplicitMod >=1 "Athlete\'s"');

    // Unidentified rares of the base the build wears.
    expect($filter)
        ->toContain('BaseType == "Amethyst Ring"')
        ->toContain('UnidentifiedItemTier >= 2');
});

test('a higher floor raises the unidentified tier requirement', function () {
    $filter = buildFilter([
        'ring1' => ['rarity' => 'rare', 'base' => ['type' => 'base', 'id' => 'Amethyst Ring']],
    ], 4);

    expect($filter)->toContain('UnidentifiedItemTier >= 4');
});

test('a base the game does not know is dropped from the overlay', function () {
    // A plan carrying a base the GGPK doesn't know must not reach a BaseType rule, or the
    // game rejects the whole filter. The real base still comes through.
    $filter = buildFilter([
        'ring1' => ['rarity' => 'rare', 'base' => ['type' => 'base', 'id' => 'Amethyst Ring']],
        'ring2' => ['rarity' => 'rare', 'base' => ['type' => 'base', 'id' => 'Precursor Tablet']],
    ]);

    expect($filter)->toContain('BaseType == "Amethyst Ring"');
    expect($filter)->not->toContain('Precursor Tablet');
});

test('a unique carries no base-upgrade block', function () {
    $filter = buildFilter([
        'weapon1' => ['rarity' => 'unique', 'base' => ['type' => 'unique', 'id' => "Lavianga's Spirits"]],
    ]);

    expect($filter)->not->toContain('UnidentifiedItemTier');
});
