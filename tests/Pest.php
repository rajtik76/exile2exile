<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

// No Feature test may spawn a real OS process (e.g. the game-data extractor). Every
// process must be faked; an un-faked one throws instead of running for real.
beforeEach(fn () => Process::preventStrayProcesses())->in('Feature');

// Browser tests drive a real browser; the build viewer is session-based, so no
// database refresh is needed here.
pest()->extend(TestCase::class)->in('Browser');

// Contract tests run against REAL extracted game data (never mocked), guarding that the
// data has the structure, icons, affixes and tree the app needs. Some validate through
// DB-backed endpoints (a shared build's JSON document), so they get a fresh database too.
// CI downloads the served or freshly staged release for them (see data-contract.yml).
pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Contract');

/**
 * Fake the `game-data` disk and seed just what a test needs, so nothing depends on
 * the real (gitignored) GGPK extract. $files maps a project-relative path to its
 * contents (arrays are JSON-encoded); $icons touch empty files under public/icons/poe2
 * so IconResolver's presence check passes.
 *
 * @param  array<string, string|array<mixed>>  $files
 * @param  list<string>  $icons
 */
function fakeGameData(array $files = [], array $icons = []): void
{
    $disk = Storage::fake('game-data');

    foreach ($files as $path => $contents) {
        $disk->put($path, is_string($contents) ? $contents : (string) json_encode($contents));
    }

    foreach ($icons as $icon) {
        $disk->put('public/icons/poe2/'.$icon, '');
    }
}

/**
 * Point the game-data releases root at a throwaway per-process dir and return it.
 * The dir is wiped up front, so tests always start from an empty release store.
 */
function fakeGameDataRoot(): string
{
    $root = storage_path('framework/testing/game-data-'.getmypid());
    File::deleteDirectory($root);
    config()->set('poe.data.releases_root', $root);

    return $root;
}

/**
 * Drop a minimal staged release (just its version.json stamp) into the fake
 * releases root, so GameDataReleases::has() and activation see it.
 */
function fakeGameDataRelease(string $version, ?string $patch = null): void
{
    $dir = config()->string('poe.data.releases_root')."/releases/{$version}/public/tree/current";
    File::ensureDirectoryExists($dir);
    File::put($dir.'/version.json', (string) json_encode([
        'v' => substr(hash('sha256', $version), 0, 12),
        'patch' => $patch ?? $version,
    ]));
}

// The heaviest build pages render two passive-tree canvases at once and flake under
// the parallel run's 5s assertion timeout. A higher ceiling only hits genuinely slow
// cases (assertions wait for the condition), not the happy path.
pest()->browser()->timeout(20_000);
