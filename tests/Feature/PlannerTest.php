<?php

use App\Models\BuildPlan;
use App\Support\Planner\PlanSchema;
use Inertia\Testing\AssertableInertia;

/**
 * Seed the handful of catalogue entries the planner tests lean on onto the mocked
 * `game-data` disk: a two-handed weapon and an off-hand base (for the weapon-conflict
 * rule) and one gem (for inline reference resolution). Everything else is pure request
 * logic that needs no game data.
 */
beforeEach(function () {
    fakeGameData(
        files: [
            'resources/poe2/ggpk/items.json' => [
                'Crude Bow' => ['rarity' => 'normal', 'twoHanded' => true, 'itemClass' => 'Bow'],
                'Iron Focus' => ['rarity' => 'normal', 'itemClass' => 'Focus'],
                'Bramblejack' => ['rarity' => 'unique', 'category' => 'Body Armour'],
            ],
            'resources/poe2/ggpk/gems.json' => [
                'SkillGemIceNova' => ['name' => 'Ice Nova', 'icon' => 'gems/ice-nova.dds', 'color' => 'b', 'kind' => 'active'],
            ],
            // Two affixes the item-modifier validation tests reference, each with a tier
            // range wide enough to accept the values those tests roll.
            'resources/poe2/ggpk/mods.json' => [
                ['id' => 'IncreasedLife1', 'name' => 'Hale', 'domain' => 'Item', 'group' => 'IncreasedLife', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to maximum Life'], 'rolls' => [['stat' => 'life', 'min' => 5, 'max' => 25]], 'families' => ['IncreasedLife'], 'spawnWeights' => [['tag' => 'default', 'weight' => 1000]]],
                ['id' => 'FireResist1', 'name' => 'of the Kiln', 'domain' => 'Item', 'group' => 'FireResistance', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['+#% to Fire Resistance'], 'rolls' => [['stat' => 'fire_resist', 'min' => 5, 'max' => 10]], 'families' => ['FireResist'], 'spawnWeights' => [['tag' => 'default', 'weight' => 1000]]],
            ],
        ],
        icons: ['gems/ice-nova.png'],
    );
});

/**
 * A valid store/update payload: the six base tabs verbatim plus whatever overrides
 * a test needs. Sections are optional - the server fills empty ones.
 */
function planPayload(array $overrides = []): array
{
    return array_merge([
        'title' => 'My Build',
        'description' => 'A cold witch that scales freeze.',
        'mode' => 'phases',
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [],
    ], $overrides);
}

/** Persist a plan straight to the DB (bypassing the request) for read/edit tests. */
function makePlan(array $overrides = []): BuildPlan
{
    return BuildPlan::create(array_merge([
        'slug' => 'plan'.fake()->unique()->numerify('######'),
        'edit_token' => str_repeat('a', 64),
        'title' => 'My Build',
        'schema_version' => PlanSchema::CURRENT_VERSION,
        'data' => PlanSchema::blank(),
    ], $overrides));
}

test('the create page renders the empty editor with only the first phase', function () {
    $this->get(route('planner.create'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/edit')
            ->where('mode', 'create')
            ->where('plan.mode', 'phases')
            ->has('plan.tabs', 1)
            ->where('plan.tabs.0.id', 'act-1')
        );
});

test('a plan may hold a leading prefix of base phases', function () {
    $tabs = array_slice(PlanSchema::baseTabs(), 0, 3);

    $this->post(route('planner.store'), planPayload(['tabs' => $tabs]))
        ->assertValid()
        ->assertRedirect();

    expect(array_column(BuildPlan::first()->data['tabs'], 'id'))
        ->toBe(['act-1', 'act-2', 'act-3']);
});

test('a plan missing the first phase is rejected', function () {
    $tabs = array_slice(PlanSchema::baseTabs(), 1, 2);

    $this->post(route('planner.store'), planPayload(['tabs' => $tabs]))
        ->assertInvalid(['tabs']);
});

test('a base phase prefix with a gap is rejected', function () {
    $tabs = [PlanSchema::baseTabs()[0], PlanSchema::baseTabs()[2]];

    $this->post(route('planner.store'), planPayload(['tabs' => $tabs]))
        ->assertInvalid(['tabs']);
});

test('storing a plan creates a row, unlocks the session and redirects to the editor without a token in the url', function () {
    $response = $this->post(route('planner.store'), planPayload());

    expect(BuildPlan::count())->toBe(1);

    $plan = BuildPlan::first();

    expect($plan->title)->toBe('My Build')
        ->and($plan->schema_version)->toBe(PlanSchema::CURRENT_VERSION)
        ->and(strlen((string) $plan->edit_token))->toBe(64);

    // The token is remembered in the session, never handed back in the URL.
    $response->assertRedirect(route('planner.edit', ['plan' => $plan->slug]));
    expect(session($plan->unlockSessionKey()))->toBe($plan->edit_token);
});

test('a stored plan keeps its entries and recomputes priorities from order', function () {
    $this->post(route('planner.store'), planPayload([
        'sections' => [
            'act-1' => [
                'items' => [
                    'notes' => 'buy the wand first',
                    'entries' => [
                        ['id' => 'e-1', 'name' => 'Wand', 'note' => '', 'priority' => 9],
                        ['id' => 'e-2', 'name' => 'Boots', 'note' => 'movespeed', 'priority' => 3],
                    ],
                ],
            ],
        ],
    ]))->assertRedirect();

    $items = BuildPlan::first()->data['sections']['act-1']['items'];

    expect($items['notes'])->toBe('buy the wand first')
        ->and($items['entries'][0]['name'])->toBe('Wand')
        ->and($items['entries'][0]['priority'])->toBe(1)
        ->and($items['entries'][1]['name'])->toBe('Boots')
        ->and($items['entries'][1]['priority'])->toBe(2);
});

test('a stored plan keeps the build class and a phase tree allocation', function () {
    $this->post(route('planner.store'), planPayload([
        'build' => ['className' => 'Witch', 'ascendId' => 'Witch1'],
        'sections' => [
            'act-1' => [
                'tree' => [
                    'notes' => '',
                    'entries' => [],
                    'allocation' => [
                        'allocated' => [4, 16, 30],
                        'treeVersion' => '0_5',
                    ],
                ],
            ],
        ],
    ]))->assertRedirect();

    $plan = BuildPlan::first();

    expect($plan->data['build'])->toBe(['className' => 'Witch', 'ascendId' => 'Witch1'])
        ->and($plan->data['sections']['act-1']['tree']['allocation']['allocated'])->toBe([4, 16, 30]);
});

test('a stored plan keeps gem groups and drops empty ones', function () {
    $this->post(route('planner.store'), planPayload([
        'sections' => [
            'act-1' => [
                'gems' => [
                    'notes' => '',
                    'entries' => [],
                    'groups' => [
                        ['id' => 'g1', 'gems' => [
                            ['type' => 'gem', 'id' => 'SkillGemIceNova'],
                            ['type' => 'gem', 'id' => 'SupportFaster'],
                        ]],
                        ['id' => 'g2', 'gems' => []],
                    ],
                ],
            ],
        ],
    ]))->assertRedirect();

    $groups = BuildPlan::first()->data['sections']['act-1']['gems']['groups'];

    expect($groups)->toHaveCount(1)
        ->and($groups[0]['gems'][0]['id'])->toBe('SkillGemIceNova');
});

test('a stored plan keeps equipment items and the viewer resolves their base refs', function () {
    $this->post(route('planner.store'), planPayload([
        'sections' => [
            'act-1' => [
                'items' => [
                    'notes' => '',
                    'entries' => [],
                    'slots' => [
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'unique', 'id' => 'Bramblejack'],
                            'stats' => [
                                ['modId' => 'IncreasedLife1', 'values' => [15]],
                                ['modId' => 'FireResist1', 'values' => [8]],
                            ],
                        ],
                        'ghost' => ['rarity' => 'rare', 'base' => null, 'stats' => []],
                    ],
                ],
            ],
        ],
    ]))->assertRedirect();

    $plan = BuildPlan::first();
    $slots = $plan->data['sections']['act-1']['items']['slots'];

    expect(array_keys($slots))->toBe(['body'])
        ->and($slots['body']['stats'])->toBe([
            ['modId' => 'IncreasedLife1', 'values' => [15]],
            ['modId' => 'FireResist1', 'values' => [8]],
        ]);

    $this->get(route('planner.show', $plan))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('references.unique:Bramblejack.type', 'unique')
        );
});

test('a stored plan keeps distinct item priorities', function () {
    $this->post(route('planner.store'), planPayload([
        'sections' => [
            'act-1' => [
                'items' => [
                    'notes' => '',
                    'entries' => [],
                    'slots' => [
                        'helmet' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Iron Helmet'],
                            'priority' => 2,
                        ],
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Plate Vest'],
                            'priority' => 1,
                        ],
                    ],
                ],
            ],
        ],
    ]))->assertRedirect();

    $slots = BuildPlan::first()->data['sections']['act-1']['items']['slots'];

    expect($slots['helmet']['priority'])->toBe(2)
        ->and($slots['body']['priority'])->toBe(1);
});

test('two items sharing a priority number are rejected', function () {
    $this->post(route('planner.store'), planPayload([
        'sections' => [
            'act-1' => [
                'items' => [
                    'notes' => '',
                    'entries' => [],
                    'slots' => [
                        'helmet' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Iron Helmet'],
                            'priority' => 1,
                        ],
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Plate Vest'],
                            'priority' => 1,
                        ],
                    ],
                ],
            ],
        ],
    ]))->assertInvalid(['sections.act-1.items.slots.body']);
});

test('an off-hand alongside a two-handed weapon is rejected', function () {
    $this->post(route('planner.store'), planPayload([
        'sections' => [
            'act-1' => [
                'items' => [
                    'notes' => '',
                    'entries' => [],
                    'slots' => [
                        'weapon1' => [
                            'rarity' => 'normal',
                            'base' => ['type' => 'base', 'id' => 'Crude Bow'],
                        ],
                        'weapon2' => [
                            'rarity' => 'normal',
                            'base' => ['type' => 'base', 'id' => 'Iron Focus'],
                        ],
                    ],
                ],
            ],
        ],
    ]))->assertInvalid(['sections.act-1.items.slots.weapon2']);
});

test('a two-handed weapon with an empty off-hand is accepted', function () {
    $this->post(route('planner.store'), planPayload([
        'sections' => [
            'act-1' => [
                'items' => [
                    'notes' => '',
                    'entries' => [],
                    'slots' => [
                        'weapon1' => [
                            'rarity' => 'normal',
                            'base' => ['type' => 'base', 'id' => 'Crude Bow'],
                        ],
                    ],
                ],
            ],
        ],
    ]))->assertValid();
});

test('an item priority above the slot count is rejected', function () {
    $this->post(route('planner.store'), planPayload([
        'sections' => [
            'act-1' => [
                'items' => [
                    'notes' => '',
                    'entries' => [],
                    'slots' => [
                        'helmet' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Iron Helmet'],
                            'priority' => 16,
                        ],
                    ],
                ],
            ],
        ],
    ]))->assertInvalid(['sections.act-1.items.slots.helmet.priority']);
});

test('a gem entry without a kind defaults to an active skill', function () {
    $this->post(route('planner.store'), planPayload([
        'sections' => [
            'act-1' => [
                'gems' => [
                    'notes' => '',
                    'entries' => [
                        ['id' => 'g-1', 'name' => 'Spark', 'note' => ''],
                    ],
                ],
            ],
        ],
    ]))->assertRedirect();

    expect(BuildPlan::first()->data['sections']['act-1']['gems']['entries'][0]['kind'])->toBe('active');
});

test('a plan can be saved with tabs switched off', function () {
    $this->post(route('planner.store'), planPayload([
        'mode' => 'single',
        'sections' => [
            'single' => [
                'tree' => [
                    'notes' => 'rush the freeze wheel',
                    'entries' => [],
                ],
            ],
        ],
    ]))->assertRedirect();

    $plan = BuildPlan::first();

    expect($plan->data['mode'])->toBe('single')
        ->and($plan->data['sections']['single']['tree']['notes'])->toBe('rush the freeze wheel');
});

test('the read viewer renders a plan by its slug', function () {
    $plan = makePlan(['slug' => 'abc123XYZ789', 'title' => 'Freeze Witch']);

    $this->get(route('planner.show', $plan))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/show')
            ->where('slug', 'abc123XYZ789')
            ->where('title', 'Freeze Witch')
        );
});

test('the viewer resolves inline reference tokens into a references prop', function () {
    $data = PlanSchema::blank();
    $data['description'] = 'Open with {{gem:SkillGemIceNova|Ice Nova}}.';

    $plan = makePlan(['slug' => 'refplan01AB', 'data' => $data]);

    $this->get(route('planner.show', $plan))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/show')
            ->where('references.gem:SkillGemIceNova.name', 'Ice Nova')
            ->where('references.gem:SkillGemIceNova.type', 'gem')
        );
});

test('viewing a plan records the visit', function () {
    $plan = makePlan();

    expect($plan->last_viewed_at)->toBeNull();

    $this->get(route('planner.show', $plan))->assertOk();

    expect($plan->fresh()->last_viewed_at)->not->toBeNull();
});

test('an unknown slug 404s', function () {
    $this->get('/build-planner/nope123')->assertNotFound();
});

test('the editor shows the unlock form until the session is unlocked', function () {
    $plan = makePlan();

    // No unlock yet → the gate, not the editor. The token is never asked for in the URL.
    $this->get(route('planner.edit', ['plan' => $plan->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/unlock')
            ->where('slug', $plan->slug)
        );

    // A legacy ?token= link is honoured once: it unlocks the session, then bounces to the
    // clean URL so the token never lingers in the address bar.
    $this->get(route('planner.edit', ['plan' => $plan->slug, 'token' => $plan->edit_token]))
        ->assertRedirect(route('planner.edit', ['plan' => $plan->slug]));

    // Now unlocked → the editor renders, with the token exposed only for the author to save.
    $this->get(route('planner.edit', ['plan' => $plan->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/edit')
            ->where('mode', 'edit')
            ->where('editToken', $plan->edit_token)
        );
});

test('the editor still shows the unlock form for a wrong token in the url', function () {
    $plan = makePlan();

    $this->get(route('planner.edit', ['plan' => $plan->slug, 'token' => 'wrong']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('planner/unlock'));

    expect(session($plan->unlockSessionKey()))->toBeNull();
});

test('unlock verifies the token in the body and opens the editor', function () {
    $plan = makePlan();

    $this->post(route('planner.unlock', ['plan' => $plan->slug]), ['token' => $plan->edit_token])
        ->assertRedirect(route('planner.edit', ['plan' => $plan->slug]));

    expect(session($plan->unlockSessionKey()))->toBe($plan->edit_token);
});

test('unlock requires a token', function () {
    $plan = makePlan();

    $this->from(route('planner.edit', ['plan' => $plan->slug]))
        ->post(route('planner.unlock', ['plan' => $plan->slug]), [])
        ->assertSessionHasErrors('token');

    expect(session($plan->unlockSessionKey()))->toBeNull();
});

test('an unknown slug cannot be unlocked', function () {
    $this->post(route('planner.unlock', ['plan' => 'doesnotexist']), ['token' => 'x'])
        ->assertNotFound();
});

test('unlock rejects a wrong token without unlocking', function () {
    $plan = makePlan();

    $this->from(route('planner.edit', ['plan' => $plan->slug]))
        ->post(route('planner.unlock', ['plan' => $plan->slug]), ['token' => 'wrong'])
        ->assertRedirect()
        ->assertSessionHasErrors('token');

    expect(session($plan->unlockSessionKey()))->toBeNull();
});

test('unlock hard-locks after three wrong tokens', function () {
    $plan = makePlan();

    // Three misses arm the cool-off.
    foreach (range(1, 3) as $attempt) {
        $this->from(route('planner.edit', ['plan' => $plan->slug]))
            ->post(route('planner.unlock', ['plan' => $plan->slug]), ['token' => 'wrong'])
            ->assertSessionHasErrors('token');
    }

    // The fourth try is locked out even with the correct token.
    $this->from(route('planner.edit', ['plan' => $plan->slug]))
        ->post(route('planner.unlock', ['plan' => $plan->slug]), ['token' => $plan->edit_token])
        ->assertSessionHasErrors('token');

    expect(session($plan->unlockSessionKey()))->toBeNull();
});

test('an edit is saved once the session is unlocked', function () {
    $plan = makePlan();

    $this->withSession([$plan->unlockSessionKey() => $plan->edit_token])
        ->put(route('planner.update', ['plan' => $plan->slug]), planPayload([
            'title' => 'Renamed Build',
        ]))->assertRedirect();

    expect($plan->fresh()->title)->toBe('Renamed Build');
});

test('an edit without an unlocked session is forbidden', function () {
    $plan = makePlan(['title' => 'Original']);

    $this->put(route('planner.update', ['plan' => $plan->slug]), planPayload([
        'title' => 'Hijacked',
    ]))->assertForbidden();

    expect($plan->fresh()->title)->toBe('Original');
});

test('an edit with a stale session token is forbidden', function () {
    $plan = makePlan(['title' => 'Original']);

    // A remembered token that no longer matches (e.g. rotated) does not authorise.
    $this->withSession([$plan->unlockSessionKey() => 'stale-token'])
        ->put(route('planner.update', ['plan' => $plan->slug]), planPayload([
            'title' => 'Hijacked',
        ]))->assertForbidden();

    expect($plan->fresh()->title)->toBe('Original');
});

test('an unlocked but invalid edit fails validation without saving', function () {
    $plan = makePlan(['title' => 'Original']);

    $this->withSession([$plan->unlockSessionKey() => $plan->edit_token])
        ->from(route('planner.edit', ['plan' => $plan->slug]))
        ->put(route('planner.update', ['plan' => $plan->slug]), planPayload([
            'title' => '',
        ]))->assertInvalid(['title']);

    expect($plan->fresh()->title)->toBe('Original');
});

test('a plan without a title is rejected', function () {
    $this->post(route('planner.store'), planPayload(['title' => '']))
        ->assertInvalid(['title']);

    expect(BuildPlan::count())->toBe(0);
});

test('a plan without a build description is rejected', function () {
    $this->post(route('planner.store'), planPayload(['description' => '']))
        ->assertInvalid(['description']);

    expect(BuildPlan::count())->toBe(0);
});

test('a plan with a missing build description is rejected', function () {
    $payload = planPayload();
    unset($payload['description']);

    $this->post(route('planner.store'), $payload)
        ->assertInvalid(['description']);

    expect(BuildPlan::count())->toBe(0);
});

test('an edit that empties the build description fails validation without saving', function () {
    $plan = makePlan(['title' => 'Original']);

    $this->withSession([$plan->unlockSessionKey() => $plan->edit_token])
        ->from(route('planner.edit', ['plan' => $plan->slug]))
        ->put(route('planner.update', ['plan' => $plan->slug]), planPayload([
            'description' => '',
        ]))->assertInvalid(['description']);

    expect($plan->fresh()->title)->toBe('Original');
});

test('reordering the base tabs is rejected', function () {
    $tabs = PlanSchema::baseTabs();
    [$tabs[0], $tabs[1]] = [$tabs[1], $tabs[0]];

    $this->post(route('planner.store'), planPayload(['tabs' => $tabs]))
        ->assertInvalid(['tabs']);

    expect(BuildPlan::count())->toBe(0);
});

test('a custom tab placed before the last base tab is rejected', function () {
    $tabs = PlanSchema::baseTabs();
    array_splice($tabs, 2, 0, [['id' => 'c-x', 'label' => 'Sneaky', 'kind' => 'custom']]);

    $this->post(route('planner.store'), planPayload(['tabs' => $tabs]))
        ->assertInvalid(['tabs']);

    expect(BuildPlan::count())->toBe(0);
});

test('more than four custom tabs is rejected', function () {
    $tabs = PlanSchema::baseTabs();

    for ($index = 1; $index <= 5; $index++) {
        $tabs[] = ['id' => "c-{$index}", 'label' => "Extra {$index}", 'kind' => 'custom'];
    }

    $this->post(route('planner.store'), planPayload(['tabs' => $tabs]))
        ->assertInvalid(['tabs']);

    expect(BuildPlan::count())->toBe(0);
});

test('exactly four custom tabs is accepted', function () {
    $tabs = PlanSchema::baseTabs();

    for ($index = 1; $index <= 4; $index++) {
        $tabs[] = ['id' => "c-{$index}", 'label' => "Extra {$index}", 'kind' => 'custom'];
    }

    $this->post(route('planner.store'), planPayload(['tabs' => $tabs]))
        ->assertRedirect();

    expect(BuildPlan::first()->data['tabs'])->toHaveCount(10);
});

test('a custom tab appended after the base tabs is accepted', function () {
    $tabs = [...PlanSchema::baseTabs(), ['id' => 'c-map', 'label' => 'Mapping', 'kind' => 'custom']];

    $this->post(route('planner.store'), planPayload(['tabs' => $tabs]))
        ->assertRedirect();

    $plan = BuildPlan::first();

    expect($plan->data['tabs'])->toHaveCount(7)
        ->and($plan->data['tabs'][6]['id'])->toBe('c-map')
        ->and($plan->data['tabs'][6]['kind'])->toBe('custom');
});

/** A store payload carrying a single equipment item in the given act-1 slot. */
function planWithItem(string $slot, array $item): array
{
    return planPayload([
        'sections' => [
            'act-1' => [
                'items' => ['notes' => '', 'entries' => [], 'slots' => [$slot => $item]],
            ],
        ],
    ]);
}

test('an item modifier rolled outside its tier range is rejected', function () {
    // FireResist1 rolls +(6-10)% to Fire Resistance; 0 is below its range.
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'BodyStr1'],
        'stats' => [['modId' => 'FireResist1', 'values' => [0]]],
    ]))->assertInvalid(['sections.act-1.items.slots.body']);

    expect(BuildPlan::count())->toBe(0);
});

test('an item modifier rolled inside its tier range is accepted', function () {
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'BodyStr1'],
        'stats' => [['modId' => 'FireResist1', 'values' => [8]]],
    ]))->assertRedirect();

    $stats = BuildPlan::first()->data['sections']['act-1']['items']['slots']['body']['stats'];

    expect($stats[0])->toBe(['modId' => 'FireResist1', 'values' => [8]]);
});

test('an item name above the max length is rejected', function () {
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'Plate1'],
        'name' => str_repeat('x', PlanSchema::MAX_ITEM_NAME_LENGTH + 1),
    ]))->assertInvalid(['sections.act-1.items.slots.body.name']);

    expect(BuildPlan::count())->toBe(0);
});

test('an item name at the max length is accepted', function () {
    $name = str_repeat('x', PlanSchema::MAX_ITEM_NAME_LENGTH);

    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'Plate1'],
        'name' => $name,
    ]))->assertRedirect();

    $body = BuildPlan::first()->data['sections']['act-1']['items']['slots']['body'];

    expect($body['name'])->toBe($name);
});

test('an item can be marked corrupted', function () {
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'Plate1'],
        'corrupted' => true,
    ]))->assertRedirect();

    $body = BuildPlan::first()->data['sections']['act-1']['items']['slots']['body'];

    expect($body['corrupted'])->toBe(true);
});

test('a weapon accepts three rune sockets', function () {
    $this->post(route('planner.store'), planWithItem('weapon1', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'Sword1'],
        'sockets' => [
            ['type' => 'rune', 'id' => 'RuneA'],
            ['type' => 'rune', 'id' => 'RuneB'],
            ['type' => 'rune', 'id' => 'RuneC'],
        ],
    ]))->assertRedirect();

    $sockets = BuildPlan::first()->data['sections']['act-1']['items']['slots']['weapon1']['sockets'];

    expect($sockets)->toHaveCount(3);
});

test('body armour accepts three rune sockets', function () {
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'Plate1'],
        'sockets' => [
            ['type' => 'rune', 'id' => 'RuneA'],
            ['type' => 'rune', 'id' => 'RuneB'],
            ['type' => 'rune', 'id' => 'RuneC'],
        ],
    ]))->assertRedirect();

    $sockets = BuildPlan::first()->data['sections']['act-1']['items']['slots']['body']['sockets'];

    expect($sockets)->toHaveCount(3);
});

test('more rune sockets than the slot allows is rejected', function () {
    // A rare helmet takes at most three runes (two natural + one Vaal); a fourth is over.
    $this->post(route('planner.store'), planWithItem('helmet', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'Helm1'],
        'sockets' => [
            ['type' => 'rune', 'id' => 'RuneA'],
            ['type' => 'rune', 'id' => 'RuneB'],
            ['type' => 'rune', 'id' => 'RuneC'],
            ['type' => 'rune', 'id' => 'RuneD'],
        ],
    ]))->assertInvalid(['sections.act-1.items.slots.helmet']);

    expect(BuildPlan::count())->toBe(0);
});

test('a unique helmet carries up to the global socket ceiling', function () {
    // Greymake and The Bringer of Rain wear four rune sockets on a helmet.
    $this->post(route('planner.store'), planWithItem('helmet', [
        'rarity' => 'unique',
        'base' => ['type' => 'unique', 'id' => 'Greymake'],
        'sockets' => [
            ['type' => 'rune', 'id' => 'RuneA'],
            ['type' => 'rune', 'id' => 'RuneB'],
            ['type' => 'rune', 'id' => 'RuneC'],
            ['type' => 'rune', 'id' => 'RuneD'],
        ],
    ]))->assertRedirect();

    expect(BuildPlan::count())->toBe(1);
});

test('rune sockets on jewellery or a belt are rejected', function (string $slot) {
    $this->post(route('planner.store'), planWithItem($slot, [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'Trinket1'],
        'sockets' => [['type' => 'rune', 'id' => 'RuneA']],
    ]))->assertInvalid(["sections.act-1.items.slots.{$slot}"]);

    expect(BuildPlan::count())->toBe(0);
})->with(['amulet', 'ring1', 'ring2', 'belt']);

test('a unique item with author modifiers is rejected', function () {
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'unique',
        'base' => ['type' => 'unique', 'id' => 'Bramblejack'],
        'stats' => [['modId' => 'IncreasedLife1', 'values' => [15]]],
    ]))->assertInvalid(['sections.act-1.items.slots.body']);

    expect(BuildPlan::count())->toBe(0);
});

test('a unique item may carry defensive properties', function () {
    // A unique's defences are the only way to record them, so props are accepted.
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'unique',
        'base' => ['type' => 'unique', 'id' => 'Bramblejack'],
        'props' => ['quality' => 20, 'armour' => 500, 'energyShield' => 80],
    ]))->assertRedirect();

    $props = BuildPlan::first()->data['sections']['act-1']['items']['slots']['body']['props'];

    expect($props['armour'])->toBe(500)
        ->and($props['energyShield'])->toBe(80)
        ->and($props['quality'])->toBe(20);
});

test('item quality above the ceiling is rejected', function () {
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'Plate1'],
        'props' => ['quality' => 101],
    ]))->assertInvalid(['sections.act-1.items.slots.body']);

    expect(BuildPlan::count())->toBe(0);
});

test('an item with three defence types saves (triple-hybrid bases exist)', function () {
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'rare',
        'base' => ['type' => 'base', 'id' => 'Plate1'],
        'props' => ['armour' => 100, 'evasion' => 100, 'energyShield' => 100],
    ]))->assertRedirect();

    expect(BuildPlan::count())->toBe(1);
});

test('a unique item may carry a corrupted flag', function () {
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'unique',
        'base' => ['type' => 'unique', 'id' => 'Bramblejack'],
        'corrupted' => true,
    ]))->assertRedirect();

    $body = BuildPlan::first()->data['sections']['act-1']['items']['slots']['body'];

    expect($body['corrupted'])->toBe(true);
});

test('a unique item with no author mods or requirements is accepted', function () {
    $this->post(route('planner.store'), planWithItem('body', [
        'rarity' => 'unique',
        'base' => ['type' => 'unique', 'id' => 'Bramblejack'],
    ]))->assertRedirect();

    $body = BuildPlan::first()->data['sections']['act-1']['items']['slots']['body'];

    expect($body['base']['id'])->toBe('Bramblejack')
        ->and($body['stats'])->toBe([]);
});

/*
 * Deleting a build - double-gated by the unlocked session AND the re-typed token.
 */

test('deleting a build verifies the re-typed token and removes the plan', function () {
    $plan = makePlan();

    $this->withSession([$plan->unlockSessionKey() => $plan->edit_token])
        ->delete(route('planner.destroy', ['plan' => $plan->slug]), ['token' => $plan->edit_token])
        ->assertRedirect(route('planner.create'));

    expect(BuildPlan::count())->toBe(0)
        // The unlock is gone with the plan - nothing secret lingers in the session.
        ->and(session($plan->unlockSessionKey()))->toBeNull();
});

test('deleting without an unlocked session is forbidden even with the right token', function () {
    $plan = makePlan();

    // The public slug plus a stolen token alone must not destroy anything: the delete
    // form only exists inside the unlocked editor.
    $this->delete(route('planner.destroy', ['plan' => $plan->slug]), ['token' => $plan->edit_token])
        ->assertForbidden();

    expect(BuildPlan::count())->toBe(1);
});

test('deleting with a wrong token keeps the plan and never flashes the secret', function () {
    $plan = makePlan();

    $this->withSession([$plan->unlockSessionKey() => $plan->edit_token])
        ->from(route('planner.edit', ['plan' => $plan->slug]))
        ->delete(route('planner.destroy', ['plan' => $plan->slug]), ['token' => 'wrong'])
        ->assertRedirect(route('planner.edit', ['plan' => $plan->slug]))
        ->assertSessionHasErrors('token');

    expect(BuildPlan::count())->toBe(1);
});

test('a missing token never lands in the old-input session flash', function () {
    $plan = makePlan();

    // A validation failure flashes old input for the redirect back - the token field
    // is excluded, so the secret is never persisted in the session flash.
    $this->withSession([$plan->unlockSessionKey() => $plan->edit_token])
        ->from(route('planner.edit', ['plan' => $plan->slug]))
        ->delete(route('planner.destroy', ['plan' => $plan->slug]), [])
        ->assertSessionHasErrors('token')
        ->assertSessionMissing('_old_input.token');

    expect(BuildPlan::count())->toBe(1);
});

test('deleting hard-locks after three wrong tokens', function () {
    $plan = makePlan();

    foreach (range(1, 3) as $attempt) {
        $this->withSession([$plan->unlockSessionKey() => $plan->edit_token])
            ->from(route('planner.edit', ['plan' => $plan->slug]))
            ->delete(route('planner.destroy', ['plan' => $plan->slug]), ['token' => 'wrong'])
            ->assertSessionHasErrors('token');
    }

    // Even the right token bounces during the cool-off.
    $this->withSession([$plan->unlockSessionKey() => $plan->edit_token])
        ->from(route('planner.edit', ['plan' => $plan->slug]))
        ->delete(route('planner.destroy', ['plan' => $plan->slug]), ['token' => $plan->edit_token])
        ->assertSessionHasErrors('token');

    expect(BuildPlan::count())->toBe(1);
});
