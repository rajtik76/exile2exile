<?php

use App\Support\Poe2Version;

test('it maps a raw GGG patch string to the player-facing version', function (string $raw, string $expected) {
    expect(Poe2Version::display($raw))->toBe($expected);
})->with([
    'release with hotfix' => ['4.5.3.1.7', '0.5.3.7'],
    'base hotfix zero' => ['4.5.3.1.0', '0.5.3.0'],
    'next content patch' => ['4.6.0.1.0', '0.6.0.0'],
    'four-segment release (0.5.4+)' => ['4.5.4.1', '0.5.4.1'],
    'four-segment base hotfix' => ['4.5.4.0', '0.5.4.0'],
]);

test('it returns an unexpected shape verbatim rather than mangling it', function (string $raw) {
    expect(Poe2Version::display($raw))->toBe($raw);
})->with([
    'too few segments' => ['4.5.3'],
    'empty' => [''],
]);
