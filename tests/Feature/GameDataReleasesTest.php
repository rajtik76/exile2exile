<?php

use App\Jobs\StageGameData;
use App\Services\GameDataReleases;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

/*
 * The release store: staged extractions under releases/<version>, the live one
 * behind an atomically swapped `current` symlink, activation gated by CI (the
 * data-contract workflow calls the endpoint after a green run).
 */

test('version validation accepts dotted patch numbers only', function (string $version, bool $valid) {
    expect(GameDataReleases::isValidVersion($version))->toBe($valid);
})->with([
    ['4.5.4.3', true],
    ['4.5.3.1.7', true],
    ['4', false],
    ['4.5.4.3.staging', false],
    ['../../etc/passwd', false],
    ['4.5;rm -rf /', false],
    ['', false],
]);

test('activation swaps the current symlink and keeps the old release for rollback', function () {
    $root = fakeGameDataRoot();
    fakeGameDataRelease('4.5.4.3');
    fakeGameDataRelease('4.5.5.0');
    $releases = app(GameDataReleases::class);

    $releases->activate('4.5.4.3');
    expect($releases->currentVersion())->toBe('4.5.4.3');

    $releases->activate('4.5.5.0');

    expect($releases->currentVersion())->toBe('4.5.5.0')
        ->and(is_link("{$root}/current"))->toBeTrue()
        ->and($releases->has('4.5.4.3'))->toBeTrue();
});

test('activation refuses a release that is not staged', function () {
    fakeGameDataRoot();

    expect(fn () => app(GameDataReleases::class)->activate('4.5.5.0'))
        ->toThrow(RuntimeException::class, 'not staged');
});

test('a release stamped with a different patch does not count as staged', function () {
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0', patch: '4.5.4.3');

    expect(app(GameDataReleases::class)->has('4.5.5.0'))->toBeFalse();
});

test('pruning keeps the live release plus the newest rollback targets', function () {
    fakeGameDataRoot();
    config()->set('poe.data.keep_releases', 1);
    $releases = app(GameDataReleases::class);

    foreach (['4.5.1.0', '4.5.2.0', '4.5.3.0', '4.5.4.0'] as $i => $version) {
        fakeGameDataRelease($version);
        File::put($releases->tarballPath($version), 'bytes');
        // Spread mtimes so "newest" is deterministic.
        touch($releases->releasePath($version), time() - (10 - $i));
    }

    $releases->activate('4.5.2.0');

    // Removal order is newest-first after the kept ones.
    expect($releases->prune())->toBe(['4.5.3.0', '4.5.1.0'])
        ->and($releases->has('4.5.2.0'))->toBeTrue()
        ->and($releases->has('4.5.4.0'))->toBeTrue()
        ->and(File::exists($releases->tarballPath('4.5.1.0')))->toBeFalse();
});

test('packing a staged release writes the tarball checksum sidecar', function () {
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');
    $releases = app(GameDataReleases::class);

    // tar is faked; the tarball it would produce is planted by the fake.
    Process::fake(function ($process) use ($releases) {
        if ($process->command[0] === 'tar') {
            File::put($releases->tarballPath('4.5.5.0'), 'tarball-bytes');
        }

        return Process::result();
    });

    $checksum = $releases->pack('4.5.5.0');

    expect($checksum)->toBe(hash('sha256', 'tarball-bytes'))
        ->and($releases->checksum('4.5.5.0'))->toBe($checksum);

    Process::assertRan(fn ($process) => $process->command === [
        'tar', '-czf', $releases->tarballPath('4.5.5.0'),
        '-C', $releases->releasePath('4.5.5.0'),
        'public', 'resources',
    ]);
});

/*
 * The activation endpoint - the only way a validated release goes live.
 */

function activateHeaders(string $token = 'secret-token'): array
{
    return ['Authorization' => "Bearer {$token}"];
}

test('activating a staged release over the api swaps it live', function () {
    config()->set('poe.data.activate_token', 'secret-token');
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');

    $this->postJson('/api/data/activate', ['version' => '4.5.5.0'], activateHeaders())
        ->assertOk()
        ->assertJson(['status' => 'activated', 'version' => '4.5.5.0']);

    expect(app(GameDataReleases::class)->currentVersion())->toBe('4.5.5.0');
});

test('activating the already live release is an idempotent no-op', function () {
    config()->set('poe.data.activate_token', 'secret-token');
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');
    app(GameDataReleases::class)->activate('4.5.5.0');

    $this->postJson('/api/data/activate', ['version' => '4.5.5.0'], activateHeaders())
        ->assertOk()
        ->assertJson(['status' => 'already-active', 'version' => '4.5.5.0']);
});

test('activation rejects a wrong bearer token', function () {
    config()->set('poe.data.activate_token', 'secret-token');
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');

    $this->postJson('/api/data/activate', ['version' => '4.5.5.0'], activateHeaders('wrong'))
        ->assertUnauthorized();

    expect(app(GameDataReleases::class)->currentVersion())->toBeNull();
});

test('activation is disabled entirely without a configured token', function () {
    config()->set('poe.data.activate_token', '');
    fakeGameDataRoot();

    $this->postJson('/api/data/activate', ['version' => '4.5.5.0'], activateHeaders(''))
        ->assertStatus(503);
});

test('activation rejects a malformed version', function () {
    config()->set('poe.data.activate_token', 'secret-token');
    fakeGameDataRoot();

    $this->postJson('/api/data/activate', ['version' => '../evil'], activateHeaders())
        ->assertStatus(422);
});

test('activation 404s for a version that is not staged', function () {
    config()->set('poe.data.activate_token', 'secret-token');
    fakeGameDataRoot();

    $this->postJson('/api/data/activate', ['version' => '4.5.5.0'], activateHeaders())
        ->assertNotFound();
});

/*
 * The tarball download - how CI gets the release to test.
 */

test('a packed release tarball downloads with its exact bytes', function () {
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');
    File::put(app(GameDataReleases::class)->tarballPath('4.5.5.0'), 'tarball-bytes');

    $response = $this->get('/api/data/releases/4.5.5.0.tar.gz')
        ->assertOk()
        ->assertDownload('4.5.5.0.tar.gz');

    expect(file_get_contents($response->baseResponse->getFile()->getPathname()))->toBe('tarball-bytes');
});

test('an unknown release tarball 404s', function () {
    fakeGameDataRoot();

    $this->get('/api/data/releases/4.5.5.0.tar.gz')->assertNotFound();
});

test('the checksum sidecar serves the stored sha256 as plain text', function () {
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');
    File::put(app(GameDataReleases::class)->checksumPath('4.5.5.0'), "abc123\n");

    // CI keys its tarball cache on this, so a re-extraction of the same patch
    // busts the cache (the version.json `v` stamp only moves with tree data).
    $this->get('/api/data/releases/4.5.5.0.tar.gz.sha256')
        ->assertOk()
        ->assertHeader('Content-Type', 'text/plain; charset=UTF-8')
        ->assertContent('abc123');
});

test('an unknown release checksum 404s', function () {
    fakeGameDataRoot();

    $this->get('/api/data/releases/4.5.5.0.tar.gz.sha256')->assertNotFound();
});

/*
 * Operator tooling.
 */

test('poe2:pack-release rebuilds a missing tarball from the release dir', function () {
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');
    $releases = app(GameDataReleases::class);

    Process::fake(function ($process) use ($releases) {
        if ($process->command[0] === 'tar') {
            File::put($releases->tarballPath('4.5.5.0'), 'tarball-bytes');
        }

        return Process::result();
    });

    $this->artisan('poe2:pack-release', ['version' => '4.5.5.0'])->assertSuccessful();

    expect($releases->checksum('4.5.5.0'))->toBe(hash('sha256', 'tarball-bytes'));
});

test('poe2:pack-release fails for a version that is not staged', function () {
    fakeGameDataRoot();
    Process::fake();

    $this->artisan('poe2:pack-release', ['version' => '4.5.5.0'])->assertFailed();

    Process::assertNothingRan();
});

test('poe2:link-game-data links the three game-data paths through the current release', function () {
    $base = storage_path('framework/testing/link-happy-'.getmypid());
    File::deleteDirectory($base);
    $root = fakeGameDataRoot();
    app()->setBasePath($base);
    app()->usePublicPath($base.'/public');

    $this->artisan('poe2:link-game-data')->assertSuccessful();

    expect(is_link($base.'/public/tree/current'))->toBeTrue()
        ->and(readlink($base.'/public/tree/current'))->toBe($root.'/current/public/tree/current')
        ->and(is_link($base.'/public/icons/poe2'))->toBeTrue()
        ->and(readlink($base.'/public/icons/poe2'))->toBe($root.'/current/public/icons/poe2')
        ->and(is_link($base.'/resources/poe2/ggpk'))->toBeTrue()
        ->and(readlink($base.'/resources/poe2/ggpk'))->toBe($root.'/current/resources/poe2/ggpk');

    // Re-running after a deploy replaces the existing links instead of failing.
    $this->artisan('poe2:link-game-data')->assertSuccessful();

    expect(is_link($base.'/public/tree/current'))->toBeTrue();
});

test('poe2:link-game-data --force replaces a real directory with the symlink', function () {
    $base = storage_path('framework/testing/link-force-'.getmypid());
    File::deleteDirectory($base);
    $root = fakeGameDataRoot();
    app()->setBasePath($base);
    app()->usePublicPath($base.'/public');
    File::ensureDirectoryExists($base.'/public/tree/current');

    $this->artisan('poe2:link-game-data', ['--force' => true])->assertSuccessful();

    expect(is_link($base.'/public/tree/current'))->toBeTrue()
        ->and(readlink($base.'/public/tree/current'))->toBe($root.'/current/public/tree/current');
});

test('poe2:link-game-data refuses to replace a real directory without --force', function () {
    $public = storage_path('framework/testing/link-'.getmypid()).'/public';
    File::deleteDirectory(dirname($public));
    File::ensureDirectoryExists($public.'/tree/current');
    app()->usePublicPath($public);

    $this->artisan('poe2:link-game-data')->assertFailed();

    expect(is_link($public.'/tree/current'))->toBeFalse();
});

test('poe2:restage-data dispatches StageGameData for an explicit version, unforced', function () {
    fakeGameDataRoot();
    Bus::fake();

    $this->artisan('poe2:restage-data', ['version' => '4.5.5.0'])->assertSuccessful();

    Bus::assertDispatched(StageGameData::class, fn ($job) => $job->version === '4.5.5.0' && $job->force === false);
});

test('poe2:restage-data --force dispatches StageGameData with force set', function () {
    fakeGameDataRoot();
    Bus::fake();

    $this->artisan('poe2:restage-data', ['version' => '4.5.5.0', '--force' => true])->assertSuccessful();

    Bus::assertDispatched(StageGameData::class, fn ($job) => $job->version === '4.5.5.0' && $job->force === true);
});

test('poe2:restage-data defaults to the currently live version when none is given', function () {
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');
    app(GameDataReleases::class)->activate('4.5.5.0');
    Bus::fake();

    $this->artisan('poe2:restage-data')->assertSuccessful();

    Bus::assertDispatched(StageGameData::class, fn ($job) => $job->version === '4.5.5.0');
});

test('poe2:restage-data fails when no version is given and nothing is live', function () {
    fakeGameDataRoot();
    Bus::fake();

    $this->artisan('poe2:restage-data')->assertFailed();

    Bus::assertNotDispatched(StageGameData::class);
});

test('poe2:restage-data rejects a malformed version', function () {
    fakeGameDataRoot();
    Bus::fake();

    $this->artisan('poe2:restage-data', ['version' => '../evil'])->assertFailed();

    Bus::assertNotDispatched(StageGameData::class);
});
