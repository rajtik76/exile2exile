<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Process;
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

// The heaviest build pages render two passive-tree canvases at once and flake under
// the parallel run's 5s assertion timeout. A higher ceiling only hits genuinely slow
// cases (assertions wait for the condition), not the happy path.
pest()->browser()->timeout(20_000);
