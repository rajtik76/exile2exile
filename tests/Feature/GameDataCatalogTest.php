<?php

declare(strict_types=1);

use App\Pob\IconResolver;

// Arbitrary game data - what matters is each catalogue's lookup/guard logic
// (hover art fallback, scaling/requirement curves, tag/domain/implicit joins,
// rune stats, notable sprites), not which real GGPK entries exist.
beforeEach(function () {
    fakeGameData(
        files: [
            'resources/poe2/ggpk/gems.json' => [
                'SkillGemAlpha' => ['name' => 'Alpha', 'icon' => 'Skills/Alpha.dds', 'color' => 'b', 'kind' => 'active', 'hoverImage' => 'Hover/Alpha.dds'],
                'SkillGemGamma' => ['name' => 'Gamma', 'icon' => 'Skills/Gamma.dds', 'color' => 'r', 'kind' => 'active'],
            ],
            'resources/poe2/ggpk/gem_scaling.json' => [
                'SkillGemAlpha' => [
                    'name' => 'Alpha',
                    'levels' => [['level' => 1, 'cost' => 5, 'castTime' => 0.8, 'cooldown' => null, 'reservation' => null, 'spellCritChance' => 9.0, 'attackCritChance' => null, 'stats' => [['text' => 'Deals {0} damage', 'min' => 3.0, 'max' => 5.0]]]],
                    'qualityStats' => [['text' => '{0}% increased area', 'min' => 0.0, 'max' => 10.0]],
                ],
            ],
            'resources/poe2/ggpk/gem_requirements.json' => [
                'SkillGemAlpha' => [
                    'name' => 'Alpha',
                    'levels' => [
                        '1' => ['requiredLevel' => 1, 'str' => 0, 'dex' => 0, 'int' => 10],
                        '2' => ['requiredLevel' => 52, 'str' => 0, 'dex' => 0, 'int' => 117],
                        '3' => ['requiredLevel' => 97, 'str' => 0, 'dex' => 0, 'int' => 212],
                    ],
                ],
            ],
            'resources/poe2/ggpk/items.json' => [
                'Gilded Circlet' => ['icon' => 'Helmets/Circlet.dds', 'itemClass' => 'Helmet', 'modDomain' => 'Item', 'tags' => ['helmet', 'int_armour'], 'implicits' => ['+1 to Light Radius'], 'req' => ['str' => 0, 'dex' => 0, 'int' => 33]],
                'Strider Vest' => ['icon' => 'Armours/Vest.dds', 'itemClass' => 'Body Armour', 'modDomain' => 'Item', 'tags' => ['body_armour', 'dex_armour']],
                'Big Mana Flask' => ['icon' => 'Flasks/Mana.dds', 'itemClass' => 'ManaFlask', 'modDomain' => 'Flask', 'tags' => ['flask', 'mana_flask']],
                'Desert Soul Core' => ['icon' => 'Runes/Desert.dds', 'itemClass' => 'SoulCore'],
                'Thornguard' => ['icon' => 'Uniques/Thornguard.dds', 'rarity' => 'unique', 'category' => 'Body Armour', 'flavourText' => ['Guarded by thorns.', 'Forever.']],
            ],
            'resources/poe2/ggpk/runes.json' => [
                'Desert Soul Core' => ['levelRequirement' => 20, 'effects' => ['Adds 4 to 6 Fire damage']],
            ],
            'public/tree/current/data.json' => [
                'nodes' => [
                    ['id' => 1, 'name' => 'Painted Notable', 'isNotable' => true, 'icon' => 'Art/Notable.dds', 'stats' => ['+10 to Strength']],
                    ['id' => 2, 'name' => 'Blank Notable', 'isNotable' => true, 'stats' => ['+10 to Dexterity']],
                ],
            ],
            // Frame map without the notable's art path and a zero-size sheet, so both
            // sprite fallbacks (missing frame, unparsed sheet) stay exercised.
            'public/tree/current/assets/skills.json' => [
                'frames' => ['notableActive:Art/Other.dds' => ['frame' => ['x' => 0, 'y' => 0, 'w' => 38, 'h' => 38]]],
                'sheet' => ['w' => 0, 'h' => 0],
            ],
        ],
        icons: [
            'Skills/Alpha.png', 'Skills/Gamma.png', 'Hover/Alpha.png', 'ui/gem-hover-placeholder.png',
            'Helmets/Circlet.png', 'Runes/Desert.png',
        ],
    );
});

it("resolves a gem's own hover art and falls back to the vendored placeholder", function () {
    $resolver = new IconResolver;

    expect($resolver->gemHoverImage('SkillGemAlpha'))->toBe('/icons/poe2/Hover/Alpha.png')
        ->and($resolver->gemHoverImage('SkillGemGamma'))->toBe('/icons/poe2/ui/gem-hover-placeholder.png')
        ->and($resolver->gemHoverImage('SkillGemUnknown'))->toBeNull()
        ->and($resolver->gemHoverImage(null))->toBeNull();
});

it('exposes per-level gem scaling, or null when the gem has no resolved stat set', function () {
    $resolver = new IconResolver;

    expect($resolver->gemScaling('SkillGemAlpha'))
        ->name->toBe('Alpha')
        ->levels->toHaveCount(1)
        ->and($resolver->gemScaling('SkillGemGamma'))->toBeNull()
        ->and($resolver->gemScaling(null))->toBeNull();
});

it('caps the gem requirement range at the reachable character level and omits unused attributes', function () {
    $requires = (new IconResolver)->gemRequires('SkillGemAlpha');

    // Gem level 3 needs character level 97 (past the level-90 cap), so the range
    // must stop at level 2's values; str/dex stay weight-0 and are omitted.
    expect($requires)->toBe([
        'level' => [1, 52],
        'str' => null,
        'dex' => null,
        'int' => [10, 117],
    ]);
});

it('returns null gem requirements for an unknown or empty gem id', function () {
    $resolver = new IconResolver;

    expect($resolver->gemRequires('SkillGemUnknown'))->toBeNull()
        ->and($resolver->gemRequires(null))->toBeNull();
});

it("exposes a base's mod tags, domain and implicits, empty/null for uniques and unknowns", function () {
    $resolver = new IconResolver;

    expect($resolver->itemTags('Gilded Circlet'))->toBe(['helmet', 'int_armour'])
        ->and($resolver->itemTags('Thornguard'))->toBe([])
        ->and($resolver->itemTags(null))->toBe([])
        ->and($resolver->itemModDomain('Big Mana Flask'))->toBe('Flask')
        ->and($resolver->itemModDomain('Thornguard'))->toBeNull()
        ->and($resolver->itemModDomain(null))->toBeNull()
        ->and($resolver->itemImplicits('Gilded Circlet'))->toBe(['+1 to Light Radius'])
        ->and($resolver->itemImplicits('Strider Vest'))->toBe([])
        ->and($resolver->itemImplicits(null))->toBe([]);
});

it('derives the shared mod domain and tag union of an equipment category', function () {
    $resolver = new IconResolver;

    expect($resolver->categoryDomain(['Mana Flask']))->toBe('Flask')
        ->and($resolver->categoryDomain(['Body Armour']))->toBe('Item')
        ->and($resolver->categoryDomain(['No Such Category']))->toBeNull()
        ->and($resolver->categoryDomain([]))->toBeNull()
        ->and($resolver->categoryTags(['Body Armour']))->toBe(['body_armour', 'dex_armour'])
        ->and($resolver->categoryTags(['No Such Category']))->toBe([])
        ->and($resolver->categoryTags([]))->toBe([]);
});

it('tells normal bases apart from uniques and unknown names', function () {
    $resolver = new IconResolver;

    expect($resolver->isBaseType('Gilded Circlet'))->toBeTrue()
        ->and($resolver->isBaseType('Thornguard'))->toBeFalse()
        ->and($resolver->isBaseType('Not An Item'))->toBeFalse()
        ->and($resolver->isBaseType(null))->toBeFalse();
});

it("exposes a base's attribute requirements and item class", function () {
    $resolver = new IconResolver;

    expect($resolver->itemRequirements('Gilded Circlet'))->toBe(['str' => 0, 'dex' => 0, 'int' => 33])
        ->and($resolver->itemRequirements('Strider Vest'))->toBeNull()
        ->and($resolver->itemRequirements(null))->toBeNull()
        ->and($resolver->itemClass('Gilded Circlet'))->toBe('Helmet')
        ->and($resolver->itemClass('Not An Item'))->toBeNull()
        ->and($resolver->itemClass(null))->toBeNull();
});

it('filters loot-filter base names down to real GGPK bases', function () {
    $resolver = new IconResolver;

    expect($resolver->knowsBaseType('Gilded Circlet'))->toBeTrue()
        ->and($resolver->knowsBaseType('Precursor Tablet'))->toBeFalse()
        ->and($resolver->knowsBaseType(null))->toBeFalse()
        ->and($resolver->keepKnownBaseTypes(['Gilded Circlet', 'Precursor Tablet', 'Strider Vest']))
        ->toBe(['Gilded Circlet', 'Strider Vest']);
});

it("resolves a rune's stats and its icon from the matching SoulCore base", function () {
    $resolver = new IconResolver;

    expect($resolver->runeData('Desert Soul Core'))->toBe(['levelRequirement' => 20, 'effects' => ['Adds 4 to 6 Fire damage']])
        ->and($resolver->runeData('Not A Rune'))->toBeNull()
        ->and($resolver->runeData(null))->toBeNull()
        ->and($resolver->runeIcon('Desert Soul Core'))->toBe('/icons/poe2/Runes/Desert.png');
});

it('labels a rune reference as Soul Core or Rune from its name', function () {
    $reference = (new IconResolver)->resolveReference('rune', 'Desert Soul Core');

    expect($reference)->not->toBeNull()
        ->and($reference['category'])->toBe('Soul Core')
        ->and($reference['tooltip'])->toBe('Adds 4 to 6 Fire damage')
        ->and($reference['levelRequirement'])->toBe(20);
});

it('returns empty unique mod data when no PoB sync is available', function () {
    $resolver = new IconResolver;

    expect($resolver->uniqueModLines('Thornguard'))->toBe(['implicits' => [], 'mods' => []])
        ->and($resolver->uniqueBaseType('Thornguard'))->toBeNull()
        ->and($resolver->uniqueBaseType(null))->toBeNull();
});

it('resolves a unique reference with GGPK flavour text even without synced mods', function () {
    $reference = (new IconResolver)->resolveReference('unique', 'Thornguard');

    expect($reference)->not->toBeNull()
        ->and($reference['category'])->toBe('Unique Body Armour')
        ->and($reference['flavour'])->toBe("Guarded by thorns.\nForever.")
        ->and($reference['tooltip'])->toBeNull()
        ->and($reference['baseType'])->toBeNull();
});

it('resolves a base reference with its implicits and category', function () {
    $reference = (new IconResolver)->resolveReference('base', 'Gilded Circlet');

    expect($reference)->not->toBeNull()
        ->and($reference['category'])->toBe('Helmet')
        ->and($reference['implicits'])->toBe(['+1 to Light Radius'])
        ->and($reference['icon'])->toBe('/icons/poe2/Helmets/Circlet.png');
});

it('leaves a notable sprite null when its art is missing from the atlas or the node has no icon', function () {
    $resolver = new IconResolver;

    expect($resolver->resolveReference('notable', 'Painted Notable')['sprite'])->toBeNull()
        ->and($resolver->resolveReference('notable', 'Blank Notable')['sprite'])->toBeNull();
});

it('returns no reference matches for a blank query or an unsupported type', function () {
    $resolver = new IconResolver;

    expect($resolver->searchReferences('   ', ['gem', 'rune']))->toBe([])
        ->and($resolver->resolveReference('mystery', 'Anything'))->toBeNull();
});
