<?php

declare(strict_types=1);

use App\Models\EconomyPrice;

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

test('an unknown league is a 404', function () {
    EconomyPrice::factory()->create(['league' => 'Runes of Aldur', 'price' => 50.0]);

    $this->get(route('filter.economy', ['league' => 'No Such League']))->assertNotFound();
});

test('with no cached prices at all it is a 404', function () {
    $this->get(route('filter.economy'))->assertNotFound();
});
