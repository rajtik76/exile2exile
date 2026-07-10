<?php

declare(strict_types=1);

use App\Models\BuildPlan;
use App\Support\Planner\PlanSchema;

it('does not 500 when the edit token query param is an array', function () {
    $plan = BuildPlan::create([
        'slug' => 'array-token-plan',
        'edit_token' => 'secret-token',
        'title' => 'Array Token Plan',
        'schema_version' => PlanSchema::CURRENT_VERSION,
        'data' => PlanSchema::blank(),
    ]);

    // ?token[]=x arrives as an array; the token check must not pass it into the string
    // matchesEditToken() param (which would throw a TypeError -> 500 on this public route).
    $this->get("/build-planner/{$plan->slug}/edit?token[]=x")
        ->assertOk();
});
