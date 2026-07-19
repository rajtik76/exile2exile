<?php

declare(strict_types=1);

use App\Models\EconomyPrice;

/**
 * The economy overlay only names a base the GGPK knows ({@see IconResolver::knowsBaseType}),
 * so seed those bases onto the mocked `game-data` disk. The NeverSink base body is a vendored
 * MIT asset (not GGPK) and is present unchanged.
 */
beforeEach(function () {
    fakeGameData([
        'resources/poe2/ggpk/items.json' => array_fill_keys(
            ['Divine Orb', 'Mirror of Kalandra', 'Chance Shard'],
            ['rarity' => 'normal'],
        ),
    ]);
});

test('it downloads a filter built on the NeverSink base for the default league', function () {
    EconomyPrice::factory()->create([
        'league' => 'Runes of Aldur', 'name' => 'Divine Orb', 'base_type' => 'Divine Orb',
        'kind' => 'currency', 'category' => 'currency', 'price' => 50.0,
    ]);

    $response = $this->get(route('filter.economy'));

    $response->assertOk()
        ->assertHeader('Content-Type', 'text/plain; charset=utf-8')
        ->assertHeader('Content-Disposition', 'attachment; filename="Exile to Exile (Default, Regular).filter"');

    expect($response->getContent())
        // App override banner + our economy highlight.
        ->toContain('# Exile to Exile - loot filter')
        ->toContain('# Generated:')
        ->toContain('League: Runes of Aldur')
        ->toContain('BaseType == "Divine Orb"')
        // NeverSink's own filter body underneath.
        ->toContain("NeverSink's Indepth Loot Filter");
});

test('a theme query selects a NeverSink style and names the file after it', function () {
    EconomyPrice::factory()->create([
        'league' => 'Runes of Aldur', 'name' => 'Divine Orb', 'base_type' => 'Divine Orb',
        'kind' => 'currency', 'category' => 'currency', 'price' => 600.0,
    ]);

    $response = $this->get(route('filter.economy', ['theme' => 'cobalt']));

    $response->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="Exile to Exile (Cobalt, Regular).filter"');
    // The vendored body is the COBALT style variant.
    expect($response->getContent())->toContain('STYLE:    COBALT');
});

test('an unknown theme falls back to the default style', function () {
    EconomyPrice::factory()->create(['league' => 'Runes of Aldur', 'price' => 50.0]);

    $this->get(route('filter.economy', ['theme' => 'rainbow']))
        ->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="Exile to Exile (Default, Regular).filter"');
});

test('a strictness query selects that NeverSink level and names the file after it', function () {
    EconomyPrice::factory()->create([
        'league' => 'Runes of Aldur', 'name' => 'Mirror of Kalandra', 'base_type' => 'Mirror of Kalandra',
        'kind' => 'currency', 'category' => 'currency', 'price' => 600.0,
    ]);
    EconomyPrice::factory()->create([
        'league' => 'Runes of Aldur', 'name' => 'Chance Shard', 'base_type' => 'Chance Shard',
        'kind' => 'currency', 'category' => 'currency', 'price' => 2.0,
    ]);

    $response = $this->get(route('filter.economy', ['strictness' => '4-very-strict']));

    $response->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="Exile to Exile (Default, Very strict).filter"');
    // The base is NeverSink's 4-VERY-STRICT file; our economy highlights are unaffected by
    // strictness, so both the dear Mirror and the cheap shard still show.
    expect($response->getContent())
        ->toContain('TYPE:     4-VERY-STRICT')
        ->toContain('Mirror of Kalandra')
        ->toContain('Chance Shard');
});

test('an explicit league selects that snapshot', function () {
    EconomyPrice::factory()->create([
        'league' => 'Runes of Aldur', 'name' => 'Divine Orb', 'base_type' => 'Divine Orb', 'price' => 50.0,
    ]);
    EconomyPrice::factory()->create([
        'league' => 'HC Runes of Aldur', 'name' => 'Mirror of Kalandra', 'base_type' => 'Mirror of Kalandra', 'price' => 9999.0,
    ]);

    $response = $this->get(route('filter.economy', ['league' => 'HC Runes of Aldur']));

    $response->assertOk();
    expect($response->getContent())
        ->toContain('League: HC Runes of Aldur')
        ->toContain('BaseType == "Mirror of Kalandra"');
});

test('custom category picks flip the matching NeverSink blocks to Hide', function () {
    EconomyPrice::factory()->create(['league' => 'Runes of Aldur', 'price' => 50.0]);

    $response = $this->get(route('filter.economy', ['off' => 'gold-piles,uncut-skill-gems']));

    $response->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="Exile to Exile (Default, Regular custom).filter"');

    expect((string) $response->getContent())
        // The overlay banner names what was hidden.
        ->toContain('# Hidden categories: Gold (small & medium piles), Uncut skill gems')
        // Small gold piles and uncut skill gems are flipped to Hide...
        ->toContain('Hide # %H3 $type->gold $tier->any')
        ->not->toContain('Show # %H3 $type->gold $tier->any')
        ->toContain('Hide # $type->gems->uncut $tier->skill20')
        // ...while untoggled categories and the large/huge gold piles keep their Show blocks.
        ->toContain('Show # %D7 $type->gold $tier->stack3')
        ->toContain('Show # %D6 $type->gold $tier->stackxl1lvl')
        ->toContain('Show # $type->gems->uncut $tier->spirit20');
});

test('picks with nothing to hide at the chosen strictness do not mark the download custom', function () {
    EconomyPrice::factory()->create(['league' => 'Runes of Aldur', 'price' => 50.0]);

    // 6-uber-plus has no rare-gear Show blocks left, so this pick flips nothing.
    $response = $this->get(route('filter.economy', ['strictness' => '6-uber-plus-strict', 'off' => 'rare-gear']));

    $response->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="Exile to Exile (Default, Uber-plus strict).filter"');

    expect((string) $response->getContent())->not->toContain('# Hidden categories:');
});

test('unknown off slugs are ignored and the download stays a plain NeverSink base', function () {
    EconomyPrice::factory()->create(['league' => 'Runes of Aldur', 'price' => 50.0]);

    $response = $this->get(route('filter.economy', ['off' => 'no-such-category,']));

    $response->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="Exile to Exile (Default, Regular).filter"');

    expect((string) $response->getContent())
        ->not->toContain('# Hidden categories:')
        ->toContain('Show # %H3 $type->gold $tier->any');
});

test('an unknown league is a 404', function () {
    EconomyPrice::factory()->create(['league' => 'Runes of Aldur', 'price' => 50.0]);

    $this->get(route('filter.economy', ['league' => 'No Such League']))->assertNotFound();
});

test('with no cached prices at all it is a 404', function () {
    $this->get(route('filter.economy'))->assertNotFound();
});
