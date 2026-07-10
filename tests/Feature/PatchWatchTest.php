<?php

use App\Jobs\SendDiscordPatchNotification;
use App\Jobs\SendPatchWebhook;
use App\Jobs\StageGameData;
use App\Jobs\TriggerContractRun;
use App\Models\PatchRelease;
use App\Models\PatchSubscriber;
use App\Services\GameDataReleases;
use App\Services\Poe2PatchServer;
use App\Support\Http\PublicUrlGuard;
use Illuminate\Process\Exceptions\ProcessFailedException;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;

function fakePatchServer(string $version): void
{
    test()->mock(Poe2PatchServer::class)
        ->shouldReceive('currentVersion')
        ->andReturn($version);
}

test('the watcher records a new patch and queues webhooks for verified subscribers', function () {
    Queue::fake();
    fakePatchServer('4.5.3.2.0');

    $verified = PatchSubscriber::factory()->create(['verified_at' => now(), 'last_notified_version' => '4.5.3.1.7']);
    PatchSubscriber::factory()->create(['verified_at' => null]);

    $this->artisan('poe2:watch-patch')->assertSuccessful();

    expect(PatchRelease::where('version', '4.5.3.2.0')->exists())->toBeTrue();
    Queue::assertPushed(SendPatchWebhook::class, 1);
    Queue::assertPushed(fn (SendPatchWebhook $job) => $job->subscriber->is($verified) && $job->version === '4.5.3.2.0');
    Queue::assertPushed(fn (StageGameData $job) => $job->version === '4.5.3.2.0');
    Queue::assertPushed(fn (SendDiscordPatchNotification $job) => $job->version === '4.5.3.2.0');
});

test('the watcher does nothing when the known patch is already live', function () {
    Queue::fake();
    fakePatchServer('4.5.3.1.7');
    PatchRelease::create(['version' => '4.5.3.1.7']);
    $this->mock(GameDataReleases::class)->shouldReceive('currentVersion')->andReturn('4.5.3.1.7');

    $this->artisan('poe2:watch-patch')->assertSuccessful();

    expect(PatchRelease::where('version', '4.5.3.1.7')->count())->toBe(1);
    Queue::assertNothingPushed();
});

test('a known patch that never went live is re-staged at most once per interval', function () {
    Queue::fake();
    fakePatchServer('4.5.3.2.0');
    PatchRelease::create(['version' => '4.5.3.2.0']);
    fakeGameDataRoot();

    $this->artisan('poe2:watch-patch')->assertSuccessful();
    $this->artisan('poe2:watch-patch')->assertSuccessful();

    // The first tick nudges; the second is throttled by the retry key.
    Queue::assertPushed(StageGameData::class, 1);
});

test('a freshly detected patch is not re-staged by the very next tick', function () {
    Queue::fake();
    fakePatchServer('4.5.3.2.0');
    fakeGameDataRoot();

    $this->artisan('poe2:watch-patch')->assertSuccessful();
    $this->artisan('poe2:watch-patch')->assertSuccessful();

    // Detection seeds the retry key, so the follow-up tick must not double-stage
    // while the extraction is still running.
    Queue::assertPushed(StageGameData::class, 1);
});

test('subscribing rejects a non-public url (SSRF guard)', function () {
    $this->postJson('/api/patch/subscribers', ['url' => 'https://127.0.0.1/hook'])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('url');
});

test('subscribing verifies an endpoint that echoes the challenge', function () {
    Http::fake(fn ($request) => Http::response($request['challenge']));

    $response = $this->postJson('/api/patch/subscribers', ['url' => 'https://1.1.1.1/poe2'])
        ->assertCreated()
        ->assertJson(['verified' => true]);

    $subscriber = PatchSubscriber::firstOrFail();
    expect($subscriber->verified_at)->not->toBeNull();
    expect($response->json('secret'))->toBe($subscriber->secret);
});

test('subscribing stays unverified when the endpoint does not echo the challenge', function () {
    Http::fake(fn () => Http::response('nope'));

    $this->postJson('/api/patch/subscribers', ['url' => 'https://1.1.1.1/poe2'])
        ->assertCreated()
        ->assertJson(['verified' => false]);

    expect(PatchSubscriber::firstOrFail()->verified_at)->toBeNull();
});

test('the webhook delivers a body signed with the subscriber secret', function () {
    Http::fake();
    $subscriber = PatchSubscriber::factory()->create(['url' => 'https://1.1.1.1/hook', 'secret' => 'shhh', 'verified_at' => now()]);

    new SendPatchWebhook($subscriber, '4.5.3.2.0')->handle(app(PublicUrlGuard::class));

    Http::assertSent(function ($request) use ($subscriber) {
        $expected = 'sha256='.hash_hmac('sha256', (string) $request->body(), $subscriber->secret);

        return $request->url() === $subscriber->url
            && $request->hasHeader('X-Poe2-Signature', $expected)
            && str_contains((string) $request->body(), '4.5.3.2.0');
    });

    expect($subscriber->fresh()->last_notified_version)->toBe('4.5.3.2.0');
});

test('a delivered webhook resets the failure streak', function () {
    Http::fake();
    $subscriber = PatchSubscriber::factory()->create(['url' => 'https://1.1.1.1/hook', 'verified_at' => now(), 'consecutive_failures' => 3]);

    new SendPatchWebhook($subscriber, '4.5.3.2.0')->handle(app(PublicUrlGuard::class));

    expect($subscriber->fresh()->consecutive_failures)->toBe(0);
});

test('a failed delivery counts toward the streak but keeps the subscriber', function () {
    $subscriber = PatchSubscriber::factory()->create(['verified_at' => now(), 'consecutive_failures' => 0]);

    new SendPatchWebhook($subscriber, '4.5.3.2.0')->failed(new RuntimeException('boom'));

    expect($subscriber->fresh())->not->toBeNull()
        ->and($subscriber->fresh()->consecutive_failures)->toBe(1);
});

test('the subscriber is dropped on the fifth consecutive failed delivery', function () {
    $subscriber = PatchSubscriber::factory()->create([
        'verified_at' => now(),
        'consecutive_failures' => PatchSubscriber::MAX_CONSECUTIVE_FAILURES - 1,
    ]);

    new SendPatchWebhook($subscriber, '4.5.3.2.0')->failed(new RuntimeException('boom'));

    expect(PatchSubscriber::find($subscriber->id))->toBeNull();
});

test('the discord notification posts an embed with the version to the webhook', function () {
    config()->set('services.discord.patch_webhook', 'https://discord.com/api/webhooks/1/abc');
    Http::fake();

    new SendDiscordPatchNotification('4.5.3.2.0')->handle();

    Http::assertSent(fn ($request) => $request->url() === 'https://discord.com/api/webhooks/1/abc'
        && $request['embeds'][0]['description'] === 'Version **4.5.3.2.0** is live.');
});

test('the discord notification is skipped when no webhook is configured', function () {
    config()->set('services.discord.patch_webhook', '');
    Http::preventStrayRequests();

    new SendDiscordPatchNotification('4.5.3.2.0')->handle();

    Http::assertNothingSent();
});

test('staging extracts into a staging dir, publishes the release, packs it and asks CI to validate', function () {
    Queue::fake([TriggerContractRun::class]);
    fakeGameDataRoot();
    $releases = app(GameDataReleases::class);

    // The extractor and tar are faked with their observable side effects: the
    // version stamp the extraction writes, and the tarball the pack produces.
    Process::fake(function ($process) use ($releases) {
        if ($process->command[0] === 'npm') {
            $out = (string) ($process->environment['DATA_OUT'] ?? '');
            expect($out)->toBe($releases->stagingPath('4.5.3.2.0'));
            File::ensureDirectoryExists($out.'/public/tree/current');
            File::put($out.'/public/tree/current/version.json', (string) json_encode(['v' => 'abc123', 'patch' => '4.5.3.2.0']));
        }

        if ($process->command[0] === 'tar') {
            File::put($releases->tarballPath('4.5.3.2.0'), 'tarball-bytes');
        }

        return Process::result();
    });

    new StageGameData('4.5.3.2.0')->handle($releases);

    expect($releases->has('4.5.3.2.0'))->toBeTrue()
        ->and(File::isDirectory($releases->stagingPath('4.5.3.2.0')))->toBeFalse()
        ->and($releases->checksum('4.5.3.2.0'))->toBe(hash('sha256', 'tarball-bytes'));

    Process::assertRan(fn ($process) => $process->command === ['npm', 'run', 'refresh:data']
        && ($process->environment['PATCH'] ?? null) === '4.5.3.2.0');
    Queue::assertPushed(fn (TriggerContractRun $job) => $job->version === '4.5.3.2.0'
        && $job->checksum === hash('sha256', 'tarball-bytes'));
});

test('staging an already staged release skips extraction and only re-triggers validation', function () {
    Queue::fake([TriggerContractRun::class]);
    fakeGameDataRoot();
    fakeGameDataRelease('4.5.3.2.0');
    $releases = app(GameDataReleases::class);
    File::put($releases->checksumPath('4.5.3.2.0'), "deadbeef\n");
    Process::fake();

    new StageGameData('4.5.3.2.0')->handle($releases);

    Process::assertNothingRan();
    Queue::assertPushed(fn (TriggerContractRun $job) => $job->checksum === 'deadbeef');
});

test('staging fails loud when the extractor errors and publishes nothing', function () {
    Queue::fake([TriggerContractRun::class]);
    fakeGameDataRoot();
    // Fake every process (no command pattern - the job runs an array command that a
    // string key would not match, which would run the real extractor).
    Process::fake(fn () => Process::result(errorOutput: 'boom', exitCode: 1));
    $releases = app(GameDataReleases::class);

    expect(fn () => new StageGameData('4.5.3.2.0')->handle($releases))
        ->toThrow(ProcessFailedException::class)
        ->and($releases->has('4.5.3.2.0'))->toBeFalse();

    Queue::assertNothingPushed();
});

test('staging refuses a version that is not a dotted patch number', function () {
    Process::fake();

    expect(fn () => new StageGameData('../evil')->handle(app(GameDataReleases::class)))
        ->toThrow(RuntimeException::class);

    Process::assertNothingRan();
});

test('the contract-run dispatch posts the staged version and checksum to GitHub', function () {
    config()->set('services.github', [
        'token' => 'gh-token',
        'repository' => 'owner/repo',
        'workflow' => 'data-contract.yml',
        'ref' => 'main',
    ]);
    Http::fake();

    new TriggerContractRun('4.5.3.2.0', 'cafe123')->handle();

    Http::assertSent(fn ($request) => $request->url() === 'https://api.github.com/repos/owner/repo/actions/workflows/data-contract.yml/dispatches'
        && $request->hasHeader('Authorization', 'Bearer gh-token')
        && $request['ref'] === 'main'
        && $request['inputs']['version'] === '4.5.3.2.0'
        && $request['inputs']['sha256'] === 'cafe123');
});

test('the contract-run dispatch is skipped when no GitHub token is configured', function () {
    config()->set('services.github.token', '');
    Http::preventStrayRequests();

    new TriggerContractRun('4.5.3.2.0', 'cafe123')->handle();

    Http::assertNothingSent();
});

test('pruning removes unverified subscribers past the grace window only', function () {
    $stale = PatchSubscriber::factory()->create(['verified_at' => null, 'created_at' => now()->subDays(8)]);
    $recent = PatchSubscriber::factory()->create(['verified_at' => null, 'created_at' => now()->subDay()]);
    $verifiedOld = PatchSubscriber::factory()->create(['verified_at' => now(), 'created_at' => now()->subDays(30)]);

    $this->artisan('poe2:prune-patch-subscribers')->assertSuccessful();

    expect(PatchSubscriber::find($stale->id))->toBeNull()
        ->and(PatchSubscriber::find($recent->id))->not->toBeNull()
        ->and(PatchSubscriber::find($verifiedOld->id))->not->toBeNull();
});
