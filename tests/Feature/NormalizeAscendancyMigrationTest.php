<?php

use App\Models\SharedTree;
use App\Support\TreeHash;

/**
 * The migration maps an internal ascendancy id to its display name through the tree's
 * class table ({@see CachedTreeIndex}). Seed just that lookup onto the mocked `game-data`
 * disk - the two classes and ascendancies the tests touch - so the rewrite logic is proven
 * without the real multi-MB tree export.
 */
beforeEach(function () {
    fakeGameData([
        'public/tree/current/data.json' => [
            'classes' => [
                ['name' => 'Monk', 'ascendancies' => [['id' => 'Monk1', 'name' => 'Martial Artist']]],
                ['name' => 'Witch', 'ascendancies' => [['id' => 'Witch2', 'name' => 'Blood Mage']]],
            ],
        ],
    ]);
});

/**
 * The data migration that rewrites legacy internal-id ascendancies to names.
 * Required directly so up() can be re-run against rows seeded by the test (the
 * migration itself ran on an empty table under RefreshDatabase).
 */
function runAscendancyMigration(): void
{
    (require database_path('migrations/2026_07_01_183102_normalize_shared_build_ascendancy_ids.php'))->up();
}

function legacyBuild(array $overrides = []): array
{
    return array_merge([
        'className' => 'Monk',
        'ascendId' => 'Monk1',
        'allocated' => [4, 16, 30],
        'attributeChoices' => [4 => 'int'],
        'weaponSets' => [],
        'jewels' => [],
        'treeVersion' => '0_5',
    ], $overrides);
}

test('it rewrites a legacy internal-id ascendancy to its display name', function () {
    $shared = SharedTree::create(['slug' => 'legacyMonk01', 'build' => legacyBuild()]);

    runAscendancyMigration();

    $shared->refresh();

    // Monk1 is GGG's internal id; the renderer and every current path use the name.
    expect($shared->build->ascendId)->toBe('Martial Artist')
        // The slug (the shareable link) is untouched.
        ->and($shared->slug)->toBe('legacyMonk01');
});

test('it re-hashes the rewritten row so dedup still resolves to it', function () {
    $shared = SharedTree::create(['slug' => 'legacyMonk02', 'build' => legacyBuild()]);

    runAscendancyMigration();
    $shared->refresh();

    // The stored hash matches a fresh hash of the rewritten build, so re-sharing
    // the same tree (now producing the name form) dedups here instead of duplicating.
    expect($shared->hash)->toBe(TreeHash::canonical($shared->build->toArray()));
});

test('it normalises another class the same way', function () {
    $shared = SharedTree::create([
        'slug' => 'legacyWitch1',
        'build' => legacyBuild(['className' => 'Witch', 'ascendId' => 'Witch2']),
    ]);

    runAscendancyMigration();

    expect($shared->refresh()->build->ascendId)->toBe('Blood Mage');
});

test('it leaves a name-form ascendancy untouched', function () {
    $shared = SharedTree::create([
        'slug' => 'nameFormBld1',
        'build' => legacyBuild(['ascendId' => 'Martial Artist']),
    ]);
    $originalHash = $shared->hash;

    runAscendancyMigration();
    $shared->refresh();

    expect($shared->build->ascendId)->toBe('Martial Artist')
        ->and($shared->hash)->toBe($originalHash);
});

test('it leaves a build with no ascendancy untouched', function () {
    $shared = SharedTree::create([
        'slug' => 'noAscendan01',
        'build' => legacyBuild(['ascendId' => null]),
    ]);

    runAscendancyMigration();

    expect($shared->refresh()->build->ascendId)->toBeNull();
});
