<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Poll the PoE2 patch server every five minutes; on a new version, fan the
// "patch released" signal out to the webhook subscribers.
Schedule::command('poe2:watch-patch')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->onOneServer();

// Drop subscribers that never verified their endpoint within the grace window.
Schedule::command('poe2:prune-patch-subscribers')
    ->daily()
    ->onOneServer();

// Refresh the cached poe2scout economy prices on their 6-hour publish cadence; the
// loot-filter generator reads this snapshot instead of ever calling poe2scout live.
$economySync = Schedule::command('poe2:sync-economy')
    ->everySixHours()
    ->withoutOverlapping()
    ->onOneServer();

// Heartbeat: ping a push-style monitor (e.g. Uptime Kuma) only when the sync succeeds,
// so a failed or skipped run withholds the ping and the monitor raises the alarm.
$heartbeatUrl = config('poe.economy.heartbeat_url');

if (is_string($heartbeatUrl) && $heartbeatUrl !== '') {
    $economySync->pingOnSuccess($heartbeatUrl);
}
