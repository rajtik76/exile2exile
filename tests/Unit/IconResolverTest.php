<?php

declare(strict_types=1);

use App\Pob\IconResolver;

it('resolves a GGPK active gem icon and colour', function () {
    $resolver = new IconResolver;

    expect($resolver->gemIcon('SkillGemChaosbolt'))
        ->toBe('/icons/poe2/Art/2DArt/SkillIcons/ChaosBoltWeaponSkill.png')
        ->and($resolver->gemColor('SkillGemChaosbolt'))->toBe('b');
});

it('resolves a GGPK support gem icon', function () {
    expect((new IconResolver)->gemIcon('SupportGemChaosMastery'))
        ->toBe('/icons/poe2/Art/2DArt/SkillIcons/Support/ChaosMasterySupport.png');
});

it('returns null for an unknown gem', function () {
    $resolver = new IconResolver;

    expect($resolver->gemIcon('SkillGemNotARealGem'))->toBeNull()
        ->and($resolver->gemColor('SkillGemNotARealGem'))->toBeNull()
        ->and($resolver->gemIcon(null))->toBeNull();
});

it('resolves a support gem category, tags and bbcode-stripped description', function () {
    $resolver = new IconResolver;

    expect($resolver->gemCategory('SupportGemAbidingHex'))->toBe('Support Gem')
        ->and($resolver->gemTags('SupportGemAbidingHex'))->toContain('Curse')
        ->and($resolver->gemDescription('SupportGemAbidingHex'))
        ->toContain('Curse')
        ->not->toContain('[')
        ->not->toContain('|');
});

it('hides redundant classification tags from gem tags', function () {
    $resolver = new IconResolver;

    // "Support" duplicates the "Support Gem" category line, so it is hidden.
    expect($resolver->gemTags('SupportGemAbidingHex'))->not->toContain('Support')
        ->and($resolver->gemTags('SkillGemAncestralCry'))->toContain('Attack');
});

it('labels an active gem as a skill gem with a vendored description', function () {
    $resolver = new IconResolver;

    expect($resolver->gemCategory('SkillGemChaosbolt'))->toBe('Skill Gem')
        ->and($resolver->gemDescription('SkillGemChaosbolt'))->toBeString()->not->toBeEmpty();
});

it('returns empty gem metadata for an unknown gem', function () {
    $resolver = new IconResolver;

    expect($resolver->gemCategory('SkillGemNotARealGem'))->toBeNull()
        ->and($resolver->gemDescription('SkillGemNotARealGem'))->toBeNull()
        ->and($resolver->gemTags('SkillGemNotARealGem'))->toBe([]);
});

it('resolves an equipment base icon to the locally vendored art', function () {
    expect((new IconResolver)->itemIcon('Gold Circlet'))
        ->toBe('/icons/poe2/Art/2DItems/Armours/Helmets/Basetypes/HelmetInt06.png');
});

it('extracts a base type embedded in a magic item name', function () {
    $resolver = new IconResolver;

    expect($resolver->matchBaseType('Sustained Colossal Mana Flask of the Foliage'))
        ->toBe('Colossal Mana Flask')
        ->and($resolver->matchBaseType('Tidebound Staunching Charm of the Bountiful'))
        ->toBe('Staunching Charm')
        ->and($resolver->matchBaseType(null))->toBeNull();
});

it('flags unique items apart from normal bases', function () {
    $resolver = new IconResolver;

    expect($resolver->isUnique('Bramblejack'))->toBeTrue()
        ->and($resolver->isUnique('Gold Circlet'))->toBeFalse()
        ->and($resolver->isUnique('Definitely Not An Item'))->toBeNull()
        ->and($resolver->isUnique(null))->toBeNull();
});

it('never resolves a unique name as a magic item base type', function () {
    // Uniques share the item map since item-extractor 0.5.0; matchBaseType must
    // still return only real bases, never a unique that happens to be a substring.
    $resolver = new IconResolver;

    expect($resolver->matchBaseType('Bramblejack'))->not->toBe('Bramblejack');
});

it('flags two-handed weapon base types', function () {
    $resolver = new IconResolver;

    expect($resolver->isTwoHanded('Chiming Staff'))->toBeTrue()
        ->and($resolver->isTwoHanded('Withered Wand'))->toBeFalse()
        ->and($resolver->isTwoHanded(null))->toBeFalse();
});

it('returns null for an unknown base type', function () {
    expect((new IconResolver)->itemIcon('Definitely Not A Base'))->toBeNull()
        ->and((new IconResolver)->itemIcon(null))->toBeNull();
});
