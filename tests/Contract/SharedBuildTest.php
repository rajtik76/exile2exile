<?php

use App\Models\SharedBuild;
use Inertia\Testing\AssertableInertia;

/**
 * A valid allocation payload. Node ids are real entries in the current tree, so
 * the integrity check in ShareBuildRequest passes.
 */
function shareableBuild(array $overrides = []): array
{
    return array_merge([
        'className' => 'Witch',
        'ascendId' => 'Witch1',
        'allocated' => [4, 16, 30],
        'attributeChoices' => [4 => 'int'],
        'jewels' => [],
        'treeVersion' => '0_5',
    ], $overrides);
}

test('sharing a tree allocation stores it and returns a public link', function () {
    $response = $this->postJson(route('shared.store'), shareableBuild());

    $response->assertOk()
        ->assertJsonStructure(['slug', 'url']);

    $slug = $response->json('slug');

    expect($response->json('url'))->toContain("/t/{$slug}");

    $shared = SharedBuild::firstWhere('slug', $slug);

    expect($shared)->not->toBeNull()
        ->and($shared->build['className'])->toBe('Witch')
        ->and($shared->build['ascendId'])->toBe('Witch1')
        ->and($shared->build['allocated'])->toBe([4, 16, 30]);
});

test('re-sharing the same tree returns the same link without a duplicate', function () {
    $first = $this->postJson(route('shared.store'), shareableBuild());
    $second = $this->postJson(route('shared.store'), shareableBuild());

    $first->assertOk();
    $second->assertOk();

    expect($second->json('slug'))->toBe($first->json('slug'));
    expect(SharedBuild::count())->toBe(1);
});

test('node order does not change the dedup hash', function () {
    $this->postJson(route('shared.store'), shareableBuild(['allocated' => [4, 16, 30]]))->assertOk();
    $this->postJson(route('shared.store'), shareableBuild(['allocated' => [30, 4, 16]]))->assertOk();

    expect(SharedBuild::count())->toBe(1);
});

test('a different tree gets its own link', function () {
    $first = $this->postJson(route('shared.store'), shareableBuild(['allocated' => [4, 16]]));
    $second = $this->postJson(route('shared.store'), shareableBuild(['allocated' => [4, 16, 30]]));

    expect($second->json('slug'))->not->toBe($first->json('slug'));
    expect(SharedBuild::count())->toBe(2);
});

test('sharing stores weapon-set assignments', function () {
    $response = $this->postJson(route('shared.store'), shareableBuild([
        'weaponSets' => [16 => 1, 30 => 2],
    ]));

    $response->assertOk();
    $shared = SharedBuild::firstWhere('slug', $response->json('slug'));

    expect($shared->build['weaponSets'])->toBe([16 => 1, 30 => 2]);
});

test('an empty weapon-set map hashes like a build without one', function () {
    // A build shared before weapon sets existed (no key) and the same build with
    // an empty weaponSets map must collapse to a single row.
    $this->postJson(route('shared.store'), shareableBuild())->assertOk();
    $this->postJson(route('shared.store'), shareableBuild(['weaponSets' => []]))->assertOk();

    expect(SharedBuild::count())->toBe(1);
});

test('weapon sets change the dedup hash', function () {
    $plain = $this->postJson(route('shared.store'), shareableBuild());
    $tagged = $this->postJson(route('shared.store'), shareableBuild(['weaponSets' => [30 => 1]]));

    expect($tagged->json('slug'))->not->toBe($plain->json('slug'));
    expect(SharedBuild::count())->toBe(2);
});

test('a weapon set on an unallocated node is dropped', function () {
    // 999 is not in `allocated`, so its assignment must not be stored.
    $response = $this->postJson(route('shared.store'), shareableBuild([
        'allocated' => [4, 16, 30],
        'weaponSets' => [30 => 1, 999 => 2],
    ]));

    $response->assertOk();
    $shared = SharedBuild::firstWhere('slug', $response->json('slug'));

    expect($shared->build['weaponSets'])->toBe([30 => 1]);
});

test('an invalid weapon set value is rejected', function () {
    $this->postJson(route('shared.store'), shareableBuild(['weaponSets' => [30 => 3]]))
        ->assertInvalid(['weaponSets.30']);

    expect(SharedBuild::count())->toBe(0);
});

test('the viewer renders a shared build by its slug', function () {
    $shared = SharedBuild::create([
        'slug' => 'abc123XYZ789',
        'build' => shareableBuild(),
    ]);

    $this->get(route('shared.show', $shared))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree/shared')
            ->where('slug', 'abc123XYZ789')
            ->where('build.className', 'Witch')
            ->where('build.ascendId', 'Witch1')
        );
});

test('viewing a shared build records the visit', function () {
    $shared = SharedBuild::create([
        'slug' => 'viewstamp01',
        'build' => shareableBuild(),
    ]);

    expect($shared->last_viewed_at)->toBeNull();

    $this->get(route('shared.show', $shared))->assertOk();

    expect($shared->fresh()->last_viewed_at)->not->toBeNull();
});

test('an unknown slug 404s', function () {
    $this->get('/t/does-not-exist')->assertNotFound();
});

test('a build allocating a node outside the tree is rejected', function () {
    $this->postJson(route('shared.store'), shareableBuild(['allocated' => [999999999]]))
        ->assertInvalid(['allocated']);

    expect(SharedBuild::count())->toBe(0);
});

test('a share without a class is rejected', function () {
    $this->postJson(route('shared.store'), shareableBuild(['className' => '']))
        ->assertInvalid(['className']);
});

test('the planner opens seeded from a shared build via ?from', function () {
    $shared = SharedBuild::create([
        'slug' => 'seedme12345A',
        'build' => shareableBuild(),
    ]);

    $this->get(route('tree', ['from' => $shared->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree')
            ->where('initialBuild.className', 'Witch')
            ->where('initialBuild.allocated', [4, 16, 30])
        );
});

test('the planner opens empty without a from slug', function () {
    $this->get(route('tree'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree')
            ->where('initialBuild', null)
        );
});

test('an unknown from slug opens the planner empty', function () {
    $this->get(route('tree', ['from' => 'nope']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree')
            ->where('initialBuild', null)
        );
});
