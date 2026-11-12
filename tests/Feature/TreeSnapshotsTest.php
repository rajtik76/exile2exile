<?php

use App\Services\GameDataReleases;
use App\Services\TreeSnapshots;
use Illuminate\Support\Facades\File;

/*
 * Every patch that goes live keeps its passive tree under trees/<patch>, so a tree
 * saved on it can still be drawn after the game moved on.
 */

test('capturing copies a published tree in under the patch it is stamped with', function () {
    $root = fakeGameDataRoot();
    $source = fakePublishedTree("{$root}/src", '4.5.5.0', '{"nodes":{"1":{}}}');
    $trees = app(TreeSnapshots::class);

    expect($trees->capture($source))->toBe('4.5.5.0')
        ->and($trees->patches())->toBe(['4.5.5.0'])
        ->and(File::get("{$root}/trees/4.5.5.0/data.json"))->toBe('{"nodes":{"1":{}}}')
        ->and(File::get("{$root}/trees/4.5.5.0/assets/skills.webp"))->toBe('atlas');
});

test('capturing the same extraction again leaves the snapshot alone', function () {
    $root = fakeGameDataRoot();
    $trees = app(TreeSnapshots::class);
    $trees->capture(fakePublishedTree("{$root}/first", '4.5.5.0', '{"first":true}', hash: 'aaa'));

    $trees->capture(fakePublishedTree("{$root}/second", '4.5.5.0', '{"second":true}', hash: 'aaa'));

    expect(File::get("{$root}/trees/4.5.5.0/data.json"))->toBe('{"first":true}');
});

test('a re-extraction of the same patch replaces its snapshot', function () {
    $root = fakeGameDataRoot();
    $trees = app(TreeSnapshots::class);
    $trees->capture(fakePublishedTree("{$root}/first", '4.5.5.0', '{"first":true}', hash: 'aaa'));

    $trees->capture(fakePublishedTree("{$root}/second", '4.5.5.0', '{"fixed":true}', hash: 'bbb'));

    expect(File::get("{$root}/trees/4.5.5.0/data.json"))->toBe('{"fixed":true}')
        ->and($trees->version('4.5.5.0'))->toBe('bbb');
});

test('a file unchanged since the previous patch is shared with it, a changed one is not', function () {
    $root = fakeGameDataRoot();
    $trees = app(TreeSnapshots::class);
    $trees->capture(fakePublishedTree("{$root}/old", '4.5.5.0', '{"old":true}'));

    $trees->capture(fakePublishedTree("{$root}/new", '4.5.5.1', '{"new":true}'));

    expect(fileinode("{$root}/trees/4.5.5.1/assets/skills.webp"))->toBe(fileinode("{$root}/trees/4.5.5.0/assets/skills.webp"))
        ->and(fileinode("{$root}/trees/4.5.5.1/data.json"))->not->toBe(fileinode("{$root}/trees/4.5.5.0/data.json"));
});

test('a tree without a stamp is not captured', function () {
    $root = fakeGameDataRoot();
    $source = fakePublishedTree("{$root}/src", '4.5.5.0');
    File::delete("{$source}/version.json");

    expect(app(TreeSnapshots::class)->capture($source))->toBeNull()
        ->and(app(TreeSnapshots::class)->patches())->toBe([]);
});

test('a saved patch is drawn on its own snapshot, else on the newest one of its era', function () {
    fakeGameDataRoot();
    config()->set('poe.eras', ['4.4' => '0.4', '4.5' => '0.5']);
    foreach (['4.4.1.0', '4.4.3.0', '4.4.2.0', '4.5.5.0'] as $patch) {
        fakeTreeSnapshot($patch);
    }
    $trees = app(TreeSnapshots::class);

    expect($trees->forPatch('4.4.2.0'))->toBe('4.4.2.0')
        ->and($trees->forPatch('4.4.0.9'))->toBe('4.4.3.0')
        ->and($trees->forPatch('4.3.0.1'))->toBeNull()
        ->and($trees->forPatch('9.9.0.1'))->toBeNull();
});

test('activating a release captures its passive tree', function () {
    $root = fakeGameDataRoot();
    fakePublishedTree("{$root}/releases/4.5.5.0/public/tree/current", '4.5.5.0');

    app(GameDataReleases::class)->activate('4.5.5.0');

    expect(app(TreeSnapshots::class)->patches())->toBe(['4.5.5.0']);
});

test('a snapshot that cannot be written does not keep a release from going live', function () {
    $root = fakeGameDataRoot();
    fakePublishedTree("{$root}/releases/4.5.5.0/public/tree/current", '4.5.5.0');
    File::put("{$root}/trees", 'not a directory');
    $releases = app(GameDataReleases::class);

    $releases->activate('4.5.5.0');

    expect($releases->currentVersion())->toBe('4.5.5.0');
});

test('the snapshot command backfills every archived era', function () {
    $root = fakeGameDataRoot();
    config()->set('poe.eras', ['4.4' => '0.4', '4.5' => '0.5']);
    fakePublishedTree("{$root}/archive/4.4.3.0/public/tree/current", '4.4.3.0');

    $this->artisan('poe2:snapshot-trees')->assertSuccessful();

    expect(app(TreeSnapshots::class)->patches())->toContain('4.4.3.0');
});
