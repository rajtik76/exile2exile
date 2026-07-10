<?php

declare(strict_types=1);

it('rejects an unimportable code with a validation error', function () {
    $this->post('/build-planner/import', ['code' => 'definitely-not-a-pob-code'])
        ->assertSessionHasErrors('code');
});

it('rejects an over-sized import code', function () {
    $this->post('/build-planner/import', ['code' => str_repeat('A', 200_000)])
        ->assertSessionHasErrors('code');
});
