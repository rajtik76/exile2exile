<?php

use App\Support\TreeDataVersion;

test('the data version resolves to the published stamp patch, verbatim', function () {
    // The data stamp is the single source of truth - no extractor-config fallback,
    // and no guessed in-game version: the raw GGG patch string, as-is.
    $raw = patchFrom(public_path('tree/current/version.json'));
    expect($raw)->not->toBeNull();

    expect(app(TreeDataVersion::class)->current())->toBe($raw);
});

test('the cache stamp joins the committed patch and content hash', function () {
    $decoded = json_decode((string) file_get_contents(public_path('tree/current/version.json')), true);

    expect(TreeDataVersion::stamp())->toBe("{$decoded['patch']}:{$decoded['v']}");
});

test('the cache stamp falls back to dev when the file is absent', function () {
    expect(TreeDataVersion::stamp('/no/such/version.json'))->toBe('dev');
});

/** The `patch` field of a JSON file, or null. */
function patchFrom(string $path): ?string
{
    if (! is_file($path)) {
        return null;
    }

    $decoded = json_decode((string) file_get_contents($path), true);

    return is_array($decoded) && is_string($decoded['patch'] ?? null) ? $decoded['patch'] : null;
}
