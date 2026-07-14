<?php

declare(strict_types=1);

use App\Pob\Uniques\PobUniqueStore;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

// Needs the Laravel container (config + storage_path()) but no database.
uses(TestCase::class);

beforeEach(function () {
    config(['poe.pob_uniques.storage_path' => storage_path('game-data-test/pob-uniques')]);
    File::deleteDirectory(storage_path('game-data-test'));
});

afterEach(function () {
    File::deleteDirectory(storage_path('game-data-test'));
});

test('read returns null before the first write', function () {
    expect((new PobUniqueStore)->read())->toBeNull();
});

test('write then read round-trips the snapshot, including the source ref', function () {
    $store = new PobUniqueStore;

    $store->write([
        'Constricting Command' => [
            'name' => 'Constricting Command',
            'base' => 'Viper Cap',
            'league' => 'Dawn of the Hunt',
            'implicitCount' => 0,
            'mods' => ['+(80-120) to maximum Life'],
        ],
    ], 'PathOfBuildingCommunity/PathOfBuilding-PoE2@abc123');

    $snapshot = $store->read();

    expect($snapshot)->not->toBeNull()
        ->and($snapshot['sourceRef'])->toBe('PathOfBuildingCommunity/PathOfBuilding-PoE2@abc123')
        ->and($snapshot['uniques']['Constricting Command']['mods'])->toBe(['+(80-120) to maximum Life']);
});

test('a second write fully replaces the snapshot rather than merging', function () {
    $store = new PobUniqueStore;

    $store->write(['A' => ['name' => 'A', 'base' => 'Base', 'league' => null, 'implicitCount' => 0, 'mods' => ['mod']]], 'repo@1');
    $store->write(['B' => ['name' => 'B', 'base' => 'Base', 'league' => null, 'implicitCount' => 0, 'mods' => ['mod']]], 'repo@2');

    $snapshot = $store->read();

    expect($snapshot['uniques'])->toHaveKey('B')
        ->and($snapshot['uniques'])->not->toHaveKey('A');
});

test('no stray temp files are left behind after a write', function () {
    (new PobUniqueStore)->write(['A' => ['name' => 'A', 'base' => 'Base', 'league' => null, 'implicitCount' => 0, 'mods' => ['mod']]], 'repo@1');

    $files = File::files(storage_path('game-data-test/pob-uniques'));

    expect($files)->toHaveCount(1)
        ->and((string) $files[0])->toEndWith('current.json');
});
