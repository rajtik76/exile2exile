<?php

declare(strict_types=1);

use App\Pob\Data\BuildSnapshot;
use App\Pob\Data\CharacterClass;
use App\Pob\Data\EquippedItem;
use App\Pob\IconResolver;
use App\Pob\Uniques\PobUniqueStore;
use App\Support\Planner\PlanSchema;
use App\Support\Planner\PobPlanMapper;
use Illuminate\Support\Facades\File;

/**
 * PobPlanMapper::matchUniqueMods() reverse-matches a unique's raw PoB item-text mod lines
 * (which already carry the exact rolled value, not a range) against the PoB-synced catalogue
 * ({@see PobUniqueStore}). Real-world case captured this session: importing pobb.in/E23x6r3rboyN's
 * Constricting Command, whose raw item text also carries "Bonded: ..." lines from a socketed
 * rune that are not the unique's own mods and must not be matched/reported.
 */
beforeEach(function () {
    fakeGameData(
        files: [
            'resources/poe2/ggpk/items.json' => [
                'Constricting Command' => ['icon' => 'Uniques/ConstrictingCommand.dds', 'rarity' => 'unique', 'category' => 'Helmet'],
            ],
        ],
        icons: ['Uniques/ConstrictingCommand.png'],
    );

    fakePobUniquesRoot();

    app(PobUniqueStore::class)->write([
        'Constricting Command' => [
            'name' => 'Constricting Command',
            'base' => 'Viper Cap',
            'league' => 'Dawn of the Hunt',
            'implicitCount' => 0,
            'mods' => [
                '+(80-120) to maximum Life',
                '+(10-15) to all Attributes',
                '(8-12) Life Regeneration per second',
                'Pin Enemies which are Primed for Pinning',
                'Require (2-4) fewer enemies to be Surrounded',
            ],
        ],
    ], 'repo@sha');
});

/** Minimal single-item snapshot, mirroring the real pobb.in/E23x6r3rboyN helmet slot. */
function snapshotWithHelmet(EquippedItem $helmet): BuildSnapshot
{
    return new BuildSnapshot(
        level: 80,
        class: CharacterClass::Witch,
        ascendancy: null,
        classId: 3,
        treeVersion: '0.5',
        passiveNodes: [],
        skillGroups: [],
        items: [$helmet],
    );
}

test('it captures the exact rolled values from a real PoB import, including a decimal', function () {
    $helmet = new EquippedItem(
        slot: 'Helmet',
        rarity: 'UNIQUE',
        name: 'Constricting Command',
        baseType: 'Constricting Command',
        itemLevel: null,
        implicitsCount: 3,
        mods: [
            '+14% to Fire Resistance',
            'Bonded: +10 to maximum Life',
            'Bonded: +10 to maximum Mana',
            '+110 to maximum Life',
            '+13 to all Attributes',
            '11.9 Life Regeneration per second',
            'Require 4 fewer enemies to be Surrounded',
        ],
    );

    $mapper = app(PobPlanMapper::class);
    $plan = $mapper->map(snapshotWithHelmet($helmet));
    $slot = $plan['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['helmet'];

    expect($slot['base'])->toBe(['type' => 'unique', 'id' => 'Constricting Command'])
        ->and($slot['uniqueMods'])->toBe([
            ['key' => '+# to maximum Life', 'values' => [110.0]],
            ['key' => '+# to all Attributes', 'values' => [13.0]],
            ['key' => '# Life Regeneration per second', 'values' => [11.9]],
            ['key' => 'Require # fewer enemies to be Surrounded', 'values' => [4.0]],
        ]);
});

test('Bonded rune-bonus lines are never matched as the unique\'s own mods', function () {
    $helmet = new EquippedItem(
        slot: 'Helmet',
        rarity: 'UNIQUE',
        name: 'Constricting Command',
        baseType: 'Constricting Command',
        itemLevel: null,
        implicitsCount: 3,
        mods: [
            'Bonded: +10 to maximum Life',
            'Bonded: +10 to maximum Mana',
            '+110 to maximum Life',
        ],
    );

    $mapper = app(PobPlanMapper::class);
    $plan = $mapper->map(snapshotWithHelmet($helmet));
    $slot = $plan['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['helmet'];

    expect($slot['uniqueMods'])->toBe([
        ['key' => '+# to maximum Life', 'values' => [110.0]],
    ]);
});

test('a line that matches nothing in the catalogue is dropped and reported, not silently kept', function () {
    $helmet = new EquippedItem(
        slot: 'Helmet',
        rarity: 'UNIQUE',
        name: 'Constricting Command',
        baseType: 'Constricting Command',
        itemLevel: null,
        implicitsCount: 3,
        mods: [
            '+14% to Fire Resistance',
            '+110 to maximum Life',
        ],
    );

    $mapper = app(PobPlanMapper::class);
    $plan = $mapper->map(snapshotWithHelmet($helmet));
    $slot = $plan['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['helmet'];

    expect($slot['uniqueMods'])->toBe([
        ['key' => '+# to maximum Life', 'values' => [110.0]],
    ])
        ->and($mapper->droppedMods()['helmet'] ?? null)->toBe(['+14% to Fire Resistance']);
});

test('a unique with no synced catalogue at all reports nothing dropped', function () {
    File::deleteDirectory(config()->string('poe.pob_uniques.storage_path'));

    $helmet = new EquippedItem(
        slot: 'Helmet',
        rarity: 'UNIQUE',
        name: 'Constricting Command',
        baseType: 'Constricting Command',
        itemLevel: null,
        implicitsCount: 3,
        mods: ['+110 to maximum Life', 'Some future wording'],
    );

    $mapper = app(PobPlanMapper::class);
    $plan = $mapper->map(snapshotWithHelmet($helmet));
    $slot = $plan['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['helmet'];

    expect($slot['uniqueMods'])->toBe([])
        ->and($mapper->droppedMods())->toBe([]);
});

test('IconResolver::uniqueModLines exposes the same catalogue matchUniqueMods uses', function () {
    $lines = app(IconResolver::class)->uniqueModLines('Constricting Command');

    expect($lines['implicits'])->toBe([])
        ->and($lines['mods'])->toHaveCount(5)
        ->and($lines['mods'][2]->matchConcrete('11.9 Life Regeneration per second'))->toBe([11.9]);
});
