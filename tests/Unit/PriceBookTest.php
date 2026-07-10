<?php

declare(strict_types=1);

use App\Economy\PriceBook;
use App\Economy\PricedItem;

/**
 * @param  list<PricedItem>  $items
 */
function book(array $items): PriceBook
{
    return new PriceBook('Runes of Aldur', $items);
}

test('priceOf returns a named price and null for an unknown item', function () {
    $book = book([
        new PricedItem('Divine Orb', 'Divine Orb', 'currency', 'currency', 20.0, 500),
        new PricedItem('Exalted Orb', 'Exalted Orb', 'currency', 'currency', 1.0, 1000),
    ]);

    expect($book->priceOf('Divine Orb'))->toBe(20.0)
        ->and($book->priceOf('Mirror of Kalandra'))->toBeNull();
});

test('baseTypeCeiling is the dearest item sharing a base type', function () {
    $book = book([
        new PricedItem('Cheap Jewel', 'Sapphire', 'unique', 'jewel', 100.0),
        new PricedItem('Voices', 'Sapphire', 'unique', 'jewel', 400.0),
    ]);

    expect($book->baseTypeCeiling('Sapphire'))->toBe(400.0)
        ->and($book->baseTypeCeiling('Emerald'))->toBeNull();
});

test('items narrows by kind and category', function () {
    $book = book([
        new PricedItem('Divine Orb', 'Divine Orb', 'currency', 'currency', 20.0),
        new PricedItem('Fire Rune', 'Fire Rune', 'currency', 'runes', 5.0),
        new PricedItem('Temporalis', 'Silk Robe', 'unique', 'armour', 50.0),
    ]);

    expect($book->items('currency'))->toHaveCount(2)
        ->and($book->items('currency', 'runes'))->toHaveCount(1)
        ->and($book->items('unique'))->toHaveCount(1)
        ->and($book->items())->toHaveCount(3)
        ->and($book->count())->toBe(3)
        ->and($book->isEmpty())->toBeFalse();

    expect(book([])->isEmpty())->toBeTrue();
});
