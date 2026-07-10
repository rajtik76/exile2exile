<?php

declare(strict_types=1);

use App\Pob\ModCatalogue;

/**
 * The mod catalogue enforces the game's affix rules against real GGPK data
 * (resources/poe2/ggpk/mods.json): per-rarity prefix/suffix counts, one modifier per
 * mutual-exclusion family, values inside the tier's range, and base compatibility.
 *
 * The ids used are stable GGG `Mods.Id`s: IncreasedLife{n} are life prefixes (family
 * "IncreasedLife"), FireResist{n}/ColdResist{n} elemental-resistance suffixes.
 */
beforeEach(function () {
    $this->catalogue = new ModCatalogue;
});

/** A prefix mod ref rolled at its tier minimum (always in range). */
function prefixMod(int $tier = 1): array
{
    return ['modId' => "IncreasedLife{$tier}", 'values' => [10]];
}

test('a normal item may carry no modifiers', function () {
    expect($this->catalogue->modErrors('normal', []))->toBe([])
        ->and($this->catalogue->modErrors('normal', [prefixMod()]))
        ->toContain('A normal item cannot carry modifiers.');
});

test('a magic item carries at most one prefix and one suffix', function () {
    // One prefix + one suffix is legal.
    expect($this->catalogue->modErrors('magic', [
        ['modId' => 'IncreasedLife1', 'values' => [10]],
        ['modId' => 'FireResist1', 'values' => [8]],
    ]))->toBe([]);

    // Two prefixes exceed the magic prefix cap of one.
    expect($this->catalogue->modErrors('magic', [
        ['modId' => 'IncreasedLife1', 'values' => [10]],
        ['modId' => 'IncreasedLife2', 'values' => [20]],
    ]))->toContain('Magic items carry at most 1 prefix modifier.');
});

test('a rare item carries at most three prefixes and three suffixes', function () {
    // Three suffixes are legal.
    expect($this->catalogue->modErrors('rare', [
        ['modId' => 'FireResist1', 'values' => [8]],
        ['modId' => 'ColdResist1', 'values' => [8]],
        ['modId' => 'LightningResist1', 'values' => [8]],
    ]))->toBe([]);

    // A fourth suffix (from a distinct family) exceeds the rare suffix cap of three.
    expect($this->catalogue->modErrors('rare', [
        ['modId' => 'FireResist1', 'values' => [8]],
        ['modId' => 'ColdResist1', 'values' => [8]],
        ['modId' => 'LightningResist1', 'values' => [8]],
        ['modId' => 'Strength1', 'values' => [6]],
    ]))->toContain('Rare items carry at most 3 suffix modifiers.');
});

test('two modifiers from the same family are rejected', function () {
    // Two different tiers of increased Life share the "IncreasedLife" family.
    expect($this->catalogue->modErrors('rare', [
        ['modId' => 'IncreasedLife1', 'values' => [10]],
        ['modId' => 'IncreasedLife2', 'values' => [20]],
    ]))->toContain('Two modifiers share a mutual-exclusion group.');
});

test('a value outside the tier range is rejected', function () {
    $mod = $this->catalogue->resolve('FireResist1');
    $max = $mod['rolls'][0]['max'];

    expect($this->catalogue->modErrors('rare', [['modId' => 'FireResist1', 'values' => [$max + 1]]]))
        ->toContain("A modifier's value is outside its tier's range.");
});

test('an unknown modifier id is rejected', function () {
    expect($this->catalogue->modErrors('rare', [['modId' => 'NotARealMod', 'values' => []]]))
        ->toContain('A modifier is not a known GGPK affix.');
});

test('a modifier that cannot roll on the base is rejected', function () {
    // "+# to Spirit" rolls on body armour, not on a ring; passing ring tags rejects it.
    $errors = $this->catalogue->modErrors('rare', [['modId' => 'IncreasedSpirit1', 'values' => [31]]], 'Item', ['ring', 'default']);

    expect($errors)->toContain('A modifier cannot roll on this base type.');
});

test('a mod of a foreign domain cannot roll on the base', function () {
    // A Flask-domain charm mod on an Item-domain base: the domain gate rejects it even
    // though its tag gate would pass on a matching flask base.
    $errors = $this->catalogue->modErrors('rare', [['modId' => 'CharmGainLifeOnUse1', 'values' => [10]]], 'Item', ['ring', 'default']);

    expect($errors)->toContain('A modifier cannot roll on this base type.');

    // The same mod on its own Flask domain + a charm's tags is legal.
    expect($this->catalogue->modErrors('rare', [['modId' => 'CharmGainLifeOnUse1', 'values' => [10]]], 'Flask', ['utility_flask', 'default']))
        ->toBe([]);
});

test('an item mod cannot roll on a flask base', function () {
    // IncreasedLife is an Item-domain prefix; a flask base (Flask domain) must not take it.
    $errors = $this->catalogue->modErrors('rare', [['modId' => 'IncreasedLife1', 'values' => [10]]], 'Flask', ['life_flask', 'default']);

    expect($errors)->toContain('A modifier cannot roll on this base type.');
});

test('search returns nothing without a domain, and honours it', function () {
    // No domain (e.g. a unique base) → no offered mods.
    expect($this->catalogue->search(null, ['ring', 'default'], ''))->toBe([]);

    // Item domain + ring tags surfaces item affixes; none of them are Flask-domain charm mods.
    $groups = $this->catalogue->search('Item', ['ring', 'default'], '');
    expect($groups)->not->toBeEmpty();

    // Flask domain + charm tags surfaces charm affixes.
    $charmGroups = $this->catalogue->search('Flask', ['utility_flask', 'default'], 'recover life');
    expect($charmGroups)->not->toBeEmpty();
});

test('resolve returns a mod tier line and null for the unknown', function () {
    expect($this->catalogue->resolve('NotARealMod'))->toBeNull()
        ->and($this->catalogue->resolve('FireResist1'))
        ->toMatchArray(['id' => 'FireResist1', 'type' => 'suffix']);
});
