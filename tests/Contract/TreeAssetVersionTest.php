<?php

use Inertia\Testing\AssertableInertia;

use function Pest\Laravel\get;

test('the root document carries the publish.mjs content stamp for cache busting', function () {
    $stamp = json_decode((string) file_get_contents(public_path('tree/current/version.json')), true);

    expect($stamp['v'])->toBeString()->not->toBeEmpty();

    get('/')
        ->assertOk()
        ->assertSee('name="tree-asset-version" content="'.$stamp['v'].'"', false);
});

test('the stamp shared with views matches the committed version.json', function () {
    $stamp = json_decode((string) file_get_contents(public_path('tree/current/version.json')), true);

    expect(view()->shared('treeAssetVersion'))->toBe($stamp['v']);
});

test('the page props carry the same stamp for the server render', function () {
    $stamp = json_decode((string) file_get_contents(public_path('tree/current/version.json')), true);

    get('/')->assertInertia(fn (AssertableInertia $page) => $page
        ->where('treeAssetVersion', $stamp['v'])
    );
});
