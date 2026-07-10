<?php

declare(strict_types=1);

use App\Pob\Source\PobbinSource;
use Illuminate\Support\Facades\Http;

it('recognises a pobb.in link and rejects other input', function () {
    $source = app(PobbinSource::class);

    expect($source->supports('https://pobb.in/abc123'))->toBeTrue()
        ->and($source->supports('https://www.pobb.in/abc123/'))->toBeTrue()
        ->and($source->supports('https://evil.example/abc'))->toBeFalse()
        ->and($source->supports('raw-pob-code'))->toBeFalse();
});

it('fetches the raw code from a pobb.in paste', function () {
    Http::fake(['pobb.in/*' => Http::response('the-pob-code')]);

    expect(app(PobbinSource::class)->resolveCode('https://pobb.in/abc123'))->toBe('the-pob-code');
});

it('rejects a non-pobb.in input at fetch time', function () {
    expect(fn () => app(PobbinSource::class)->resolveCode('https://evil.example/x'))
        ->toThrow(InvalidArgumentException::class);
});

it('rejects a failed pobb.in fetch', function () {
    Http::fake(['pobb.in/*' => Http::response('', 404)]);

    expect(fn () => app(PobbinSource::class)->resolveCode('https://pobb.in/abc123'))
        ->toThrow(InvalidArgumentException::class, 'could not be fetched');
});

it('rejects an empty pobb.in body', function () {
    Http::fake(['pobb.in/*' => Http::response('   ')]);

    expect(fn () => app(PobbinSource::class)->resolveCode('https://pobb.in/abc123'))
        ->toThrow(InvalidArgumentException::class, 'empty');
});

it('rejects an over-sized pobb.in body (a hostile paste)', function () {
    Http::fake(['pobb.in/*' => Http::response(str_repeat('A', 102_401))]);

    expect(fn () => app(PobbinSource::class)->resolveCode('https://pobb.in/abc123'))
        ->toThrow(InvalidArgumentException::class, 'large');
});
