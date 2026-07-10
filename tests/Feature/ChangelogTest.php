<?php

use Inertia\Testing\AssertableInertia;

test('the changelog renders dated groups parsed from CHANGELOG.md', function () {
    $this->get(route('changelog'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('changelog')
            ->has('entries')
            ->has('entries.0.heading')
            ->has('entries.0.items')
        );
});
