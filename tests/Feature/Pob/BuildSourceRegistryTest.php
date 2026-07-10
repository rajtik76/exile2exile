<?php

declare(strict_types=1);

use App\Pob\Source\BuildSourceRegistry;

function witchCode(): string
{
    return trim(file_get_contents(base_path('resources/pob/poe2/witch-lvl80-runes-of-aldur-league.txt')));
}

it('recognises a raw code and a pobb.in link, but not empty input', function () {
    $registry = app(BuildSourceRegistry::class);

    expect($registry->supports(witchCode()))->toBeTrue()
        ->and($registry->supports('https://pobb.in/abc'))->toBeTrue()
        ->and($registry->supports(''))->toBeFalse();
});

it('resolves and imports a raw PoB code', function () {
    $registry = app(BuildSourceRegistry::class);

    expect($registry->resolveCode(witchCode()))->toBe(witchCode())
        ->and($registry->import(witchCode())->class->value)->toBe('Witch');
});

it('throws when no source recognises the input', function () {
    expect(fn () => app(BuildSourceRegistry::class)->import(''))
        ->toThrow(InvalidArgumentException::class);
});
