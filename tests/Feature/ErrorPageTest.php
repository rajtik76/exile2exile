<?php

use Inertia\Testing\AssertableInertia;

test('an unknown url renders the branded Inertia error page', function () {
    $this->get('/this-page-does-not-exist')
        ->assertNotFound()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('error')
            ->where('status', 404)
        );
});

test('api routes keep returning json, not the Inertia error page', function () {
    $this->getJson('/api/this-does-not-exist')
        ->assertNotFound()
        ->assertHeader('content-type', 'application/json');
});
