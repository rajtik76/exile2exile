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

        // A desecration-bumped top tier of the same ladder: no positive weight anywhere,
        // reachable only where a sibling tier rolls naturally.
        ['id' => 'IncreasedLife3', 'name' => 'Overflowing', 'domain' => 'Item', 'group' => 'IncreasedLife', 'type' => 'prefix', 'tier' => 3, 'level' => 50, 'stats' => ['+# to maximum Life'], 'rolls' => [['stat' => 'life', 'min' => 26, 'max' => 35]], 'families' => ['IncreasedLife'], 'spawnWeights' => [['tag' => 'default', 'weight' => 0]]],

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

        // A desecrated ("Soul Influence") suffix: its only positive weight is the soul
        // tag, so it reaches any base solely through the Well of Souls.
        ['id' => 'SoulDualResist1', 'name' => 'of Souls', 'domain' => 'Item', 'group' => 'FireChaosResistance', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['+#% to Fire and Chaos Resistances'], 'rolls' => [['stat' => 'fire_chaos_resist', 'min' => 3, 'max' => 31]], 'families' => ['FireChaosResist'], 'spawnWeights' => [['tag' => 'soul', 'weight' => 1], ['tag' => 'default', 'weight' => 0]]],

        // A class-restricted, zero-weight-everywhere tier sharing its group with
        // SoulDualResist1 above: the soul-tagged sibling always has a positive
        // matchingWeight (soul is always-carried), so the natural-ladder fallback
        // must still respect this tier's own itemClasses AND, not just borrow the
        // sibling's reach.
        ['id' => 'FireChaosResistanceGlovesOnly1', 'name' => 'of Warded Souls', 'domain' => 'Item', 'group' => 'FireChaosResistance', 'type' => 'suffix', 'tier' => 2, 'level' => 1, 'stats' => ['+#% to Fire and Chaos Resistances'], 'rolls' => [['stat' => 'fire_chaos_resist', 'min' => 32, 'max' => 40]], 'families' => ['FireChaosResist'], 'spawnWeights' => [['tag' => 'default', 'weight' => 0]], 'itemClasses' => ['Gloves']],

        // A desecrated mod that zeroes body armour ahead of its soul tag: GGG's
        // first-match weights exclude it there even though desecration allows it elsewhere.
        ['id' => 'SoulNotOnBody1', 'name' => 'of Buried Souls', 'domain' => 'Item', 'group' => 'SoulThorns', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['# to Physical Thorns damage'], 'rolls' => [['stat' => 'thorns', 'min' => 1, 'max' => 9]], 'families' => ['SoulThorns'], 'spawnWeights' => [['tag' => 'body_armour', 'weight' => 0], ['tag' => 'soul', 'weight' => 1], ['tag' => 'default', 'weight' => 0]]],

        // A desecrated-domain mod (the extractor folds domain 28 into Item with the
        // flag): scoped by its ordinary tag weights, it just never rolls naturally.
        ['id' => 'BoneSpirit1', 'name' => 'of the Bones', 'domain' => 'Item', 'group' => 'BoneSpirit', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['#% increased Spirit Reservation Efficiency of Skills'], 'rolls' => [['stat' => 'spirit_efficiency', 'min' => 5, 'max' => 10]], 'families' => ['BoneSpirit'], 'spawnWeights' => [['tag' => 'body_armour', 'weight' => 1], ['tag' => 'default', 'weight' => 0]], 'desecrated' => true, 'essence' => false, 'itemClasses' => []],

        // An essence-only mod: every spawn weight is zero (an essence targets item
        // classes directly), so the catalogue's itemClasses list is its only gate.
        ['id' => 'EssenceExtraCold1', 'name' => 'of Ice', 'domain' => 'Item', 'group' => 'EssenceExtraCold', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['Gain #% of Damage as Extra Cold Damage'], 'rolls' => [['stat' => 'extra_cold', 'min' => 25, 'max' => 33]], 'families' => ['EssenceExtraCold'], 'spawnWeights' => [['tag' => 'default', 'weight' => 0]], 'desecrated' => false, 'essence' => true, 'itemClasses' => ['Crossbow', 'Two Hand Sword']],

        // A Kalguuran genesis-tree mod: its only positive weight is a genesis tag, and
        // the belt zero ahead of it keeps it off belts (GGG first-match semantics).
        ['id' => 'GenesisSpellDamage1', 'name' => 'Runic', 'domain' => 'Item', 'group' => 'GenesisSpellDamage', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['#% increased Spell Damage'], 'rolls' => [['stat' => 'spell_damage', 'min' => 26, 'max' => 29]], 'families' => ['GenesisSpellDamage'], 'spawnWeights' => [['tag' => 'belt', 'weight' => 0], ['tag' => 'genesis_tree_caster', 'weight' => 1], ['tag' => 'default', 'weight' => 0]]],

        // A boss-influence mod (BerserkInfluence-style): its only positive weight is an
        // influence tag no base carries.
        ['id' => 'InfluenceMaxRage1', 'name' => 'Berserker\'s', 'domain' => 'Item', 'group' => 'InfluenceMaxRage', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to Maximum Rage'], 'rolls' => [['stat' => 'max_rage', 'min' => 10, 'max' => 15]], 'families' => ['InfluenceMaxRage'], 'spawnWeights' => [['tag' => 'berserking', 'weight' => 1], ['tag' => 'default', 'weight' => 0]]],
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

test('a searched tier carries the real GGG affix name, not just the group label', function () {
    // ModPicker.tsx freezes this straight into a manually picked stat's snapshot -
    // without it, BuildFilterBuilder can never see the mod (it reads `name` off the
    // frozen stat, never re-resolving live). Regression for a real bug: `search()`
    // used to omit `name` from a tier entirely.
    $tier = collect($this->catalogue->search('Item', ['ring', 'default'], ''))
        ->flatMap(fn (array $group): array => $group['tiers'])
        ->first();

    expect($tier)->not->toBeNull()
        ->and($tier['name'])->toBeString()
        ->and($tier['name'])->not->toBe('');
});

test('a desecrated mod is legal on any base its weights do not zero', function () {
    // The soul tag counts as always carried: the Well of Souls can put the mod on an
    // ordinary rare, so validation accepts it even though it never rolls naturally.
    expect($this->catalogue->modErrors('rare', [['modId' => 'SoulDualResist1', 'values' => [16]]], 'Item', ['ring', 'default']))
        ->toBe([]);
});

test('a natural-ladder tier still honours its own itemClasses AND against a soul-tagged sibling', function () {
    // FireChaosResistanceGlovesOnly1 has no positive weight anywhere and reaches a
    // base only through its ladder sibling SoulDualResist1 - which always matches
    // (soul is always-carried), on ANY base. Without the itemClasses AND on that
    // fallback path, the gloves-only tier would leak onto a ring too. Regression for
    // a real bug: this AND was applied on the weight/essence branches but not here.
    expect($this->catalogue->modErrors('rare', [['modId' => 'FireChaosResistanceGlovesOnly1', 'values' => [35]]], 'Item', ['ring', 'default'], 'Ring'))
        ->toContain('A modifier cannot roll on this base type.')
        ->and($this->catalogue->modErrors('rare', [['modId' => 'FireChaosResistanceGlovesOnly1', 'values' => [35]]], 'Item', ['gloves', 'default'], 'Gloves'))
        ->toBe([]);

    $tierIds = collect($this->catalogue->search('Item', ['ring', 'default'], '', 60, 'Ring'))
        ->firstWhere('group', 'FireChaosResistance')['tiers'] ?? [];

    expect(collect($tierIds)->pluck('id'))->not->toContain('FireChaosResistanceGlovesOnly1');
});

test('search flags desecrated-only tiers apart from natural ones', function () {
    $groups = collect($this->catalogue->search('Item', ['ring', 'default'], ''));

    $soul = $groups->firstWhere('group', 'FireChaosResistance');
    $natural = $groups->firstWhere('group', 'FireResistance');

    expect($soul['tiers'][0]['desecrated'])->toBeTrue()
        ->and($natural['tiers'][0]['desecrated'])->toBeFalse();
});

test('a zeroed base tag ahead of the soul tag still excludes the mod', function () {
    // GGG's weights are first-match: body armour's zero wins over the later soul weight.
    $errors = $this->catalogue->modErrors('rare', [['modId' => 'SoulNotOnBody1', 'values' => [5]]], 'Item', ['body_armour', 'default']);

    expect($errors)->toContain('A modifier cannot roll on this base type.')
        ->and(collect($this->catalogue->search('Item', ['body_armour', 'default'], ''))->firstWhere('group', 'SoulThorns'))->toBeNull()
        // A base the mod does not zero takes it through desecration.
        ->and($this->catalogue->modErrors('rare', [['modId' => 'SoulNotOnBody1', 'values' => [5]]], 'Item', ['ring', 'default']))->toBe([]);
});

test('an essence-only mod is gated by item class, leniently without one', function () {
    $mod = [['modId' => 'EssenceExtraCold1', 'values' => [29]]];

    // On a matching class it is legal; on a foreign class it cannot land; with no
    // class known (no base picked, or a caller without class data) the gate is lenient.
    expect($this->catalogue->modErrors('rare', $mod, 'Item', ['weapon', 'default'], 'Crossbow'))->toBe([])
        ->and($this->catalogue->modErrors('rare', $mod, 'Item', ['ring', 'default'], 'Ring'))
        ->toContain('A modifier cannot roll on this base type.')
        ->and($this->catalogue->modErrors('rare', $mod, 'Item', ['ring', 'default']))->toBe([]);
});

test('search honours the item class for essence-only mods and flags them', function () {
    $forCrossbow = collect($this->catalogue->search('Item', ['weapon', 'default'], '', 60, 'Crossbow'));
    $forRing = collect($this->catalogue->search('Item', ['ring', 'default'], '', 60, 'Ring'));

    expect($forCrossbow->firstWhere('group', 'EssenceExtraCold')['tiers'][0]['essence'])->toBeTrue()
        ->and($forRing->firstWhere('group', 'EssenceExtraCold'))->toBeNull();
});

test('a desecrated-domain mod keeps its tag scoping and its flag', function () {
    // BoneSpirit1 carries an ordinary body_armour weight (it lands there through
    // desecration); a weapon does not take it, and its tiers are flagged desecrated.
    $forBody = collect($this->catalogue->search('Item', ['body_armour', 'default'], ''));
    $forWeapon = collect($this->catalogue->search('Item', ['weapon', 'default'], ''));

    expect($forBody->firstWhere('group', 'BoneSpirit')['tiers'][0]['desecrated'])->toBeTrue()
        ->and($forWeapon->firstWhere('group', 'BoneSpirit'))->toBeNull()
        ->and($this->catalogue->modErrors('rare', [['modId' => 'BoneSpirit1', 'values' => [7]]], 'Item', ['body_armour', 'default']))->toBe([]);
});

test('a desecration-bumped tier lands where its own ladder rolls', function () {
    // IncreasedLife3 has no positive weight anywhere; its ladder (IncreasedLife1-2)
    // rolls on any Item base here, so desecration can bump into it - and search flags
    // it desecrated. A ladder foreign to the base still fails (Spirit is body-only).
    expect($this->catalogue->modErrors('rare', [['modId' => 'IncreasedLife3', 'values' => [30]]], 'Item', ['ring', 'default']))
        ->toBe([]);

    $ladder = collect($this->catalogue->search('Item', ['ring', 'default'], ''))->firstWhere('group', 'IncreasedLife');
    $tiers = collect($ladder['tiers'])->keyBy('id');

    expect($tiers['IncreasedLife3']['desecrated'])->toBeTrue()
        ->and($tiers['IncreasedLife1']['desecrated'])->toBeFalse()
        ->and(collect($this->catalogue->search('Item', ['ring', 'default'], ''))->firstWhere('group', 'Spirit'))->toBeNull();
});

test('a genesis-tree mod is legal on any base its weights do not zero', function () {
    $mod = [['modId' => 'GenesisSpellDamage1', 'values' => [28]]];

    // The genesis tags count as always carried (the tree puts the mod on ordinary
    // rares); the belt zero ahead of them still excludes it there.
    expect($this->catalogue->modErrors('rare', $mod, 'Item', ['ring', 'default']))->toBe([])
        ->and($this->catalogue->modErrors('rare', $mod, 'Item', ['belt', 'default']))
        ->toContain('A modifier cannot roll on this base type.');

    $forRing = collect($this->catalogue->search('Item', ['ring', 'default'], ''));

    expect($forRing->firstWhere('group', 'GenesisSpellDamage')['tiers'][0]['genesis'])->toBeTrue()
        ->and($forRing->firstWhere('group', 'FireResistance')['tiers'][0]['genesis'])->toBeFalse();
});

test('a boss-influence mod is legal on any base and flagged in search', function () {
    // The influence tag counts as always carried: influence puts the mod on ordinary
    // rares, so validation accepts it and search flags it apart from natural affixes.
    expect($this->catalogue->modErrors('rare', [['modId' => 'InfluenceMaxRage1', 'values' => [12]]], 'Item', ['ring', 'default']))
        ->toBe([]);

    $groups = collect($this->catalogue->search('Item', ['ring', 'default'], ''));

    expect($groups->firstWhere('group', 'InfluenceMaxRage')['tiers'][0]['influence'])->toBeTrue()
        ->and($groups->firstWhere('group', 'FireResistance')['tiers'][0]['influence'])->toBeFalse();
});

test('resolve returns a mod tier line and null for the unknown', function () {
    expect($this->catalogue->resolve('NotARealMod'))->toBeNull()
        ->and($this->catalogue->resolve('FireResist1'))
        ->toMatchArray(['id' => 'FireResist1', 'type' => 'suffix']);
});
