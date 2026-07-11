<?php

declare(strict_types=1);

use App\Pob\Source\BuildSourceRegistry;
use Illuminate\Support\Facades\Http;

it('rejects an unimportable code with a validation error', function () {
    $this->post('/build-planner/import', ['code' => 'definitely-not-a-pob-code'])
        ->assertSessionHasErrors('code');
});

it('surfaces the pobb.in failure verbatim when the link cannot be fetched', function () {
    Http::fake(['pobb.in/*' => Http::response('', 500)]);

    $this->post('/build-planner/import', ['code' => 'https://pobb.in/abc123'])
        ->assertSessionHasErrors(['code' => 'This pobb.in link could not be fetched.']);
});

it('rejects input no build source recognises with a generic message', function () {
    $this->app->instance(BuildSourceRegistry::class, new BuildSourceRegistry([]));

    $this->post('/build-planner/import', ['code' => 'some-pasted-code'])
        ->assertSessionHasErrors(['code' => 'This is not a valid Path of Building 2 export code or pobb.in link.']);
});

it('rejects an over-sized import code', function () {
    $this->post('/build-planner/import', ['code' => str_repeat('A', 200_000)])
        ->assertSessionHasErrors('code');
});
