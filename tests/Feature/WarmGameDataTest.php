<?php

declare(strict_types=1);

use App\Jobs\WarmGameDataCache;
use App\Pob\IconResolver;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

test('the warm-up command builds the gem indices into the cache', function () {
    fakeGameData(files: [
        'resources/poe2/ggpk/gems.json' => ['SkillGemAlpha' => ['name' => 'Alpha', 'kind' => 'active']],
        'resources/poe2/ggpk/gem_scaling.json' => ['SkillGemAlpha' => ['name' => 'Alpha', 'levels' => [], 'qualityStats' => []]],
        'resources/poe2/ggpk/gem_requirements.json' => [],
    ]);

    $this->artisan('poe2:warm-game-data')->assertSuccessful();

    // Served from the cache alone: the source file is gone.
    Storage::disk('game-data')->delete('resources/poe2/ggpk/gem_scaling.json');
    $resolver = new IconResolver(app(Repository::class), config()->string('poe.data_version'));

    expect($resolver->gemScaling('SkillGemAlpha')['name'])->toBe('Alpha');
});

test('the warm-up job runs the command in its own process', function () {
    Process::fake();

    (new WarmGameDataCache)->handle();

    Process::assertRan(fn (PendingProcess $process): bool => in_array('poe2:warm-game-data', (array) $process->command, true));
});
