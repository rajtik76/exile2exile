<?php

declare(strict_types=1);

use App\Pob\IconResolver;
use App\Pob\PobImport;
use App\Pob\Uniques\PobUniqueModsParser;
use App\Pob\Uniques\PobUniqueStore;
use App\Pob\Uniques\VariantSelection;
use App\Support\Planner\PlanSchema;
use App\Support\Planner\PobPlanMapper;

/*
 * A unique with PoB variants: PoB exports every variant's lines tagged {variant:N} plus the
 * item's own pick, and only the picked variant's lines are the item's mods. Trimmed copies
 * of PoB's Data/Uniques entries (sceptre.lua Guiding Palm, jewel.lua Grand Spectrum).
 */
beforeEach(function () {
    fakeGameData(
        files: [
            'resources/poe2/ggpk/items.json' => [
                'Guiding Palm' => ['icon' => 'Uniques/GuidingPalm.dds', 'rarity' => 'unique', 'category' => 'Sceptre'],
                'Grand Spectrum' => ['icon' => 'Uniques/GrandSpectrum.dds', 'rarity' => 'unique', 'category' => 'Jewel'],
                'Shrine Sceptre' => ['icon' => 'Bases/ShrineSceptre.dds', 'itemClass' => 'Sceptre'],
            ],
        ],
        icons: ['Uniques/GuidingPalm.png', 'Uniques/GrandSpectrum.png', 'Bases/ShrineSceptre.png'],
    );

    fakePobUniquesRoot();

    $parsed = (new PobUniqueModsParser)->parse(<<<'LUA'
        return {
        [[
        Guiding Palm
        Shrine Sceptre
        Variant: Fire
        Variant: Cold
        Variant: Lightning
        Requires Level 65
        Implicits: 3
        {variant:1}Grants Skill: Level (1-20) Purity of Fire
        {variant:2}Grants Skill: Level (1-20) Purity of Ice
        {variant:3}Grants Skill: Level (1-20) Purity of Lightning
        {variant:1}Allies in your Presence deal (15-23) to (28-35) added Attack Fire Damage
        {variant:2}Allies in your Presence deal (15-23) to (28-35) added Attack Cold Damage
        {variant:3}Allies in your Presence deal 1 to (56-70) added Attack Lightning Damage
        +(5-10) to all Attributes
        ]],[[
        Grand Spectrum
        Ruby
        Limited to: 3
        2% increased Maximum Life per socketed Grand Spectrum
        ]],[[
        Grand Spectrum
        Sapphire
        Limited to: 3
        +6% to all Elemental Resistances per socketed Grand Spectrum
        ]],
        }
        LUA);

    app(PobUniqueStore::class)->write([
        'Guiding Palm' => $parsed[0],
        'Grand Spectrum, Ruby' => $parsed[1],
        'Grand Spectrum, Sapphire' => $parsed[2],
    ], 'repo@sha');
});

function guidingPalmExport(int $selectedVariant): string
{
    return '<?xml version="1.0"?><PathOfBuilding2>'
        .'<Build level="90" className="Druid"/>'
        .'<Tree activeSpec="1"><Spec classId="0" treeVersion="0_5" nodes=""/></Tree>'
        .'<Skills activeSkillSet="1"><SkillSet id="1"/></Skills>'
        .'<Items activeItemSet="1"><Item id="1">Rarity: UNIQUE'."\n"
        ."Guiding Palm\nShrine Sceptre\n"
        ."Variant: Fire\nVariant: Cold\nVariant: Lightning\nSelected Variant: {$selectedVariant}\n"
        ."LevelReq: 65\nImplicits: 3\n"
        ."{variant:1}Grants Skill: Level 20 Purity of Fire\n"
        ."{variant:2}Grants Skill: Level 20 Purity of Ice\n"
        ."{variant:3}Grants Skill: Level 20 Purity of Lightning\n"
        ."{variant:1}Allies in your Presence deal 20 to 30 added Attack Fire Damage\n"
        ."{variant:2}Allies in your Presence deal 21 to 33 added Attack Cold Damage\n"
        ."{variant:3}Allies in your Presence deal 1 to 60 added Attack Lightning Damage\n"
        .'+8 to all Attributes</Item>'
        .'<ItemSet id="1"><Slot name="Weapon 1" itemId="1"/></ItemSet></Items>'
        .'</PathOfBuilding2>';
}

test('an imported unique keeps only its own variant\'s lines', function () {
    $item = (new PobImport)->fromXml(guidingPalmExport(2))->items[0];

    expect($item->mods)->toBe([
        'Grants Skill: Level 20 Purity of Ice',
        'Allies in your Presence deal 21 to 33 added Attack Cold Damage',
        '+8 to all Attributes',
    ])
        ->and($item->implicitMods())->toBe(['Grants Skill: Level 20 Purity of Ice'])
        ->and($item->variantSelection?->toArray())->toBe(['variant' => 2]);
});

test('the plan keeps the imported variant and matches its rolls against that variant\'s lines', function () {
    $plan = app(PobPlanMapper::class)->map((new PobImport)->fromXml(guidingPalmExport(2)));
    $slot = $plan['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['weapon1'];

    expect($slot['base'])->toBe(['type' => 'unique', 'id' => 'Guiding Palm'])
        ->and($slot['variant'])->toBe(['variant' => 2])
        ->and($slot['uniqueMods'])->toBe([
            ['key' => 'Grants Skill: Level # Purity of Ice', 'values' => [20.0]],
            ['key' => 'Allies in your Presence deal # to # added Attack Cold Damage', 'values' => [21.0, 33.0]],
            ['key' => '+# to all Attributes', 'values' => [8.0]],
        ]);
});

test('a unique\'s mod lines follow the variant pick, PoB\'s default being the last variant', function () {
    $icons = app(IconResolver::class);
    $templates = fn (array $lines): array => array_map(fn ($line) => $line->template, [...$lines['implicits'], ...$lines['mods']]);

    expect($templates($icons->uniqueModLines('Guiding Palm')))->toBe([
        'Grants Skill: Level (1-20) Purity of Lightning',
        'Allies in your Presence deal 1 to (56-70) added Attack Lightning Damage',
        '+(5-10) to all Attributes',
    ])
        ->and($templates($icons->uniqueModLines('Guiding Palm', VariantSelection::fromArray(['variant' => 1])))[0])
        ->toBe('Grants Skill: Level (1-20) Purity of Fire');
});

test('a name PoB has on several bases resolves by base, and the picker lists each base', function () {
    $icons = app(IconResolver::class);

    $found = $icons->searchReferences('Grand Spectrum', ['unique']);

    expect($icons->uniqueId('Grand Spectrum', 'Sapphire'))->toBe('Grand Spectrum, Sapphire')
        ->and($icons->uniqueId('Guiding Palm', 'Shrine Sceptre'))->toBe('Guiding Palm')
        ->and(array_column($found, 'id'))->toBe(['Grand Spectrum, Ruby', 'Grand Spectrum, Sapphire'])
        ->and(array_column($found, 'name'))->toBe(['Grand Spectrum', 'Grand Spectrum'])
        ->and(array_column($found, 'baseType'))->toBe(['Ruby', 'Sapphire'])
        ->and($icons->resolveReference('unique', 'Grand Spectrum, Sapphire')['tooltip'])
        ->toBe('+6% to all Elemental Resistances per socketed Grand Spectrum');
});
