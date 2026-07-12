<?php

use App\Models\BuildPlan;
use App\Models\PageView;
use App\Models\PatchSubscriber;
use App\Models\SharedTree;
use App\Support\Planner\PlanSchema;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    config(['analytics.user' => 'admin', 'analytics.password' => 'secret']);
});

test('the dashboard rejects requests without basic auth', function () {
    $this->get(route('stats'))
        ->assertStatus(401)
        ->assertHeader('WWW-Authenticate', 'Basic realm="Stats"');
});

test('the dashboard rejects wrong credentials', function () {
    $this->withBasicAuth('admin', 'wrong')
        ->get(route('stats'))
        ->assertStatus(401);
});

test('the dashboard refuses every request when no credential is configured', function () {
    config(['analytics.user' => '', 'analytics.password' => '']);

    $this->withBasicAuth('', '')
        ->get(route('stats'))
        ->assertStatus(401);
});

test('the dashboard renders aggregates with valid basic auth', function () {
    PageView::factory()->count(3)->create(['path' => 'tree', 'visitor' => 'a']);
    PageView::factory()->create(['path' => 'tree', 'visitor' => 'b']);
    PatchSubscriber::factory()->create(['verified_at' => now()]);
    PatchSubscriber::factory()->create(['verified_at' => null]);
    SharedTree::create(['slug' => 'a', 'build' => ['className' => 'Witch', 'ascendId' => null, 'allocated' => []]]);
    SharedTree::create(['slug' => 'b', 'build' => ['className' => 'Witch', 'ascendId' => null, 'allocated' => []]]);

    foreach (['p1', 'p2', 'p3'] as $slug) {
        BuildPlan::create([
            'slug' => $slug,
            'edit_token' => hash('sha256', $slug),
            'title' => 'Plan',
            'schema_version' => PlanSchema::CURRENT_VERSION,
            'data' => PlanSchema::blank(),
        ]);
    }

    $this->withBasicAuth('admin', 'secret')
        ->get(route('stats'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('stats')
            ->where('totals.views', 4)
            ->where('totals.visitors', 2)
            ->where('totals.webhooksTotal', 2)
            ->where('totals.webhooksVerified', 1)
            ->where('totals.treesStored', 2)
            ->where('totals.plansStored', 3)
            ->where('topPaths.0.path', 'tree')
            ->where('topPaths.0.views', 4)
            ->where('topPaths.0.visitors', 2)
            ->has('daily', 30)
        );
});

test('the dashboard breaks views down by device', function () {
    PageView::factory()->count(3)->create(['device' => 'mobile', 'visitor' => 'a']);
    PageView::factory()->create(['device' => 'mobile', 'visitor' => 'b']);
    PageView::factory()->create(['device' => 'desktop', 'visitor' => 'c']);

    $this->withBasicAuth('admin', 'secret')
        ->get(route('stats'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('devices.0.device', 'mobile')
            ->where('devices.0.views', 4)
            ->where('devices.0.visitors', 2)
            ->where('devices.1.device', 'desktop')
            ->where('devices.1.views', 1)
        );
});
