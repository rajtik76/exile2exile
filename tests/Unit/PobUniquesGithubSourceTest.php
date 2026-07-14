<?php

declare(strict_types=1);

use App\Pob\Uniques\PobUniquesGithubSource;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// Needs the Laravel container (config + Http factory) but no database.
uses(TestCase::class);

beforeEach(function () {
    Http::preventStrayRequests();
});

test('listFiles keeps only .lua files and drops directories/missing download urls', function () {
    Http::fake([
        'api.github.com/repos/*/contents/*' => Http::response([
            ['type' => 'file', 'name' => 'helmet.lua', 'download_url' => 'https://raw.example/helmet.lua'],
            ['type' => 'dir', 'name' => 'Special', 'download_url' => null],
            ['type' => 'file', 'name' => 'readme.md', 'download_url' => 'https://raw.example/readme.md'],
            ['type' => 'file', 'name' => 'no-url.lua', 'download_url' => null],
        ]),
    ]);

    $files = (new PobUniquesGithubSource)->listFiles();

    expect($files)->toBe([
        ['name' => 'helmet.lua', 'downloadUrl' => 'https://raw.example/helmet.lua'],
    ]);
});

test('listFiles throws on a non-2xx response', function () {
    Http::fake(['api.github.com/repos/*/contents/*' => Http::response('not found', 404)]);

    (new PobUniquesGithubSource)->listFiles();
})->throws(RuntimeException::class);

test('listFiles throws on an unexpected payload shape', function () {
    // GitHub returns a single object (not an array) when the path is a file, not a
    // directory - json() decodes that to a plain string/scalar here, not a list.
    Http::fake(['api.github.com/repos/*/contents/*' => Http::response(
        '"not a listing"',
        200,
        ['Content-Type' => 'application/json'],
    )]);

    (new PobUniquesGithubSource)->listFiles();
})->throws(RuntimeException::class);

test('resolveRef returns the commit sha for the configured ref', function () {
    Http::fake([
        'api.github.com/repos/*/commits/*' => Http::response(['sha' => 'abc123def456']),
    ]);

    expect((new PobUniquesGithubSource)->resolveRef())->toBe('abc123def456');
});

test('resolveRef throws when the response carries no sha', function () {
    Http::fake(['api.github.com/repos/*/commits/*' => Http::response(['message' => 'nope'])]);

    (new PobUniquesGithubSource)->resolveRef();
})->throws(RuntimeException::class);

test('the GitHub token is sent to the api.github.com calls', function () {
    config(['services.github.token' => 'secret-token']);

    Http::fake([
        'api.github.com/repos/*/contents/*' => Http::response([]),
    ]);

    (new PobUniquesGithubSource)->listFiles();

    Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer secret-token'));
});

// Regression: the token is shared with unrelated write-scoped calls elsewhere
// (TriggerContractRun's repository_dispatch) - it must never reach a raw-content host.
test('the GitHub token is never sent to the raw-content download url', function () {
    config(['services.github.token' => 'secret-token']);

    Http::fake([
        'raw.example/helmet.lua' => Http::response('return {}'),
    ]);

    (new PobUniquesGithubSource)->fetch('https://raw.example/helmet.lua');

    Http::assertSent(fn ($request) => ! $request->hasHeader('Authorization'));
});
