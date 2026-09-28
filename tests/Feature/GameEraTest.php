<?php

use App\Support\GameEra;
use App\Support\TreeDataVersion;

/*
 * The hand-maintained patch-prefix -> era map every saved build's era is derived from.
 */

beforeEach(function () {
    config()->set('poe.eras', [
        '4.5' => ['era' => '0.5', 'name' => 'Return of the Ancients'],
        '4.5.9' => '0.5.9',
        '5.0' => '1.0',
    ]);
});

test('a patch maps to the era of its longest whole-segment prefix', function (string $patch, ?string $era) {
    expect(app(GameEra::class)->forPatch($patch))->toBe($era);
})->with([
    ['4.5.4.7', '0.5'],
    ['4.5.9.1', '0.5.9'],
    ['5.0.0.3', '1.0'],
    ['4.50.1', null],
    ['4.6.0.1', null],
]);

test('an era carries the name the map gives it, and none when the map gives none', function () {
    $eras = app(GameEra::class);

    expect($eras->nameOf('0.5'))->toBe('Return of the Ancients')
        ->and($eras->nameOf('1.0'))->toBeNull()
        ->and($eras->nameOf(null))->toBeNull();
});

test('a stored patch is live only when its era is the live one, hotfixes included', function () {
    $this->mock(TreeDataVersion::class)->shouldReceive('current')->andReturn('4.5.5.4');
    $eras = app(GameEra::class);

    expect($eras->isLive('4.5.5.1'))->toBeTrue()
        ->and($eras->isLive('5.0.0.1'))->toBeFalse()
        ->and($eras->isLive('9.9.0.1'))->toBeFalse()
        ->and($eras->isLive(null))->toBeFalse();
});

test('with no game data installed the newest configured prefix is the live patch', function () {
    $this->mock(TreeDataVersion::class)->shouldReceive('current')->andReturn(null);

    expect(app(GameEra::class)->livePatchOrFail())->toBe('5.0')
        ->and(app(GameEra::class)->current())->toBe('1.0');
});

test('live data of an unmapped patch has no era, and stamping a build refuses to guess one', function () {
    $this->mock(TreeDataVersion::class)->shouldReceive('current')->andReturn('4.6.0.1');

    expect(app(GameEra::class)->current())->toBeNull()
        ->and(fn () => app(GameEra::class)->livePatchOrFail())->toThrow(RuntimeException::class, 'no configured era');
});

test('a malformed era map fails loudly instead of mis-filing builds', function (array $eras, string $message) {
    config()->set('poe.eras', $eras);

    expect(fn () => app(GameEra::class)->forPatch('4.5.4.7'))->toThrow(RuntimeException::class, $message);
})->with([
    'a lone major swallows every later league' => [['4' => '0.5'], 'at least major.minor'],
    'an era label that is not a version' => [['4.5' => '../0.5'], 'era label'],
    'an empty era name' => [['4.5' => ['era' => '0.5', 'name' => ' ']], 'non-empty string'],
    'one era under two names' => [['4.5' => ['era' => '0.5', 'name' => 'A'], '4.5.9' => ['era' => '0.5', 'name' => 'B']], 'both'],
]);
