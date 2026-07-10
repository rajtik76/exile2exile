<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Render Inertia pages client-side in tests: SSR would otherwise make an
        // HTTP call to the SSR/Vite server, which preventStrayRequests() blocks.
        config(['inertia.ssr.enabled' => false]);

        Http::preventStrayRequests();
    }
}
