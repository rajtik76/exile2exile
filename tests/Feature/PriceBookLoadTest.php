<?php

declare(strict_types=1);

use App\Economy\PriceBook;
use App\Models\EconomyPrice;

test('forLeague loads only that league and prices a unique by its base type', function () {
    EconomyPrice::factory()->create([
        'league' => 'Runes of Aldur', 'name' => 'Divine Orb', 'base_type' => 'Divine Orb',
        'kind' => 'currency', 'category' => 'currency', 'price' => 20.0,
    ]);
    EconomyPrice::factory()->unique('Silk Robe')->create([
        'league' => 'Runes of Aldur', 'name' => 'Temporalis', 'price' => 1000.0,
    ]);
    // A different league must not bleed in.
    EconomyPrice::factory()->create(['league' => 'HC Runes of Aldur', 'name' => 'Chaos Orb', 'price' => 5.0]);

    $book = PriceBook::forLeague('Runes of Aldur');

    expect($book->league())->toBe('Runes of Aldur')
        ->and($book->count())->toBe(2)
        ->and($book->priceOf('Divine Orb'))->toBe(20.0)
        ->and($book->priceOf('Chaos Orb'))->toBeNull()
        ->and($book->baseTypeCeiling('Silk Robe'))->toBe(1000.0);
});
