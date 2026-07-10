<?php

declare(strict_types=1);

use App\Build\TreeIndex;
use App\Pob\IconResolver;
use Illuminate\Support\Facades\Storage;

/**
 * Runs against REAL extracted GGPK-derived data (no Storage mock). Guards the data
 * contract the app depends on - structure, non-emptiness and that referenced icons exist
 * on disk - so the passive tree and item/gem resolution actually work. CI downloads the
 * served or freshly staged release for this suite (see data-contract.yml).
 */
function gameData(string $path): array
{
    $raw = Storage::disk('game-data')->get($path);

    expect($raw)->not->toBeNull("missing extracted data file: {$path}");

    return json_decode((string) $raw, true);
}

it('publishes a passive tree with nodes and classes', function () {
    $data = gameData('public/tree/current/data.json');

    expect($data['nodes'] ?? [])->toBeArray()->not->toBeEmpty()
        ->and($data['classes'] ?? [])->toBeArray()->not->toBeEmpty();
});

it('publishes the skill atlas frame map with its sheet size', function () {
    $skills = gameData('public/tree/current/assets/skills.json');

    expect($skills['frames'] ?? [])->toBeArray()->not->toBeEmpty()
        ->and($skills['sheet']['w'] ?? 0)->toBeGreaterThan(0)
        ->and($skills['sheet']['h'] ?? 0)->toBeGreaterThan(0);
});

it('builds the tree index from the real data', function () {
    $index = app(TreeIndex::class);

    expect($index->nodes())->not->toBeEmpty()
        ->and($index->classes())->not->toBeEmpty();
});

it('ships gem data whose first icon exists on disk', function () {
    $gems = gameData('resources/poe2/ggpk/gems.json');

    expect($gems)->not->toBeEmpty();

    // The extract must have written the icon file the data points at, or the resolver
    // would return null (webPathIfPresent's on-disk check).
    expect((new IconResolver)->gemIcon((string) array_key_first($gems)))
        ->toStartWith('/icons/poe2/')->toEndWith('.png');
});

it('ships item data whose first base icon exists on disk', function () {
    $items = gameData('resources/poe2/ggpk/items.json');

    expect($items)->not->toBeEmpty();
    expect((new IconResolver)->itemIcon((string) array_key_first($items)))
        ->toStartWith('/icons/poe2/')->toEndWith('.png');
});
