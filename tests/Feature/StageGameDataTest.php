<?php

use App\Jobs\SendDiscordUnmappedEraNotification;
use App\Jobs\StageGameData;
use App\Jobs\TriggerContractRun;
use App\Services\GameDataReleases;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;

/*
 * StageGameData: extract into releases/<version>.staging, publish it as the
 * release, pack a tarball, and dispatch CI validation.
 */

function fakeRefreshData(): void
{
    Process::fake(function ($process) {
        if ($process->command[0] === 'npm') {
            $out = $process->environment['DATA_OUT'];
            File::ensureDirectoryExists($out.'/public/tree/current');
            File::put($out.'/public/tree/current/version.json', (string) json_encode([
                'v' => 'stub', 'patch' => $process->environment['PATCH'],
            ]));
        }

        if ($process->command[0] === 'tar') {
            $releasePath = $process->command[4];
            File::put("{$releasePath}.tar.gz", 'tarball-bytes');
        }

        return Process::result();
    });
}

test('staging a new version extracts, packs and dispatches CI validation', function () {
    fakeGameDataRoot();
    fakeRefreshData();
    Bus::fake([TriggerContractRun::class]);

    new StageGameData('4.5.5.0')->handle(app(GameDataReleases::class));

    $releases = app(GameDataReleases::class);
    expect($releases->has('4.5.5.0'))->toBeTrue()
        ->and($releases->checksum('4.5.5.0'))->not->toBeNull();

    Bus::assertDispatched(TriggerContractRun::class, fn ($job) => $job->version === '4.5.5.0');
});

test('a patch of no configured game era is held before anything is extracted, with one discord notice', function () {
    fakeGameDataRoot();
    Process::fake();
    Bus::fake([TriggerContractRun::class, SendDiscordUnmappedEraNotification::class]);
    $releases = app(GameDataReleases::class);

    // The watcher nudges a patch that is not live every few hours.
    new StageGameData('5.0.0.1')->handle($releases);
    new StageGameData('5.0.0.1')->handle($releases);

    Process::assertNothingRan();
    expect($releases->has('5.0.0.1'))->toBeFalse();
    Bus::assertNotDispatched(TriggerContractRun::class);
    Bus::assertDispatchedTimes(SendDiscordUnmappedEraNotification::class, 1);
});

test('the unmapped-era discord notice names the patch and what to do', function () {
    config()->set('services.discord.patch_webhook', 'https://discord.com/api/webhooks/1/abc');
    Http::fake();

    new SendDiscordUnmappedEraNotification('5.0.0.1')->handle();

    Http::assertSent(fn ($request) => $request->url() === 'https://discord.com/api/webhooks/1/abc'
        && str_contains($request['embeds'][0]['description'], '**5.0.0.1**')
        && str_contains($request['embeds'][0]['description'], 'poe.eras'));
});

test('staging an already-staged version without force skips extraction and reuses the checksum', function () {
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');
    $releases = app(GameDataReleases::class);
    File::put($releases->checksumPath('4.5.5.0'), "old-checksum\n");
    Process::fake();
    Bus::fake([TriggerContractRun::class]);

    new StageGameData('4.5.5.0')->handle($releases);

    Process::assertNothingRan();
    Bus::assertDispatched(TriggerContractRun::class, fn ($job) => $job->checksum === 'old-checksum');
});

test('force re-extracts and repacks an already-staged version instead of failing', function () {
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.5.0');
    $releases = app(GameDataReleases::class);
    File::put($releases->checksumPath('4.5.5.0'), "old-checksum\n");
    fakeRefreshData();
    Bus::fake([TriggerContractRun::class]);

    new StageGameData('4.5.5.0', force: true)->handle($releases);

    expect($releases->has('4.5.5.0'))->toBeTrue()
        ->and($releases->checksum('4.5.5.0'))->toBe(hash('sha256', 'tarball-bytes'))
        ->and($releases->checksum('4.5.5.0'))->not->toBe('old-checksum');

    Bus::assertDispatched(TriggerContractRun::class, fn ($job) => $job->checksum === hash('sha256', 'tarball-bytes'));
});

test('an invalid version refuses to run', function () {
    fakeGameDataRoot();
    Process::fake();
    Bus::fake([TriggerContractRun::class]);

    expect(fn () => new StageGameData('../evil')->handle(app(GameDataReleases::class)))
        ->toThrow(RuntimeException::class, 'invalid version');

    Process::assertNothingRan();
    Bus::assertNotDispatched(TriggerContractRun::class);
});
