<?php

use App\Pob\IconResolver;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

test('the reference search returns matching gems', function () {
    $response = getJson(route('planner.references', ['q' => 'ice nova', 'type' => 'gem']));

    $response->assertOk()->assertJsonStructure([
        'results' => [['type', 'id', 'name', 'icon', 'category', 'tooltip']],
    ]);

    $results = $response->json('results');

    expect($results)->not->toBeEmpty()
        ->and(collect($results)->every(fn (array $r): bool => $r['type'] === 'gem'))->toBeTrue()
        ->and(collect($results)->pluck('name'))->toContain('Ice Nova');
});

test('the skill gem filter excludes support gems', function () {
    $results = collect(getJson(route('planner.references', [
        'q' => 'fire',
        'type' => 'gem',
        'gemKind' => 'skill',
    ]))->assertOk()->json('results'));

    // A group's first slot only takes an active or spirit skill - never a support.
    expect($results)->not->toBeEmpty()
        ->and($results->pluck('category')->unique()->all())->not->toContain('Support Gem')
        ->and($results->every(fn (array $r): bool => in_array($r['category'], ['Skill Gem', 'Spirit Gem'], true)))->toBeTrue();
});

test('the support gem filter returns only support gems', function () {
    $results = collect(getJson(route('planner.references', [
        'q' => 'fire',
        'type' => 'gem',
        'gemKind' => 'support',
    ]))->assertOk()->json('results'));

    expect($results)->not->toBeEmpty()
        ->and($results->pluck('category')->unique()->all())->toBe(['Support Gem']);
});

test('an out-of-range gem kind is rejected', function () {
    getJson(route('planner.references', ['q' => 'fire', 'type' => 'gem', 'gemKind' => 'passive']))
        ->assertInvalid(['gemKind']);
});

test('the reference search returns matching runes', function () {
    $results = getJson(route('planner.references', ['q' => 'rune', 'type' => 'rune']))
        ->assertOk()
        ->json('results');

    expect($results)->not->toBeEmpty()
        ->and(collect($results)->every(fn (array $r): bool => $r['type'] === 'rune'))->toBeTrue();
});

test('soul cores are categorised apart from plain runes', function () {
    $soulCores = collect(getJson(route('planner.references', [
        'q' => 'soul core',
        'type' => 'rune',
    ]))->assertOk()->json('results'));

    expect($soulCores)->not->toBeEmpty()
        ->and($soulCores->pluck('category')->unique()->all())->toBe(['Soul Core']);

    $rune = collect(getJson(route('planner.references', [
        'q' => 'desert',
        'type' => 'rune',
    ]))->assertOk()->json('results'))->firstWhere('name', 'Desert Rune');

    expect($rune['category'])->toBe('Rune');
});

test('the search covers both gems and runes when no type is given', function () {
    $types = collect(getJson(route('planner.references', ['q' => 'rune']))->json('results'))
        ->pluck('type')
        ->unique();

    // "rune" matches rune names; gems may or may not match. No type filter, so
    // the endpoint is free to return either kind.
    expect($types->contains('rune'))->toBeTrue();
});

test('a query that matches nothing returns an empty list', function () {
    getJson(route('planner.references', ['q' => 'zzzznotathing']))
        ->assertOk()
        ->assertExactJson(['results' => []]);
});

test('the query is required', function () {
    getJson(route('planner.references'))->assertInvalid(['q']);
});

test('the reference search returns matching unique items', function () {
    $results = getJson(route('planner.references', ['q' => 'bramblejack', 'type' => 'unique']))
        ->assertOk()
        ->json('results');

    expect($results)->not->toBeEmpty()
        ->and(collect($results)->every(fn (array $r): bool => $r['type'] === 'unique'))->toBeTrue()
        ->and(collect($results)->pluck('name'))->toContain('Bramblejack')
        ->and($results[0]['category'])->toContain('Unique')
        ->and($results[0]['flavour'])->not->toBeNull();
});

test('a category filter restricts unique results to those base types', function () {
    $results = getJson(route('planner.references', [
        'q' => 'red',
        'type' => 'unique',
        'categories' => 'Crossbow',
    ]))->assertOk()->json('results');

    expect($results)->not->toBeEmpty()
        ->and(collect($results)->every(fn (array $r): bool => $r['category'] === 'Unique Crossbow'))
        ->toBeTrue();
});

test('weapon bases report whether they are two-handed', function () {
    $bows = collect(getJson(route('planner.references', [
        'q' => 'bow',
        'type' => 'base',
        'categories' => 'Bow',
    ]))->assertOk()->json('results'));

    expect($bows)->not->toBeEmpty()
        ->and($bows->every(fn (array $r): bool => $r['twoHanded'] === true))->toBeTrue();

    $wands = collect(getJson(route('planner.references', [
        'q' => 'wand',
        'type' => 'base',
        'categories' => 'Wand',
    ]))->assertOk()->json('results'));

    expect($wands)->not->toBeEmpty()
        ->and($wands->every(fn (array $r): bool => $r['twoHanded'] === false))->toBeTrue();
});

test('the search returns non-unique base types for a slot category', function () {
    $results = getJson(route('planner.references', [
        'q' => 'greathelm',
        'type' => 'base',
        'categories' => 'Helmet',
    ]))->assertOk()->json('results');

    expect($results)->not->toBeEmpty()
        ->and(collect($results)->every(fn (array $r): bool => $r['type'] === 'base' && $r['category'] === 'Helmet'))
        ->toBeTrue();
});

/** Weapon and off-hand category sets, mirroring EQUIPMENT_SLOTS in the planner types. */
const WEAPON_CATEGORIES = [
    'Mace', 'Axe', 'Sword', 'Claw', 'Dagger', 'Flail', 'Spear', 'Bow',
    'Crossbow', 'Staff', 'Warstaff', 'Sceptre', 'Wand',
];
const OFFHAND_CATEGORIES = ['Shield', 'Focii', 'Quiver'];

/**
 * Each paper-doll slot and the base categories its picker filters on (mirrors
 * EQUIPMENT_SLOTS in resources/js/types/planner.ts). A slot lists only base and unique
 * items whose category is one of these - so a life-flask slot never offers a wand.
 *
 * @return array<string, array{0: list<string>}>
 */
function slotCategoryDataset(): array
{
    return [
        'Weapon' => [WEAPON_CATEGORIES],
        'Off-hand' => [[...WEAPON_CATEGORIES, ...OFFHAND_CATEGORIES]],
        'Helmet' => [['Helmet']],
        'Amulet' => [['Amulet', 'Talisman']],
        'Body Armour' => [['Body Armour']],
        'Ring' => [['Ring']],
        'Gloves' => [['Gloves']],
        'Boots' => [['Boots']],
        'Belt' => [['Belt']],
        'Life Flask' => [['Life Flask']],
        'Mana Flask' => [['Mana Flask']],
        'Charm' => [['Charm']],
    ];
}

/**
 * A single-letter query the slot's picker returns at least one item for - discovered from
 * live GGPK data, so the test never hard-codes an item name (and never trips over the
 * prefix search on apostrophes in a full name).
 *
 * @param  list<string>  $categories
 */
function sampleQuery(IconResolver $icons, string $type, array $categories): ?string
{
    foreach (str_split('aeiourlnstbcdmpghwfkv') as $prefix) {
        if ($icons->searchReferences($prefix, [$type], $categories, null, 5) !== []) {
            return $prefix;
        }
    }

    return null;
}

test('a slot picker lists only base and unique items of the slot categories', function (array $categories) {
    $icons = app(IconResolver::class);

    // Base rarities (normal / magic / rare): every returned item is a base of one of the
    // slot's categories - nothing else leaks in.
    $baseQuery = sampleQuery($icons, 'base', $categories);
    expect($baseQuery)->not->toBeNull();

    $bases = collect(getJson(route('planner.references', [
        'q' => $baseQuery,
        'type' => 'base',
        'categories' => implode(',', $categories),
    ]))->assertOk()->json('results'));

    expect($bases)->not->toBeEmpty()
        ->and($bases->pluck('type')->unique()->all())->toBe(['base'])
        ->and($bases->pluck('category')->unique()->diff($categories))->toBeEmpty();

    // Unique rarity: every returned item is a unique of one of the slot's categories (the
    // display category is prefixed "Unique "). A gem or a foreign unique would fail this.
    $uniqueQuery = sampleQuery($icons, 'unique', $categories);
    expect($uniqueQuery)->not->toBeNull();

    $uniques = collect(getJson(route('planner.references', [
        'q' => $uniqueQuery,
        'type' => 'unique',
        'categories' => implode(',', $categories),
    ]))->assertOk()->json('results'));

    $allowedUnique = collect($categories)->map(fn (string $c): string => 'Unique '.$c)->all();

    expect($uniques)->not->toBeEmpty()
        ->and($uniques->pluck('type')->unique()->all())->toBe(['unique'])
        ->and($uniques->pluck('category')->unique()->diff($allowedUnique))->toBeEmpty();
})->with(slotCategoryDataset());

test('the mod search returns the affix tier ladders a base can roll', function () {
    // A body armour rolls "+# to maximum Life" as a prefix, with many tiers.
    $results = getJson(route('planner.mods', ['base' => 'Rusted Cuirass', 'q' => 'life']))
        ->assertOk()
        ->assertJsonStructure(['results' => [['group', 'type', 'label', 'tiers' => [['id', 'tier', 'level', 'stats', 'rolls']]]]])
        ->json('results');

    $life = collect($results)->firstWhere('label', '+# to maximum Life');

    expect($life)->not->toBeNull()
        ->and($life['type'])->toBe('prefix')
        ->and(count($life['tiers']))->toBeGreaterThan(1)
        // Tiers are weakest-first: tier 1 comes before the rest.
        ->and($life['tiers'][0]['tier'])->toBe(1);
});

test('the mod search filters to what the base can roll', function () {
    // A wand cannot roll body-armour-only mods; its list differs from a chest's.
    $wandLabels = collect(getJson(route('planner.mods', ['base' => 'Withered Wand']))->json('results'))->pluck('label');
    $chestLabels = collect(getJson(route('planner.mods', ['base' => 'Rusted Cuirass']))->json('results'))->pluck('label');

    expect($wandLabels)->not->toBeEmpty()
        ->and($chestLabels)->not->toBeEmpty()
        ->and($wandLabels->all())->not->toBe($chestLabels->all());
});

test('the mod resolve endpoint returns a stored mod tier line', function () {
    $mods = postJson(route('planner.mods.resolve'), ['ids' => ['FireResist1', 'NotAModId']])
        ->assertOk()
        ->json('mods');

    expect($mods)->toHaveKey('FireResist1')
        ->and($mods)->not->toHaveKey('NotAModId')
        ->and($mods['FireResist1']['type'])->toBe('suffix')
        // Each roll carries its GGPK stat id - the key the tooltip groups on to sum
        // same-stat mods into one line, as the game does.
        ->and($mods['FireResist1']['rolls'])->toBe([['stat' => 'base_fire_damage_resistance_%', 'min' => 6, 'max' => 10]]);
});

test('the reference search matches gems by word prefixes', function () {
    $results = getJson(route('planner.references', ['q' => 'ice nov', 'type' => 'gem']))
        ->assertOk()
        ->json('results');

    expect(collect($results)->pluck('name'))->toContain('Ice Nova');
});

test('an out-of-range type is rejected', function () {
    getJson(route('planner.references', ['q' => 'x', 'type' => 'weapon']))
        ->assertInvalid(['type']);
});

test('the item type returns both bases and uniques of a slot category', function () {
    $types = collect(getJson(route('planner.references', [
        'q' => 'r',
        'type' => 'item',
        'categories' => 'Body Armour',
    ]))->assertOk()->json('results'))->pluck('type')->unique();

    // Both craftable bases and uniques come back - never gems or runes.
    expect($types->contains('base'))->toBeTrue()
        ->and($types->contains('unique'))->toBeTrue()
        ->and($types->diff(['base', 'unique'])->all())->toBe([]);
});

test('resolve turns tokens into live reference data keyed by type:id', function () {
    $response = postJson(route('planner.references.resolve'), [
        'refs' => [
            ['type' => 'gem', 'id' => 'SkillGemIceNova'],
            ['type' => 'unique', 'id' => 'Bramblejack'],
            ['type' => 'gem', 'id' => 'DoesNotExist'],
        ],
    ])->assertOk();

    $references = $response->json('references');

    expect($references)->toHaveKey('gem:SkillGemIceNova')
        ->and($references)->toHaveKey('unique:Bramblejack')
        ->and($references)->not->toHaveKey('gem:DoesNotExist')
        ->and($references['gem:SkillGemIceNova']['name'])->toBe('Ice Nova')
        ->and($references['unique:Bramblejack']['flavour'])->not->toBeNull();
});

test('the reference search returns matching notable passives with their stats', function () {
    $results = getJson(route('planner.references', ['q' => 'gathering winds', 'type' => 'notable']))
        ->assertOk()
        ->json('results');

    $notable = collect($results)->firstWhere('name', 'Gathering Winds');

    expect($notable)->not->toBeNull()
        ->and($notable['type'])->toBe('notable')
        ->and($notable['category'])->toBeIn(['Notable Passive', 'Ascendancy Notable'])
        // The granted stat lines are carried as the tooltip body.
        ->and($notable['tooltip'])->toContain('Tailwind')
        // No single-file PNG - the art is a crop rect into the tree sprite atlas.
        ->and($notable['icon'])->toBeNull()
        ->and($notable['sprite'])->toMatchArray(['w' => 128, 'h' => 128])
        ->and($notable['sprite']['sheetW'])->toBeGreaterThan(0)
        ->and($notable['sprite']['url'])->toContain('skills.webp');
});

test('the reference search returns keystones as big notable nodes', function () {
    $results = collect(getJson(route('planner.references', ['q' => 'scarred faith', 'type' => 'notable']))
        ->assertOk()
        ->json('results'));

    $keystone = $results->firstWhere('name', 'Scarred Faith');

    expect($keystone)->not->toBeNull()
        ->and($keystone['type'])->toBe('notable')
        ->and($keystone['category'])->toBe('Keystone')
        // Keystone art is cropped from the tree sprite atlas, same as a notable.
        ->and($keystone['icon'])->toBeNull()
        ->and($keystone['sprite'])->not->toBeNull()
        ->and($keystone['sprite']['url'])->toContain('skills.webp');
});

test('the default search also covers notable passives', function () {
    $types = collect(getJson(route('planner.references', ['q' => 'toxins']))->json('results'))
        ->pluck('type')
        ->unique();

    expect($types->contains('notable'))->toBeTrue();
});

test('resolve turns a notable token into its live stats', function () {
    $references = postJson(route('planner.references.resolve'), [
        'refs' => [['type' => 'notable', 'id' => 'Gathering Winds']],
    ])->assertOk()->json('references');

    expect($references)->toHaveKey('notable:Gathering Winds')
        ->and($references['notable:Gathering Winds']['tooltip'])->toContain('Tailwind');
});

test('resolve rejects an unknown reference type', function () {
    postJson(route('planner.references.resolve'), [
        'refs' => [['type' => 'item', 'id' => 'x']],
    ])->assertInvalid(['refs.0.type']);
});
