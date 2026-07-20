<?php

declare(strict_types=1);

use App\Services\Poe2PatchServer;

test('prints the live patch version verbatim', function () {
    test()->mock(Poe2PatchServer::class)
        ->shouldReceive('currentVersion')
        ->andReturn('4.5.4.4.3');

    $this->artisan('poe2:current-patch')
        ->assertSuccessful()
        ->expectsOutput('4.5.4.4.3');
});

test('fails loudly when the patch server is unreachable', function () {
    test()->mock(Poe2PatchServer::class)
        ->shouldReceive('currentVersion')
        ->andThrow(new RuntimeException('patch server unreachable: timed out (110)'));

    $this->artisan('poe2:current-patch')->assertFailed();
});
