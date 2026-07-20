<?php

declare(strict_types=1);

use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Pob\PobImport;
use App\Support\Planner\PlanSchema;
use App\Support\Planner\PobPlanMapper;

function mapFixture(string $file): array
{
    $snapshot = (new PobImport)->import(file_get_contents(dirname(__DIR__, 2)."/resources/pob/poe2/{$file}"));

    return new PobPlanMapper(new IconResolver, new ModCatalogue)->map($snapshot);
}

const WITCH_BUILD = 'witch-lvl80-runes-of-aldur-league.txt';

// A rare-heavy Witchhunter carrying a divided leech roll (7.24%), a hybrid
// armour/evasion prefix and a quality-inflated defence line the import must drop.
const MERC_BUILD = 'mercenary-lvl86-witchhunter-leech-hybrid.txt';

// A lvl97 Witchhunter whose gear exercises the import's edge cases: desecrated
// (Well of Souls) dual resistances, corrupted items, a catalyst-inflated dexterity
// roll, flask charge gain rendered per second, and the instant-recovery hybrid.
const DESECRATED_BUILD = 'mercenary-lvl97-witchhunter-desecrated-corrupted.txt';

// A lvl100 Monk whose boots carry a desecrated resistance line ahead of a hybrid
// evasion/energy-shield/stun-threshold affix rendered as three separate lines
// (regression fixture for the order-dependent aggregate-splitter bug below).
const MONK_BUILD = 'monk-lvl100-runeforged-desecrated-corrupted.txt';

it('maps the build class and resolves the ascendancy to its live tree id', function () {
    $data = mapFixture(WITCH_BUILD);

    expect($data['mode'])->toBe('single')
        ->and($data['build']['className'])->toBe('Witch')
        // Lich is the witch fixture's ascendancy; the planner stores the tree id, not the name.
        ->and($data['build']['ascendId'])->toBe('Witch3');
});

it('titles the plan from the ascendancy and level', function () {
    $snapshot = (new PobImport)->import(file_get_contents(dirname(__DIR__, 2).'/resources/pob/poe2/'.WITCH_BUILD));

    expect(new PobPlanMapper(new IconResolver, new ModCatalogue)->title($snapshot))
        ->toBe('Lich · Level 80');
});

it('carries the full passive allocation and tree version', function () {
    $allocation = mapFixture(WITCH_BUILD)['sections'][PlanSchema::SINGLE_KEY]['tree']['allocation'];

    expect($allocation['allocated'])->toHaveCount(111)
        ->and($allocation['allocated'])->each->toBeInt()
        ->and($allocation['treeVersion'])->not->toBe('');
});

it('maps skill groups to gem-reference groups with resolvable gem ids', function () {
    $groups = mapFixture(WITCH_BUILD)['sections'][PlanSchema::SINGLE_KEY]['gems']['groups'];
    $icons = new IconResolver;

    expect($groups)->not->toBeEmpty();

    foreach ($groups as $group) {
        expect($group['gems'])->not->toBeEmpty();

        foreach ($group['gems'] as $gem) {
            expect($gem['type'])->toBe('gem')
                ->and($icons->resolveReference('gem', $gem['id']))->not->toBeNull();
        }
    }
});

it('maps equipment to known planner slots with base references', function () {
    $slots = mapFixture(WITCH_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];

    expect($slots)->toHaveKey('belt')
        ->and($slots['belt']['rarity'])->toBe('rare')
        ->and($slots['belt']['base'])->toBe(['type' => 'base', 'id' => 'Plate Belt'])
        // Every mapped slot key is a real planner equipment slot.
        ->and(array_diff(array_keys($slots), PlanSchema::EQUIPMENT_SLOTS))->toBe([]);
});

it('reverse-matches rare item mods to in-range GGPK affixes', function () {
    $belt = mapFixture(WITCH_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['belt'];

    // "+100 to maximum Life" and "+25% to Cold Resistance" resolve to real affix ids.
    $modIds = array_column($belt['stats'], 'modId');

    expect($belt['stats'])->not->toBeEmpty()
        ->and($modIds)->toContain('IncreasedLife8')
        ->and($modIds)->toContain('ColdResist4');
});

it('produces items that pass the planner and affix validation rules', function (string $build) {
    $data = PlanSchema::canonicalize(mapFixture($build));
    $slots = $data['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];
    $icons = new IconResolver;
    $catalogue = new ModCatalogue;

    foreach ($slots as $slotKey => $item) {
        $isBase = ($item['base']['type'] ?? null) === 'base';
        $domain = $isBase ? $icons->itemModDomain($item['base']['id']) : null;
        $tags = $isBase ? $icons->itemTags($item['base']['id']) : [];
        $itemClass = $isBase ? $icons->itemClass($item['base']['id']) : null;

        expect(PlanSchema::itemErrors($slotKey, $item))->toBe([])
            ->and($catalogue->modErrors($item['rarity'], $item['stats'], $domain, $tags, $itemClass))->toBe([]);
    }
})->with([WITCH_BUILD, MERC_BUILD, DESECRATED_BUILD]);

it('matches a divided roll (leech %) in display scale, not the raw stat value', function () {
    $catalogue = new ModCatalogue;
    $gloves = mapFixture(MERC_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['gloves'];

    // "Leech 7.24% of Physical Attack Damage as Life" resolves to a real leech affix and
    // keeps its fractional display value - the affix's tier ranges are display-scale, so
    // the value falls in range (a raw-scale range like 700-790 would drop it). More than
    // one affix id can carry the LifeLeech family (the natural ladder and a trade-verified
    // overlay both cover Gloves), so the family - not a specific id prefix - is what
    // identifies the match here.
    $leech = collect($gloves['stats'])->first(
        fn (array $stat): bool => $stat['family'] === 'LifeLeech',
    );

    expect($leech)->not->toBeNull()
        ->and($leech['values'])->toBe([7.24])
        ->and($catalogue->modErrors($gloves['rarity'], $gloves['stats']))->toBe([]);
});

it('matches a hybrid affix across its several rendered lines', function () {
    $catalogue = new ModCatalogue;
    $body = mapFixture(MERC_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['body'];

    // A two-stat armour/evasion prefix renders as two PoB lines; the mapper matches both
    // at once into one affix id carrying both rolled values.
    $hybrid = collect($body['stats'])->first(function (array $stat) use ($catalogue): bool {
        $mod = $catalogue->resolve($stat['modId']);

        return $mod !== null && count($mod['stats']) > 1;
    });

    expect($hybrid)->not->toBeNull()
        ->and($hybrid['values'])->toHaveCount(2)
        ->and($catalogue->modErrors($body['rarity'], $body['stats']))->toBe([]);
});

it('decomposes a summed defence line into real affixes whose totals match the game', function () {
    $catalogue = new ModCatalogue;
    $gloves = mapFixture(MERC_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['gloves'];

    // Sum every mod's contribution per GGPK stat id - the same grouping the game shows.
    $byStat = [];

    foreach ($gloves['stats'] as $stat) {
        foreach ($catalogue->resolve($stat['modId'])['rolls'] as $index => $roll) {
            $byStat[$roll['stat']] = ($byStat[$roll['stat']] ?? 0) + $stat['values'][$index];
        }
    }

    // The glove's summed lines are "135% increased Armour and Evasion" and "+149 to
    // maximum Life"; the split's exact tiers aren't recoverable, but the totals must match
    // and every emitted mod is a real GGPK affix (so validation passes).
    expect($byStat['local_armour_and_evasion_+%'])->toBe(135)
        ->and($byStat['base_maximum_life'])->toBe(149)
        ->and($catalogue->modErrors($gloves['rarity'], $gloves['stats']))->toBe([]);
});

it('assigns an ambiguous mod the type that keeps the item legal', function () {
    $catalogue = new ModCatalogue;
    $helmet = mapFixture(MERC_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['helmet'];

    $counts = ['prefix' => 0, 'suffix' => 0];
    $ids = [];

    foreach ($helmet['stats'] as $stat) {
        $counts[$catalogue->resolve($stat['modId'])['type']]++;
        $ids[] = $stat['modId'];
    }

    // "17% increased Rarity of Items found" fits both a prefix and a suffix. The suffixes
    // are already full (deflection, life regen, the crafted cold resistance), so rarity must
    // take the open prefix slot - otherwise the crafted cold resistance would be dropped.
    expect($counts)->toBe(['prefix' => 3, 'suffix' => 3])
        ->and($ids)->toContain('ItemFoundRarityIncreasePrefix3')
        ->and($ids)->toContain('ColdResist6');
});

it('imports the item name and defensive properties from PoB', function () {
    $gloves = mapFixture(MERC_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['gloves'];

    // The rolled name ("Beast Knuckle", distinct from its "Cultist Gauntlets" base) comes
    // across; Quality 20, Armour 276, Evasion 254 and no energy shield or block - carried
    // onto the item as its properties, str/dex/int gone.
    expect($gloves['name'])->toBe('Beast Knuckle')
        ->and($gloves['corrupted'])->toBe(false)
        ->and($gloves['props'])->toBe([
            'quality' => 20,
            'armour' => 276,
            'evasion' => 254,
            'energyShield' => 0,
            'block' => 0,
        ]);
});

it('imports the item level from PoB', function () {
    $slots = mapFixture(MERC_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];

    // Every equipped item in a PoB export carries an "Item Level:" line; the mapper
    // brings it across and canonicalize() keeps it inside 1..100.
    expect($slots['gloves']['itemLevel'])->toBeInt()
        ->and($slots['gloves']['itemLevel'])->toBeGreaterThanOrEqual(1)
        ->and($slots['gloves']['itemLevel'])->toBeLessThanOrEqual(PlanSchema::MAX_ITEM_LEVEL);
});

/**
 * Whether the live extract carries the desecrated mod domain and essence-only mods
 * (extracts before that carry only soul-tagged and naturally rolling affixes). Contract
 * expectations that depend on those extra mods branch on this, so the suite passes on
 * either data generation - the CI release gate runs it against a staged extract.
 */
function catalogueCarriesCraftOnlyMods(): bool
{
    return new ModCatalogue()->resolve('AbyssModGenWeaponAmanamuSuffixSpiritReservationEfficiency') !== null;
}

it('imports the corrupted flag and rolled name from PoB', function () {
    $slots = mapFixture(DESECRATED_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];

    // The body armour ("Rift Pelt", a "Slipstrike Vest") and boots are corrupted in this
    // build; everything else on it is not.
    expect($slots['body']['corrupted'])->toBe(true)
        ->and($slots['body']['name'])->toBe('Rift Pelt')
        ->and($slots['boots']['corrupted'])->toBe(true)
        ->and($slots['helmet']['corrupted'])->toBe(false)
        ->and($slots['helmet']['name'])->toBe('Constricting Command');
});

it('matches desecrated affixes that never roll naturally', function () {
    $slots = mapFixture(DESECRATED_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];
    $catalogue = new ModCatalogue;

    // "+16% to Fire and Chaos Resistances" never rolls naturally - it comes from the
    // Well of Souls (a soul-tag suffix, or a desecrated-domain mod in newer extracts) -
    // so the natural tag gate alone would drop it.
    $dualResist = collect($slots['belt']['stats'])->first(function (array $stat) use ($catalogue): bool {
        $mod = $catalogue->resolve($stat['modId']);

        return $mod !== null && str_contains(implode(' ', $mod['stats']), 'Fire and Chaos Resistances');
    });

    expect($dualResist)->not->toBeNull()
        ->and($dualResist['values'])->toBe([16]);
});

it('keeps natural affixes ahead of desecrated hybrids that would swallow them', function () {
    $slots = mapFixture(DESECRATED_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];

    // The belt's adjacent "+156 to maximum Life" / "+74 to maximum Mana" lines fit the
    // desecrated life+mana hybrid, but they are two natural mods; the natural pass must
    // claim them before desecrated candidates ever compete (longest match would win).
    $belt = array_column($slots['belt']['stats'], 'values', 'modId');

    expect($belt)->not->toHaveKey('SoulInfluenceIncreasedLifeAndMana')
        ->and($belt['IncreasedLife10'] ?? null)->toBe([156])
        ->and($belt['IncreasedMana6'] ?? null)->toBe([74]);
});

it('matches a desecration-bumped tier its ladder unlocks on the base', function () {
    $slots = mapFixture(DESECRATED_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];

    // "+34 to Dexterity" exceeds every naturally rolling ring tier (T8 caps at 33);
    // T9 (34-36) has no positive spawn weight anywhere - only desecration bumps into
    // it - and lands because the Dexterity ladder itself rolls on rings.
    $ring = array_column($slots['ring1']['stats'], 'values', 'modId');

    expect($ring)->toHaveKey('Dexterity9')
        ->and($ring['Dexterity9'])->toBe([34]);
});

it('matches flask mods across per-minute renders and the instant-recovery hybrid', function () {
    $catalogue = new ModCatalogue;
    $slots = mapFixture(DESECRATED_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];

    // PoB renders "Gains 0.25 Charges per Second" while GGPK stores the roll per minute
    // (a 15); the stored value always sits in the tier's own scale, whichever the live
    // extract uses. The Seething hybrid renders its lines in reverse stat order, shows
    // no number for the boolean "Instant Recovery" roll and its -50 roll as "50% reduced".
    $flask = array_column($slots['flask1']['stats'], 'values', 'modId');
    $charm = array_column($slots['charm2']['stats'], 'values', 'modId');

    expect($flask['FlaskFillChargesPerMinute3'] ?? null)
        ->toBe([$catalogue->resolve('FlaskFillChargesPerMinute3')['rolls'][0]['max']])
        ->and($flask['FlaskFullInstantRecovery1'] ?? null)->toBe([1, -50])
        ->and($charm['FlaskFillChargesPerMinute1'] ?? null)
        ->toBe([$catalogue->resolve('FlaskFillChargesPerMinute1')['rolls'][0]['max']]);
});

it('matches essence-only and desecrated weapon mods when the extract carries them', function () {
    $slots = mapFixture(DESECRATED_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];
    $weapon = array_column($slots['weapon1']['stats'], 'values', 'modId');

    // Essence mods carry no positive spawn weight (gated by item class instead) and
    // desecrated mods live in their own mod domain; both resolve on the crossbow.
    expect($weapon['EssenceDamageasExtraCold2H'] ?? null)->toBe([29])
        ->and($weapon['EssenceOnslaughtonKill1'] ?? null)->toBe([22])
        ->and($weapon['AbyssModGenWeaponAmanamuSuffixSpiritReservationEfficiency'] ?? null)->toBe([7]);
})->skip(fn (): bool => ! catalogueCarriesCraftOnlyMods(), 'live extract predates craft-only mods');

it('never drops an equipment mod line - unmatched wordings are kept as plain text instead', function () {
    $snapshot = (new PobImport)->import(file_get_contents(dirname(__DIR__, 2).'/resources/pob/poe2/'.DESECRATED_BUILD));
    $mapper = new PobPlanMapper(new IconResolver, new ModCatalogue);
    $data = $mapper->map($snapshot);

    // Corrupted flag lines, desecrated dual resistances, catalyst-inflated rolls and
    // flask renders all resolve to real affixes. On a current extract only "+5 to Level
    // of all Attack Skills" doesn't - no Mods row rolls above +3, so the render cannot
    // be explained; an older extract also lacks the essence/desecrated weapon mods
    // entirely. Either way nothing is lost anymore: an unmatched line is stored as a
    // plain-text stat (no modId) rather than reported as dropped.
    $weapon1 = $data['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['weapon1'];
    $plainText = collect($weapon1['stats'])->filter(fn (array $stat): bool => $stat['modId'] === null)->pluck('text')->values()->all();

    expect($plainText)->toBe(
        catalogueCarriesCraftOnlyMods()
            ? ['+5 to Level of all Attack Skills']
            : [
                '7% increased Spirit Reservation Efficiency of Skills',
                'Gain 29% of Damage as Extra Cold Damage',
                '+5 to Level of all Attack Skills',
                '22% chance to gain Onslaught on Killing Hits with this Weapon',
            ],
    )
        ->and($mapper->droppedMods())->toBe([]);
});

it('matches a hybrid affix\'s companion stat even when a preceding unrelated line already matched', function () {
    $snapshot = (new PobImport)->import(file_get_contents(dirname(__DIR__, 2).'/resources/pob/poe2/'.MONK_BUILD));
    $mapper = new PobPlanMapper(new IconResolver, new ModCatalogue);
    $data = $mapper->map($snapshot);

    $boots = $data['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['boots'];
    $stunThreshold = collect($boots['stats'])->first(
        fn (array $stat): bool => in_array(61, $stat['values'], true),
    );

    // "+61 to Stun Threshold" is the companion stat of a hybrid rendered as its own
    // line, with a desecrated resistance line ahead of it in the render order. It
    // must resolve into the hybrid, not disappear as a leftover "already explained
    // elsewhere" duplicate.
    expect($stunThreshold)->not->toBeNull()
        ->and($mapper->droppedMods())->not->toHaveKey('boots');
});

it('falls back to the general GGPK affix pool for a plainly-worded unique mod its own catalogue misses', function () {
    // The unique-catalogue path (PobUniqueStore) needs container-resolved services,
    // unlike the GGPK-only paths above - a bare `new` here would find no synced
    // catalogue for Skysliver at all, short-circuiting before the fallback ever runs.
    $snapshot = app(PobImport::class)->import(file_get_contents(dirname(__DIR__, 2).'/resources/pob/poe2/'.MONK_BUILD));
    $mapper = app(PobPlanMapper::class);
    $data = $mapper->map($snapshot);

    $weapon1 = $data['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['weapon1'];

    // Skysliver's "Adds 1 to 107 Lightning Damage" isn't in the synced PoB-uniques
    // catalogue, but it's a perfectly ordinary GGPK weapon affix - the fallback must
    // find it there instead of leaving it dropped.
    expect($weapon1['base'])->toBe(['type' => 'unique', 'id' => 'Skysliver'])
        ->and(array_column($weapon1['uniqueMods'], 'key'))->toContain('Grants Skill: Spear Throw')
        ->and(array_column($weapon1['uniqueMods'], 'key'))->toContain('No Physical Damage')
        ->and(array_column($weapon1['uniqueMods'], 'key'))->toContain('Rolls only the minimum or maximum Damage value for each Damage Type')
        ->and($weapon1['uniqueMods'])->toContain(['key' => 'Adds # to # Lightning Damage', 'values' => [1, 107]])
        ->and($weapon1['uniqueMods'])->toContain(['key' => '#% increased Attack Speed', 'values' => [30.0]])
        ->and($weapon1['uniqueMods'])->toContain(['key' => '#% increased chance to Shock', 'values' => [73.0]])
        ->and($mapper->droppedMods())->not->toHaveKey('weapon1');
});

it('leaves a unique item without author mods but keeps its properties', function () {
    $slots = mapFixture(WITCH_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];

    $uniques = array_filter($slots, static fn (array $item): bool => $item['rarity'] === 'unique');

    expect($uniques)->not->toBeEmpty();

    foreach ($uniques as $item) {
        // A unique carries its own modifiers, so none are authored; its defensive
        // properties come across as the only way to record the unique's defences.
        expect($item['stats'])->toBe([])
            ->and($item)->not->toHaveKey('req.str')
            ->and($item['props'])->toHaveKeys(['quality', 'armour', 'evasion', 'energyShield', 'block']);
    }
});
