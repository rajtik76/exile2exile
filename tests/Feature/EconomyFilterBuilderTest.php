<?php

declare(strict_types=1);

use App\Economy\PriceBook;
use App\Economy\PricedItem;
use App\Filter\Action;
use App\Filter\Actions;
use App\Filter\Economy\EconomyFilterBuilder;
use App\Filter\Economy\PriceTierPolicy;
use App\Filter\StyleTheme;
use App\Pob\IconResolver;
use Illuminate\Support\Facades\Storage;

/**
 * Seed just the GGPK base types the economy blocks may name onto the mocked `game-data`
 * disk. The builder gates every emitted `BaseType` through {@see IconResolver::knowsBaseType},
 * so only names present here can leak into a filter - which is exactly what the guard tests
 * below assert. Deliberately absent: poe2scout labels like "Precursor Tablet" that are not
 * real bases.
 */
beforeEach(function () {
    $bases = [
        'Mirror of Kalandra', 'Divine Orb', 'Exalted Orb', 'Chance Shard', 'Scrap Shard',
        'Silk Robe', 'Sapphire', 'Verisium Cuffs',
    ];

    fakeGameData([
        'resources/poe2/ggpk/items.json' => array_fill_keys($bases, ['rarity' => 'normal']),
    ]);
});

/** A trivial theme: the economy tests assert block structure, not styling. */
function stubStyleTheme(): StyleTheme
{
    return new class implements StyleTheme
    {
        /** @return list<Action> */
        public function styleFor(int $tier): array
        {
            return [Actions::fontSize(40)];
        }
    };
}

/**
 * @param  list<PricedItem>  $items
 */
function economyFilter(array $items): string
{
    $book = new PriceBook('Runes of Aldur', $items);
    $blocks = new EconomyFilterBuilder(PriceTierPolicy::default(), new IconResolver)->blocks($book, stubStyleTheme());

    return implode("\n\n", array_map(static fn ($block): string => $block->render(), $blocks));
}

test('valuable currency and uniques are surfaced and tiered by price', function () {
    $filter = economyFilter([
        new PricedItem('Mirror of Kalandra', 'Mirror of Kalandra', 'currency', 'currency', 600.0),
        new PricedItem('Divine Orb', 'Divine Orb', 'currency', 'currency', 25.0),
        new PricedItem('Scrap Shard', 'Scrap Shard', 'currency', 'currency', 0.2),
        new PricedItem('Temporalis', 'Silk Robe', 'unique', 'armour', 700.0),
    ]);

    expect($filter)
        ->toContain('Show # currency T1')
        ->toContain('BaseType == "Mirror of Kalandra"')
        ->toContain('Show # currency T3')
        ->toContain('BaseType == "Divine Orb"')
        ->toContain('Show # unique T1')
        ->toContain('BaseType == "Silk Robe"');

    // Below the floor: never surfaced.
    expect($filter)->not->toContain('Scrap Shard');
});

test('every priced tier is surfaced, dearest to cheapest', function () {
    // The economy overlay highlights everything priced; the tier only sets how loud it
    // looks (its NeverSink style), never whether it shows. Hiding clutter is the
    // NeverSink base's job, not the highlight's.
    $filter = economyFilter([
        new PricedItem('Mirror of Kalandra', 'Mirror of Kalandra', 'currency', 'currency', 600.0), // T1
        new PricedItem('Divine Orb', 'Divine Orb', 'currency', 'currency', 25.0), // T3
        new PricedItem('Chance Shard', 'Chance Shard', 'currency', 'currency', 2.0), // T5
    ]);

    expect($filter)
        ->toContain('Mirror of Kalandra')
        ->toContain('Divine Orb')
        ->toContain('Chance Shard');
});

test('a stacking currency is promoted by StackSize to a dearer tier', function () {
    // A 10ex Exalted (per-unit tier 4) stacking to 20: a single one shows quietly at its own
    // tier, a stack of ten is promoted to tier 2 (>= 100ex total) so it shouts.
    $items = [
        new PricedItem('Exalted Orb', 'Exalted Orb', 'currency', 'currency', 10.0, null, 20),
    ];

    expect(economyFilter($items))
        ->toContain('# currency T2 stack x10')
        ->toContain('StackSize >= 10')
        ->toContain('BaseType == "Exalted Orb"')
        // The plain per-unit block is still emitted for a single one.
        ->toContain('# currency T4');
});

test('a non-stacking currency gets no StackSize promotion', function () {
    $items = [
        new PricedItem('Exalted Orb', 'Exalted Orb', 'currency', 'currency', 10.0, null, null),
    ];

    expect(economyFilter($items))->not->toContain('StackSize');
});

test('a unique base is valued at its dearest unique and gated to Rarity Unique', function () {
    $filter = economyFilter([
        new PricedItem('Cheap Jewel', 'Sapphire', 'unique', 'jewel', 2.0),
        new PricedItem('Voices', 'Sapphire', 'unique', 'jewel', 600.0),
    ]);

    // One shared base, valued at its dearest unique (600 -> T1), gated to Rarity Unique.
    expect($filter)->toMatch('/Show # unique T1\n\tRarity Unique\n\tBaseType == "Sapphire"/');
});

/**
 * Independent oracle: raw GGPK base-type names read straight from the seeded data file, not
 * through {@see IconResolver}, so the guard below isn't just checking the gate against itself.
 *
 * @return array<string, int>
 */
function knownGgpkBaseTypes(): array
{
    $items = json_decode((string) Storage::disk('game-data')->get('resources/poe2/ggpk/items.json'), true);

    return array_flip(array_keys(is_array($items) ? $items : []));
}

test('every emitted BaseType is a real GGPK base, whatever poe2scout labels leak in', function () {
    // A mix of poe2scout labels that are NOT real bases and genuine bases. The guard is
    // generic: it parses every emitted BaseType token and rejects any the GGPK doesn't know,
    // so a future junk label leaking through the sync is caught here, not in-game.
    $filter = economyFilter([
        new PricedItem('Precursor Tablet', 'Precursor Tablet', 'currency', 'currency', 300.0),
        new PricedItem('Abyss Precursor Tablet', 'Abyss Precursor Tablet', 'unique', 'tablet', 300.0),
        new PricedItem('Verisium Cuffs', 'Verisium Cuffs', 'unique', 'armour', 300.0),
        new PricedItem('Divine Orb', 'Divine Orb', 'currency', 'currency', 25.0),
        new PricedItem('Temporalis', 'Silk Robe', 'unique', 'armour', 700.0),
    ]);

    preg_match_all('/^\tBaseType == (.+)$/m', $filter, $matches);

    $emitted = [];
    foreach ($matches[1] as $line) {
        preg_match_all('/"([^"]+)"/', $line, $names);
        $emitted = [...$emitted, ...$names[1]];
    }

    // Sanity: the real bases did come through, so an empty list can't pass vacuously.
    expect($emitted)->toContain('Divine Orb', 'Silk Robe');

    $known = knownGgpkBaseTypes();
    foreach ($emitted as $base) {
        expect(array_key_exists($base, $known))->toBeTrue("emitted a base the game doesn't know: {$base}");
    }
});

test('a base the game does not know is never emitted, so the filter stays loadable', function () {
    // "Precursor Tablet" is a poe2scout economy label, not a real GGPK base type: the game
    // rejects a whole filter that names an unknown base, so it must be dropped entirely.
    $filter = economyFilter([
        new PricedItem('Precursor Tablet', 'Precursor Tablet', 'currency', 'currency', 300.0),
        new PricedItem('Precursor Tablet', 'Precursor Tablet', 'unique', 'tablet', 300.0),
        new PricedItem('Mirror of Kalandra', 'Mirror of Kalandra', 'currency', 'currency', 600.0),
    ]);

    expect($filter)
        ->not->toContain('Precursor Tablet')
        ->toContain('BaseType == "Mirror of Kalandra"');
});
