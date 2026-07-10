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

it('produces items that pass the planner and affix validation rules', function () {
    $data = PlanSchema::canonicalize(mapFixture(WITCH_BUILD));
    $slots = $data['sections'][PlanSchema::SINGLE_KEY]['items']['slots'];
    $icons = new IconResolver;
    $catalogue = new ModCatalogue;

    foreach ($slots as $slotKey => $item) {
        $isBase = ($item['base']['type'] ?? null) === 'base';
        $domain = $isBase ? $icons->itemModDomain($item['base']['id']) : null;
        $tags = $isBase ? $icons->itemTags($item['base']['id']) : [];

        expect(PlanSchema::itemErrors($slotKey, $item))->toBe([])
            ->and($catalogue->modErrors($item['rarity'], $item['stats'], $domain, $tags))->toBe([]);
    }
});

it('matches a divided roll (leech %) in display scale, not the raw stat value', function () {
    $catalogue = new ModCatalogue;
    $gloves = mapFixture(MERC_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['gloves'];

    // "Leech 7.24% of Physical Attack Damage as Life" resolves to a real leech affix and
    // keeps its fractional display value - the affix's tier ranges are display-scale, so
    // the value falls in range (a raw-scale range like 700-790 would drop it).
    $leech = collect($gloves['stats'])->first(
        fn (array $stat): bool => str_starts_with((string) $stat['modId'], 'LifeLeech'),
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

it('imports the item level requirement and defensive properties from PoB', function () {
    $gloves = mapFixture(MERC_BUILD)['sections'][PlanSchema::SINGLE_KEY]['items']['slots']['gloves'];

    // The Cultist Gauntlets show Quality 20, Armour 276, Evasion 254, LevelReq 75 and no
    // energy shield or block - carried onto the item as its properties, str/dex/int gone.
    expect($gloves['req'])->toBe(['level' => 75])
        ->and($gloves['props'])->toBe([
            'quality' => 20,
            'armour' => 276,
            'evasion' => 254,
            'energyShield' => 0,
            'block' => 0,
        ]);
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
