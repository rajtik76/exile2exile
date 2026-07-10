<?php

declare(strict_types=1);

use App\Pob\ModCatalogue;

/**
 * The mod catalogue enforces the game's affix rules against the GGPK mod table
 * (resources/poe2/ggpk/mods.json): per-rarity prefix/suffix counts, one modifier per
 * mutual-exclusion family, values inside the tier's range, and base compatibility.
 *
 * These tests exercise that LOGIC against a small arbitrary catalogue seeded onto the
 * mocked `game-data` disk - no real extract needed. Each fixture mod carries the shape
 * the real GGPK table has (domain, family, spawn weights, tier rolls); the concrete ids
 * and stat lines are invented purely to drive the rules.
 */

/**
 * A tiny hand-built mod catalogue that covers every rule the tests assert:
 * life prefixes sharing one family, three distinct-family resistances, an item mod that
 * only rolls on body armour, and a Flask-domain charm mod.
 *
 * @return list<array<string, mixed>>
 */
function arbitraryMods(): array
{
    $default = [['tag' => 'default', 'weight' => 1000]];

    return [
        // Two tiers of "increased Life": both prefixes, same mutual-exclusion family.
        ['id' => 'IncreasedLife1', 'name' => 'Hale', 'domain' => 'Item', 'group' => 'IncreasedLife', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to maximum Life'], 'rolls' => [['stat' => 'life', 'min' => 5, 'max' => 15]], 'families' => ['IncreasedLife'], 'spawnWeights' => $default],
        ['id' => 'IncreasedLife2', 'name' => 'Healthy', 'domain' => 'Item', 'group' => 'IncreasedLife', 'type' => 'prefix', 'tier' => 2, 'level' => 10, 'stats' => ['+# to maximum Life'], 'rolls' => [['stat' => 'life', 'min' => 15, 'max' => 25]], 'families' => ['IncreasedLife'], 'spawnWeights' => $default],

        // Three elemental resistances: suffixes, each its own family.
        ['id' => 'FireResist1', 'name' => 'of the Kiln', 'domain' => 'Item', 'group' => 'FireResistance', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['+#% to Fire Resistance'], 'rolls' => [['stat' => 'fire_resist', 'min' => 5, 'max' => 10]], 'families' => ['FireResist'], 'spawnWeights' => $default],
        ['id' => 'ColdResist1', 'name' => 'of the Tundra', 'domain' => 'Item', 'group' => 'ColdResistance', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['+#% to Cold Resistance'], 'rolls' => [['stat' => 'cold_resist', 'min' => 5, 'max' => 10]], 'families' => ['ColdResist'], 'spawnWeights' => $default],
        ['id' => 'LightningResist1', 'name' => 'of the Storm', 'domain' => 'Item', 'group' => 'LightningResistance', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['+#% to Lightning Resistance'], 'rolls' => [['stat' => 'lightning_resist', 'min' => 5, 'max' => 10]], 'families' => ['LightningResist'], 'spawnWeights' => $default],

        // A fourth, distinct-family suffix so a rare can be pushed one over its suffix cap.
        ['id' => 'Strength1', 'name' => 'of the Brute', 'domain' => 'Item', 'group' => 'Strength', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to Strength'], 'rolls' => [['stat' => 'strength', 'min' => 4, 'max' => 8]], 'families' => ['Strength'], 'spawnWeights' => $default],

        // "+# to Spirit": an Item-domain prefix that only spawns on body armour, never a ring.
        ['id' => 'IncreasedSpirit1', 'name' => 'Spirited', 'domain' => 'Item', 'group' => 'Spirit', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to Spirit'], 'rolls' => [['stat' => 'spirit', 'min' => 20, 'max' => 40]], 'families' => ['Spirit'], 'spawnWeights' => [['tag' => 'body_armour', 'weight' => 1000]]],

        // A Flask-domain charm mod: legal on a charm, foreign to any Item-domain base.
        ['id' => 'CharmGainLifeOnUse1', 'name' => 'Life-giving', 'domain' => 'Flask', 'group' => 'CharmLifeOnUse', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['Recover # Life when used'], 'rolls' => [['stat' => 'charm_life', 'min' => 5, 'max' => 20]], 'families' => ['CharmLifeOnUse'], 'spawnWeights' => [['tag' => 'default', 'weight' => 1000]]],
    ];
}

beforeEach(function () {
    fakeGameData(['resources/poe2/ggpk/mods.json' => arbitraryMods()]);
    $this->catalogue = new ModCatalogue;
});

/** A prefix mod ref rolled at its tier minimum (always in range). */
function prefixMod(): array
{
    return ['modId' => 'IncreasedLife1', 'values' => [10]];
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
