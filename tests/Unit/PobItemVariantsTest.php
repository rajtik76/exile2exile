<?php

declare(strict_types=1);

use App\Pob\Uniques\PobItemVariants;
use App\Pob\Uniques\TaggedLine;
use App\Pob\Uniques\VariantSelection;

/*
 * The port of PathOfBuilding-PoE2's variant rules (Classes/Item.lua). The item blocks
 * below are trimmed copies of real Data/Uniques/*.lua entries.
 */

/**
 * The texts of the lines active for the item's pick (its PoB default when none given).
 *
 * @param  list<string>  $lines
 * @return list<string>
 */
function pobActiveLines(array $lines, ?VariantSelection $selection = null): array
{
    $variants = PobItemVariants::fromItemLines($lines);
    $selection = $variants->normalise($selection);

    return array_values(array_map(
        static fn (TaggedLine $line): string => $line->text,
        array_filter(array_map(TaggedLine::parse(...), $lines), static fn (TaggedLine $line): bool => ! str_contains($line->text, ': ') && $variants->isActive($line, $selection)),
    ));
}

test('an item without variants or versions has no variant model', function () {
    expect(PobItemVariants::fromItemLines(['League: Dawn of the Hunt', '+(80-120) to maximum Life']))->toBeNull();
});

test('a classic item defaults to its last variant and honours a pick', function () {
    $lines = [
        'Variant: Fire', 'Variant: Cold', 'Variant: Lightning',
        '{variant:1}Purity of Fire', '{variant:2}Purity of Ice', '{variant:3}Purity of Lightning',
        '+(5-10) to all Attributes',
    ];

    expect(pobActiveLines($lines))->toBe(['Purity of Lightning', '+(5-10) to all Attributes'])
        ->and(pobActiveLines($lines, new VariantSelection(variant: 2)))->toBe(['Purity of Ice', '+(5-10) to all Attributes']);
});

test('an item\'s own Selected Variant is its default, and an out-of-range pick is clamped', function () {
    $lines = ['Variant: Pre 0.4.0', 'Variant: Current', 'Selected Variant: 1', '{variant:1}Old', '{variant:2}New'];

    expect(pobActiveLines($lines))->toBe(['Old'])
        ->and(pobActiveLines($lines, new VariantSelection(variant: 9)))->toBe(['New']);
});

test('alt variants each add their own lines, defaulting to the item\'s selected alts', function () {
    $lines = [
        'Has Alt Variant: true', 'Has Alt Variant Two: true',
        'Selected Variant: 1', 'Selected Alt Variant: 2', 'Selected Alt Variant Two: 3',
        'Variant: Spirit', 'Variant: Life', 'Variant: Mana', 'Variant: Attributes',
        '{variant:1}Spirit per Socket', '{variant:2}Life per Socket', '{variant:3}Mana per Socket', '{variant:4}Attributes per Socket',
    ];

    expect(pobActiveLines($lines))->toBe(['Spirit per Socket', 'Life per Socket', 'Mana per Socket'])
        ->and(pobActiveLines($lines, new VariantSelection(variant: 4, alts: [1 => 4, 2 => 1])))->toBe(['Spirit per Socket', 'Attributes per Socket']);
});

test('a versioned item shows the latest version\'s lines by default', function () {
    $lines = [
        'Version: Pre 0.5.0', 'Version: Current',
        '+(60-80) to maximum Life', '{version:2}(10-15)% increased Spirit', '{version:1}Old roll',
    ];

    expect(pobActiveLines($lines))->toBe(['+(60-80) to maximum Life', '(10-15)% increased Spirit'])
        ->and(pobActiveLines($lines, new VariantSelection(version: 1)))->toBe(['+(60-80) to maximum Life', 'Old roll']);
});

test('variants and versions are independent axes', function () {
    $lines = [
        'Version: Pre 0.4.0', 'Version: Current', 'Selected Variant: 2',
        'Variant: Small Ring', 'Variant: Medium Ring',
        '{variant:1}Only affects Passives in Small Ring', '{variant:2}Only affects Passives in Medium Ring',
        '{version:1}-(23-3)% to Chaos Resistance',
    ];

    expect(pobActiveLines($lines))->toBe(['Only affects Passives in Medium Ring'])
        ->and(pobActiveLines($lines, new VariantSelection(variant: 1, version: 1)))->toBe(['Only affects Passives in Small Ring', '-(23-3)% to Chaos Resistance']);
});

test('variant groups pick one variant each, never the same twice', function () {
    $lines = [
        'Variant: Helmet', 'Variant: Gloves', 'Variant: Armour', 'Variant: Evasion',
        '{variant:1}{group:1}as though it was also a Helmet', '{variant:2}{group:1}as though it was also Gloves',
        '{variant:3}{group:2}increased Armour', '{variant:4}{group:2}increased Evasion Rating',
        'to all Elemental Resistances',
    ];

    $variants = PobItemVariants::fromItemLines($lines);

    expect($variants->defaults->groups)->toBe([1 => 1, 2 => 3])
        ->and(pobActiveLines($lines))->toBe(['as though it was also a Helmet', 'increased Armour', 'to all Elemental Resistances'])
        ->and(pobActiveLines($lines, new VariantSelection(groups: [1 => 2, 2 => 4])))->toBe(['as though it was also Gloves', 'increased Evasion Rating', 'to all Elemental Resistances'])
        // A pick from another group's options is not valid for this one.
        ->and($variants->normalise(new VariantSelection(groups: [1 => 3]))->groups)->toBe([1 => 1, 2 => 3]);
});

test('a model survives its stored array form', function () {
    $variants = PobItemVariants::fromItemLines([
        'Has Alt Variant: true', 'Selected Alt Variant: 1', 'Variant: A', 'Variant: B', '{variant:1}{group:1}x',
    ]);

    expect(PobItemVariants::fromArray(json_decode(json_encode($variants->toArray()), true)))->toEqual($variants);
});
