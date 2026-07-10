<?php

declare(strict_types=1);

use App\Pob\IconResolver;

// Arbitrary game data - the logic (id -> icon, dds -> png, presence, bbcode
// stripping, tag hiding, base matching, unique/two-hand flags) is what matters,
// not which real GGPK entries exist.
beforeEach(function () {
    fakeGameData(
        files: [
            'resources/poe2/ggpk/gems.json' => [
                'SkillGemAlpha' => ['name' => 'Alpha', 'icon' => 'Skills/Alpha.dds', 'color' => 'b', 'kind' => 'active', 'description' => 'Deals damage.', 'tags' => ['Attack', 'Fire']],
                'SupportGemBeta' => ['name' => 'Beta', 'icon' => 'Support/Beta.dds', 'color' => 'g', 'kind' => 'support', 'description' => 'A [Curse|Curse] support.', 'tags' => ['Curse', 'Support']],
            ],
            'resources/poe2/ggpk/items.json' => [
                'Gilded Circlet' => ['icon' => 'Helmets/Circlet.dds', 'itemClass' => 'Helmet'],
                'Grand Staff' => ['icon' => 'Weapons/Staff.dds', 'itemClass' => 'Staff', 'twoHanded' => true],
                'Big Mana Flask' => ['icon' => 'Flasks/Mana.dds', 'itemClass' => 'ManaFlask'],
                'Warding Charm' => ['icon' => 'Charms/Ward.dds', 'itemClass' => 'UtilityFlask'],
                'Thornguard' => ['icon' => 'Uniques/Thornguard.dds', 'rarity' => 'unique', 'category' => 'Body Armour'],
            ],
        ],
        icons: [
            'Skills/Alpha.png', 'Support/Beta.png', 'Helmets/Circlet.png',
            'Weapons/Staff.png', 'Flasks/Mana.png', 'Charms/Ward.png', 'Uniques/Thornguard.png',
        ],
    );
});

it('resolves a gem id to its icon web path and colour', function () {
    $resolver = new IconResolver;

    expect($resolver->gemIcon('SkillGemAlpha'))->toBe('/icons/poe2/Skills/Alpha.png')
        ->and($resolver->gemColor('SkillGemAlpha'))->toBe('b');
});

it('returns null for an unknown gem', function () {
    $resolver = new IconResolver;

    expect($resolver->gemIcon('SkillGemUnknown'))->toBeNull()
        ->and($resolver->gemColor('SkillGemUnknown'))->toBeNull()
        ->and($resolver->gemIcon(null))->toBeNull();
});

it('exposes a support gem category, tags and a bbcode-stripped description', function () {
    $resolver = new IconResolver;

    expect($resolver->gemCategory('SupportGemBeta'))->toBe('Support Gem')
        ->and($resolver->gemTags('SupportGemBeta'))->toContain('Curse')
        ->and($resolver->gemDescription('SupportGemBeta'))
        ->toContain('Curse')->not->toContain('[')->not->toContain('|');
});

it('hides the redundant Support tag from a support gem', function () {
    $resolver = new IconResolver;

    expect($resolver->gemTags('SupportGemBeta'))->not->toContain('Support')
        ->and($resolver->gemTags('SkillGemAlpha'))->toContain('Attack');
});

it('labels a non-support gem as a skill gem', function () {
    expect((new IconResolver)->gemCategory('SkillGemAlpha'))->toBe('Skill Gem');
});

it('returns empty gem metadata for an unknown gem', function () {
    $resolver = new IconResolver;

    expect($resolver->gemCategory('SkillGemUnknown'))->toBeNull()
        ->and($resolver->gemDescription('SkillGemUnknown'))->toBeNull()
        ->and($resolver->gemTags('SkillGemUnknown'))->toBe([]);
});

it('resolves an equipment base to its icon web path', function () {
    expect((new IconResolver)->itemIcon('Gilded Circlet'))->toBe('/icons/poe2/Helmets/Circlet.png');
});

it('extracts the longest base type embedded in a magic item name', function () {
    $resolver = new IconResolver;

    expect($resolver->matchBaseType('Sturdy Big Mana Flask of Warding'))->toBe('Big Mana Flask')
        ->and($resolver->matchBaseType('Tidebound Warding Charm of Plenty'))->toBe('Warding Charm')
        ->and($resolver->matchBaseType(null))->toBeNull();
});

it('flags unique items apart from normal bases', function () {
    $resolver = new IconResolver;

    expect($resolver->isUnique('Thornguard'))->toBeTrue()
        ->and($resolver->isUnique('Gilded Circlet'))->toBeFalse()
        ->and($resolver->isUnique('Not An Item'))->toBeNull()
        ->and($resolver->isUnique(null))->toBeNull();
});

it('never matches a unique name as a magic base type', function () {
    expect((new IconResolver)->matchBaseType('Thornguard'))->not->toBe('Thornguard');
});

it('flags two-handed weapon bases', function () {
    $resolver = new IconResolver;

    expect($resolver->isTwoHanded('Grand Staff'))->toBeTrue()
        ->and($resolver->isTwoHanded('Gilded Circlet'))->toBeFalse()
        ->and($resolver->isTwoHanded(null))->toBeFalse();
});

it('returns null for an unknown base type', function () {
    expect((new IconResolver)->itemIcon('Not A Base'))->toBeNull()
        ->and((new IconResolver)->itemIcon(null))->toBeNull();
});
