<?php

declare(strict_types=1);

use App\Models\BuildPlan;
use App\Models\EconomyPrice;
use App\Support\Planner\PlanSchema;

/**
 * The build overlay names the affix "Athlete's" (from IncreasedLife9) and gates its bases
 * through {@see IconResolver::knowsBaseType}; the economy layer names Divine Orb. Seed just
 * those onto the mocked `game-data` disk - the NeverSink base body is a vendored MIT asset.
 */
beforeEach(function () {
    fakeGameData([
        'resources/poe2/ggpk/mods.json' => [
            ['id' => 'IncreasedLife9', 'name' => "Athlete's", 'domain' => 'Item', 'group' => 'IncreasedLife', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to maximum Life'], 'rolls' => [['stat' => 'life', 'min' => 0, 'max' => 200]], 'families' => ['IncreasedLife'], 'spawnWeights' => [['tag' => 'default', 'weight' => 1000]]],
        ],
        'resources/poe2/ggpk/items.json' => array_fill_keys(
            ['Amethyst Ring', 'Divine Orb'],
            ['rarity' => 'normal'],
        ),
    ]);
});

function seedBuild(): BuildPlan
{
    return BuildPlan::create([
        'slug' => 'demobuild',
        'edit_token' => str_repeat('a', 64),
        'title' => 'Cold Witch',
        'schema_version' => PlanSchema::CURRENT_VERSION,
        'data' => PlanSchema::canonicalize([
            'mode' => 'single',
            'sections' => ['single' => ['items' => ['slots' => [
                'ring1' => [
                    'rarity' => 'rare',
                    'base' => ['type' => 'base', 'id' => 'Amethyst Ring'],
                    'stats' => [['modId' => 'IncreasedLife9', 'values' => [130]]],
                ],
            ]]]],
        ]),
    ]);
}

test('a build filter downloads with the overlay and a build-named file', function () {
    seedBuild();
    EconomyPrice::factory()->create([
        'league' => 'Runes of Aldur', 'name' => 'Divine Orb', 'base_type' => 'Divine Orb',
        'kind' => 'currency', 'category' => 'currency', 'price' => 50.0,
    ]);

    $response = $this->get(route('filter.build', ['plan' => 'demobuild', 'strictness' => '3-strict']));

    $response->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="Cold Witch (Default, Strict).filter"');

    expect($response->getContent())
        // Build-aware overlay.
        ->toContain('HasExplicitMod >=1 "Athlete\'s"')
        ->toContain('BaseType == "Amethyst Ring"')
        // Economy layer composed in.
        ->toContain('BaseType == "Divine Orb"')
        // Header carries the project, the build and the date.
        ->toContain('# Exile to Exile - loot filter')
        ->toContain('# Build: Cold Witch')
        ->toContain('# Generated:')
        // On top of NeverSink's own filter.
        ->toContain("NeverSink's Indepth Loot Filter");
});

test('the phase is folded into the filename', function () {
    seedBuild();

    $this->get(route('filter.build', ['plan' => 'demobuild', 'phase' => 'Early Endgame']))
        ->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="Cold Witch - Early Endgame (Default, Regular).filter"');
});

test('a build filter works even with no economy data', function () {
    seedBuild();

    $this->get(route('filter.build', ['plan' => 'demobuild']))
        ->assertOk();
});
