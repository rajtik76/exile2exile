<?php

declare(strict_types=1);

use App\Pob\Uniques\PobUniqueStore;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

function fakePobUniquesRepo(): void
{
    Http::preventStrayRequests();

    Http::fake([
        'api.github.com/repos/*/contents/*' => Http::response([
            ['type' => 'file', 'name' => 'helmet.lua', 'download_url' => 'https://raw.example/helmet.lua'],
            ['type' => 'dir', 'name' => 'not-a-file', 'download_url' => null],
            ['type' => 'file', 'name' => 'readme.md', 'download_url' => 'https://raw.example/readme.md'],
        ]),
        'api.github.com/repos/*/commits/*' => Http::response(['sha' => 'fakecommit123']),
        'raw.example/helmet.lua' => Http::response(<<<'LUA'
            return {
            [[
            Constricting Command
            Viper Cap
            League: Dawn of the Hunt
            +(80-120) to maximum Life
            ]],
            }
            LUA),
    ]);
}

beforeEach(function () {
    config(['poe.pob_uniques.storage_path' => storage_path('game-data-test/pob-uniques')]);
    File::deleteDirectory(storage_path('game-data-test'));
});

afterEach(function () {
    File::deleteDirectory(storage_path('game-data-test'));
});

test('it syncs unique mods from PoB and writes the snapshot', function () {
    fakePobUniquesRepo();

    $this->artisan('poe2:sync-pob-uniques')->assertSuccessful();

    $snapshot = app(PobUniqueStore::class)->read();

    expect($snapshot)->not->toBeNull()
        ->and($snapshot['uniques'])->toHaveKey('Constricting Command')
        ->and($snapshot['uniques']['Constricting Command']['mods'])->toBe(['+(80-120) to maximum Life']);
});

test('only .lua files are fetched', function () {
    fakePobUniquesRepo();

    $this->artisan('poe2:sync-pob-uniques')->assertSuccessful();

    Http::assertNotSent(fn ($request) => str_contains((string) $request->url(), 'readme.md'));
});

test('it fails without overwriting when the directory listing is empty', function () {
    Http::preventStrayRequests();
    Http::fake(['api.github.com/repos/*/contents/*' => Http::response([])]);

    $this->artisan('poe2:sync-pob-uniques')->assertFailed();

    expect(app(PobUniqueStore::class)->read())->toBeNull();
});

test('a single failed file does not abort the whole sync', function () {
    Http::preventStrayRequests();

    Http::fake([
        'api.github.com/repos/*/contents/*' => Http::response([
            ['type' => 'file', 'name' => 'helmet.lua', 'download_url' => 'https://raw.example/helmet.lua'],
            ['type' => 'file', 'name' => 'broken.lua', 'download_url' => 'https://raw.example/broken.lua'],
        ]),
        'api.github.com/repos/*/commits/*' => Http::response(['sha' => 'fakecommit123']),
        'raw.example/helmet.lua' => Http::response(<<<'LUA'
            return {
            [[
            Constricting Command
            Viper Cap
            +(80-120) to maximum Life
            ]],
            }
            LUA),
        'raw.example/broken.lua' => Http::response('', 500),
    ]);

    $this->artisan('poe2:sync-pob-uniques')->assertSuccessful();

    $snapshot = app(PobUniqueStore::class)->read();
    expect($snapshot['uniques'])->toHaveKey('Constricting Command');
});

test('the snapshot records the resolved commit sha, not the mutable ref', function () {
    fakePobUniquesRepo();

    $this->artisan('poe2:sync-pob-uniques')->assertSuccessful();

    expect(app(PobUniqueStore::class)->read()['sourceRef'])
        ->toBe('PathOfBuildingCommunity/PathOfBuilding-PoE2@fakecommit123');
});

test('a failed commit-sha lookup falls back to the ref label instead of aborting the sync', function () {
    Http::preventStrayRequests();

    Http::fake([
        'api.github.com/repos/*/contents/*' => Http::response([
            ['type' => 'file', 'name' => 'helmet.lua', 'download_url' => 'https://raw.example/helmet.lua'],
        ]),
        'api.github.com/repos/*/commits/*' => Http::response('', 500),
        'raw.example/helmet.lua' => Http::response(<<<'LUA'
            return {
            [[
            Constricting Command
            Viper Cap
            +(80-120) to maximum Life
            ]],
            }
            LUA),
    ]);

    $this->artisan('poe2:sync-pob-uniques')->assertSuccessful();

    expect(app(PobUniqueStore::class)->read()['sourceRef'])
        ->toBe('PathOfBuildingCommunity/PathOfBuilding-PoE2@main');
});

test('a large drop in unique count vs the last snapshot aborts without overwriting', function () {
    $store = app(PobUniqueStore::class);
    $previous = [];

    for ($i = 1; $i <= 10; $i++) {
        $previous["Unique {$i}"] = ['name' => "Unique {$i}", 'base' => 'Base', 'league' => null, 'implicitCount' => 0, 'mods' => ['mod']];
    }

    $store->write($previous, 'repo@previous');

    Http::preventStrayRequests();
    Http::fake([
        'api.github.com/repos/*/contents/*' => Http::response([
            ['type' => 'file', 'name' => 'helmet.lua', 'download_url' => 'https://raw.example/helmet.lua'],
        ]),
        'api.github.com/repos/*/commits/*' => Http::response(['sha' => 'fakecommit123']),
        // Only one unique parses this run - a >50% drop from the 10 in the previous snapshot.
        'raw.example/helmet.lua' => Http::response(<<<'LUA'
            return {
            [[
            Constricting Command
            Viper Cap
            +(80-120) to maximum Life
            ]],
            }
            LUA),
    ]);

    $this->artisan('poe2:sync-pob-uniques')->assertFailed();

    // The pre-existing 10-unique snapshot must survive untouched.
    expect($store->read()['sourceRef'])->toBe('repo@previous')
        ->and($store->read()['uniques'])->toHaveCount(10);
});

// Regression: routes/console.php wires the success heartbeat from
// config('poe.pob_uniques.heartbeat_url'); the key must map POB_UNIQUES_SYNC_HEARTBEAT_URL,
// or the ping is silently never sent and the push monitor alarms despite healthy syncs.
test('the heartbeat url maps the POB_UNIQUES_SYNC_HEARTBEAT_URL env', function () {
    $url = 'https://status.example/api/push/pobuniques?status=up&msg=OK&ping=';

    putenv("POB_UNIQUES_SYNC_HEARTBEAT_URL={$url}");
    $_ENV['POB_UNIQUES_SYNC_HEARTBEAT_URL'] = $url;
    $_SERVER['POB_UNIQUES_SYNC_HEARTBEAT_URL'] = $url;

    try {
        $config = require base_path('config/poe.php');

        expect($config['pob_uniques']['heartbeat_url'])->toBe($url);
    } finally {
        putenv('POB_UNIQUES_SYNC_HEARTBEAT_URL');
        unset($_ENV['POB_UNIQUES_SYNC_HEARTBEAT_URL'], $_SERVER['POB_UNIQUES_SYNC_HEARTBEAT_URL']);
    }
});
