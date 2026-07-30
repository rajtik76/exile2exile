<?php

use App\Models\BuildPlan;
use App\Support\Planner\PlanSchema;
use App\Tree\TreeIndex;
use Inertia\Testing\AssertableInertia;

/**
 * The planner pages label a build's class/ascendancy above the fold. That name is
 * resolved here, on the server, precisely so the browser does not have to download the
 * multi-MB passive tree before the header and its backdrop art can render - the tree's
 * own payload stays deferred until the reader scrolls to the tree frame.
 *
 * Seed only the two classes these tests touch onto the mocked `game-data` disk, same
 * idiom as {@see NormalizeAscendancyMigrationTest} - no real tree export needed.
 */
beforeEach(function () {
    fakeGameData([
        'public/tree/current/data.json' => [
            'classes' => [
                [
                    'name' => 'Mercenary',
                    'ascendancies' => [
                        ['id' => 'Mercenary1', 'name' => 'Tactician'],
                        ['id' => 'Mercenary2', 'name' => 'Witchhunter'],
                    ],
                ],
                ['name' => 'Witch', 'ascendancies' => [['id' => 'Witch2', 'name' => 'Blood Mage']]],
            ],
        ],
    ]);
});

/** A saved plan whose build carries the given class and ascendancy id. */
function planWithBuild(?string $className, ?string $ascendId): BuildPlan
{
    $data = PlanSchema::blank();
    $data['build'] = ['className' => $className, 'ascendId' => $ascendId];

    return BuildPlan::create([
        'slug' => 'ascn'.fake()->unique()->numerify('########'),
        'edit_token' => str_repeat('a', 64),
        'title' => 'Labelled build',
        'schema_version' => PlanSchema::CURRENT_VERSION,
        'data' => $data,
    ]);
}

test('it names an ascendancy stored as a GGG internal id', function () {
    // What a PoB import stores: the tree's internal id, never shown to a reader.
    expect(app(TreeIndex::class)->ascendancyName('Mercenary', 'Mercenary2'))
        ->toBe('Witchhunter');
});

test('it passes a display-name ascendancy through', function () {
    // What the planner's class gallery stores - already the name the renderer keys by.
    expect(app(TreeIndex::class)->ascendancyName('Mercenary', 'Witchhunter'))
        ->toBe('Witchhunter');
});

test('it matches the class name case-insensitively', function () {
    expect(app(TreeIndex::class)->ascendancyName('mercenary', 'Mercenary2'))
        ->toBe('Witchhunter');
});

test('it returns null for an ascendancy the class does not carry', function () {
    // Never a blind pass-through: an unresolvable value must read as "no ascendancy"
    // rather than put a raw id like "Mercenary9" in front of a reader.
    expect(app(TreeIndex::class)->ascendancyName('Mercenary', 'Mercenary9'))->toBeNull()
        // Another class's ascendancy does not resolve either.
        ->and(app(TreeIndex::class)->ascendancyName('Mercenary', 'Blood Mage'))->toBeNull();
});

test('it returns null for an unknown class or a missing id', function () {
    $tree = app(TreeIndex::class);

    expect($tree->ascendancyName('Sailor', 'Sailor1'))->toBeNull()
        ->and($tree->ascendancyName('Mercenary', null))->toBeNull()
        ->and($tree->ascendancyName(null, 'Mercenary2'))->toBeNull();
});

test('the viewer gets the ascendancy name resolved, not the stored id', function () {
    $plan = planWithBuild('Mercenary', 'Mercenary2');

    $this->get(route('planner.show', ['plan' => $plan->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/show')
            ->where('plan.build.ascendId', 'Mercenary2')
            ->where('ascendancyName', 'Witchhunter')
        );
});

test('the viewer gets a null name for a build with no ascendancy', function () {
    $plan = planWithBuild('Mercenary', null);

    $this->get(route('planner.show', ['plan' => $plan->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->where('ascendancyName', null));
});

test('the editor gets the ascendancy name resolved too', function () {
    $plan = planWithBuild('Witch', 'Witch2');

    $this->withSession([$plan->unlockSessionKey() => $plan->edit_token])
        ->get(route('planner.edit', ['plan' => $plan->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/edit')
            ->where('ascendancyName', 'Blood Mage')
        );
});

test('the create page carries a null name, having no class yet', function () {
    $this->get(route('planner.create'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/edit')
            ->where('ascendancyName', null)
        );
});
