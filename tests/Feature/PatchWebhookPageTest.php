<?php

use Inertia\Testing\AssertableInertia;

test('the patch webhook docs page renders', function () {
    $this->get(route('patch-webhook'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('patch-webhook'));
});
