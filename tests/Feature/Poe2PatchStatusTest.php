<?php

use App\Models\PatchRelease;
use App\Services\Poe2PatchServer;
use App\Support\Poe2PatchStatus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

test('recording a poll exposes the raw version and check time', function () {
    $this->freezeTime(function () {
        // No release row yet, so the version is treated as released now.
        app(Poe2PatchStatus::class)->record('4.5.3.1.7');

        expect(app(Poe2PatchStatus::class)->current())->toBe([
            'version' => '4.5.3.1.7',
            'checkedAt' => now()->toIso8601String(),
            'releasedAt' => now()->toIso8601String(),
        ]);
    });
});

test('the release time comes from when the version was first detected', function () {
    Cache::flush();
    $release = PatchRelease::create(['version' => '4.5.3.1.7']);
    $release->forceFill(['created_at' => now()->subDays(3)])->save();

    app(Poe2PatchStatus::class)->record('4.5.3.1.7');
    $status = app(Poe2PatchStatus::class)->current();

    expect($status['releasedAt'])->toBe($release->fresh()->created_at->toIso8601String())
        ->and($status['checkedAt'])->toBe(now()->toIso8601String())
        ->and($status['releasedAt'])->not->toBe($status['checkedAt']);
});

test('a cold cache falls back to the last recorded release', function () {
    Cache::flush();
    $release = PatchRelease::create(['version' => '4.5.3.1.7']);

    expect(app(Poe2PatchStatus::class)->current())->toBe([
        'version' => '4.5.3.1.7',
        'checkedAt' => $release->created_at->toIso8601String(),
        'releasedAt' => $release->created_at->toIso8601String(),
    ]);
});

test('the status is null before any poll or release', function () {
    Cache::flush();

    expect(app(Poe2PatchStatus::class)->current())->toBeNull();
});

test('the watcher stamps the poll time even when the version is unchanged', function () {
    // A known-but-not-live version would nudge a StageGameData dispatch, which the
    // sync queue would run for real; this test only cares about the poll stamp.
    Queue::fake();
    Cache::flush();
    PatchRelease::create(['version' => '4.5.3.1.7']);
    test()->mock(Poe2PatchServer::class)
        ->shouldReceive('currentVersion')
        ->andReturn('4.5.3.1.7');

    $this->artisan('poe2:watch-patch')->assertSuccessful();

    expect(app(Poe2PatchStatus::class)->current()['version'])->toBe('4.5.3.1.7');
});
