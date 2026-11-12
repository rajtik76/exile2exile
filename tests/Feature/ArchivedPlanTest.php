<?php

use App\Models\BuildPlan;
use App\Services\GameDataReleases;
use App\Services\TreeSnapshots;
use App\Support\Planner\PlanSchema;
use Illuminate\Support\Facades\File;
use Inertia\Testing\AssertableInertia;

/*
 * A guide from a finished game era is shown with that era's archived items, gems and
 * passive tree, and converted onto the live data only when asked.
 */

/**
 * @return list<array<string, mixed>>
 */
function archivedPlanMods(int $lifeMin, int $lifeMax, bool $withOldMod, string $strengthTag, string $lifeAltFamily): array
{
    $mods = [
        ['id' => 'LifeAlt1', 'name' => 'Sturdy', 'domain' => 'Item', 'group' => 'LifeAlt', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to maximum Life'], 'rolls' => [['stat' => 'life', 'min' => 1, 'max' => 3]], 'families' => [$lifeAltFamily], 'spawnWeights' => [['tag' => 'default', 'weight' => 1000]]],
        ['id' => 'Strength1', 'name' => 'of the Brute', 'domain' => 'Item', 'group' => 'Strength', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to Strength'], 'rolls' => [['stat' => 'strength', 'min' => 4, 'max' => 8]], 'families' => ['Strength'], 'spawnWeights' => [['tag' => $strengthTag, 'weight' => 1000]]],
        ['id' => 'IncreasedLife1', 'name' => 'Hale', 'domain' => 'Item', 'group' => 'IncreasedLife', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to maximum Life'], 'rolls' => [['stat' => 'life', 'min' => $lifeMin, 'max' => $lifeMax]], 'families' => ['IncreasedLife'], 'spawnWeights' => [['tag' => 'default', 'weight' => 1000]]],
    ];

    if ($withOldMod) {
        $mods[] = ['id' => 'OldMod1', 'name' => 'of Yore', 'domain' => 'Item', 'group' => 'Old', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to Old Stat'], 'rolls' => [['stat' => 'old', 'min' => 1, 'max' => 5]], 'families' => ['Old'], 'spawnWeights' => [['tag' => 'default', 'weight' => 1000]]];
    }

    return $mods;
}

/**
 * @return array<string, mixed>
 */
function archivedThornguard(string $line): array
{
    return ['syncedAt' => '2026-01-01T00:00:00Z', 'sourceRef' => 'test', 'uniques' => [
        'Thornguard' => ['name' => 'Thornguard', 'base' => 'Strider Vest', 'league' => null, 'lines' => [['text' => $line, 'implicit' => false]]],
    ]];
}

/**
 * Live data knows the circlet, Alpha and a re-ranged life mod; the 0.4 archive also
 * knows an old hat, Beta and a mod that is gone now.
 */
function archivedEraPlan(): BuildPlan
{
    $root = fakeGameDataRoot();
    config()->set('poe.eras', ['4.4' => ['era' => '0.4', 'name' => 'Old Days'], '4.5' => '0.5']);

    $circlet = ['icon' => 'Helmets/Circlet.dds', 'itemClass' => 'Helmet', 'modDomain' => 'Item', 'tags' => ['helmet']];
    $thornguard = ['icon' => 'Uniques/Thornguard.dds', 'rarity' => 'unique', 'category' => 'Body Armour'];
    $uniques = fakePobUniquesRoot();
    File::ensureDirectoryExists($uniques);
    File::put("{$uniques}/current.json", (string) json_encode(archivedThornguard('+(60-90) to maximum Life')));
    $alpha = ['name' => 'Alpha', 'icon' => 'Skills/Alpha.dds', 'color' => 'b', 'kind' => 'active'];

    fakeGameData(files: [
        'resources/poe2/ggpk/items.json' => ['Gilded Circlet' => $circlet, 'Thornguard' => $thornguard],
        'resources/poe2/ggpk/gems.json' => ['SkillGemAlpha' => $alpha],
        'resources/poe2/ggpk/mods.json' => archivedPlanMods(10, 20, false, 'body_armour', 'IncreasedLife'),
    ]);

    $archive = "{$root}/archive/4.4.3.1";
    $archived = [
        'resources/poe2/ggpk/items.json' => ['Gilded Circlet' => $circlet, 'Thornguard' => $thornguard, 'Old Hat' => ['icon' => 'Armours/Hat.dds', 'itemClass' => 'Body Armour', 'modDomain' => 'Item', 'tags' => ['body_armour']]],
        'resources/poe2/ggpk/gems.json' => ['SkillGemAlpha' => $alpha, 'SkillGemBeta' => ['name' => 'Beta', 'icon' => 'Skills/Beta.dds', 'color' => 'r', 'kind' => 'active']],
        'resources/poe2/ggpk/mods.json' => archivedPlanMods(5, 15, true, 'default', 'LifeAlt'),
        'pob-uniques/current.json' => archivedThornguard('+(80-120) to maximum Life'),
        'public/tree/current/data.json' => ['nodes' => [], 'classes' => []],
        'public/tree/current/version.json' => ['v' => 'oldhash', 'patch' => '4.4.3.1'],
        'public/icons/poe2/Helmets/Circlet.png' => '',
    ];

    foreach ($archived as $path => $contents) {
        File::ensureDirectoryExists(dirname("{$archive}/{$path}"));
        File::put("{$archive}/{$path}", is_string($contents) ? $contents : (string) json_encode($contents));
    }

    fakeTreeSnapshot('4.4.3.1');

    $data = PlanSchema::blank();
    $data['tabs'] = PlanSchema::baseTabs();
    $data['build'] = ['className' => 'Witch', 'ascendId' => null];
    $data['sections']['act-1']['items']['slots'] = [
        'helmet' => ['base' => ['type' => 'base', 'id' => 'Gilded Circlet'], 'stats' => [
            ['modId' => 'IncreasedLife1', 'text' => '+7 to maximum Life', 'values' => [7]],
            ['modId' => 'OldMod1', 'text' => '+3 to Old Stat', 'values' => [3]],
            ['modId' => 'Strength1', 'text' => '+5 to Strength', 'values' => [5]],
            ['modId' => 'LifeAlt1', 'text' => '+2 to maximum Life', 'values' => [2]],
        ]],
        'body' => ['base' => ['type' => 'base', 'id' => 'Old Hat']],
    ];
    $data['sections']['act-2']['items']['slots'] = [
        'body' => ['base' => ['type' => 'unique', 'id' => 'Thornguard'], 'uniqueMods' => [['key' => '+# to maximum Life', 'values' => [110]]]],
    ];
    $data['sections']['single']['items']['slots'] = [
        'body' => ['base' => ['type' => 'base', 'id' => 'Old Hat']],
    ];
    $data['sections']['act-1']['gems']['groups'] = [
        ['id' => 'g-1', 'gems' => [['type' => 'gem', 'id' => 'SkillGemAlpha'], ['type' => 'gem', 'id' => 'SkillGemBeta']]],
    ];

    return BuildPlan::create([
        'slug' => 'oldPlan0001',
        'edit_token' => str_repeat('a', 64),
        'title' => 'Old Witch',
        'schema_version' => PlanSchema::CURRENT_VERSION,
        'data' => PlanSchema::canonicalize($data),
        'game_patch' => '4.4.3.1',
    ]);
}

test('a guide from a finished era is shown with its archived catalogues and tree', function () {
    $plan = archivedEraPlan();

    $this->get(route('planner.show', $plan))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/show')
            ->where('archive', [
                'gameEra' => '0.4',
                'eraName' => 'Old Days',
                'treePatch' => '4.4.3.1',
                'treeVersion' => app(TreeSnapshots::class)->version('4.4.3.1'),
            ])
            ->where('references.base:Old Hat.name', 'Old Hat')
            ->where('references.base:Gilded Circlet.icon', '/icons/eras/4.4.3.1/Helmets/Circlet.png')
            ->where('references.gem:SkillGemBeta.name', 'Beta')
            ->has('mods.OldMod1')
            ->where('meta.title', 'Old Witch (PoE2 0.4)')
        );
});

test('a guide whose era was never archived falls back to the stand-in', function () {
    fakeGameDataRoot();
    config()->set('poe.eras', ['4.4' => '0.4', '4.5' => '0.5']);
    $plan = BuildPlan::create(['slug' => 'oldPlan0002', 'edit_token' => str_repeat('a', 64), 'title' => 'Old', 'schema_version' => PlanSchema::CURRENT_VERSION, 'data' => PlanSchema::blank(), 'game_patch' => '4.4.3.1']);

    $this->get(route('planner.show', $plan))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('archived-build'));
});

test('converting a guide maps it onto the live data and drops what no longer fits, with a report', function () {
    $plan = archivedEraPlan();

    $this->get(route('planner.convert', $plan))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('planner/edit')
            ->where('mode', 'create')
            ->where('slug', null)
            ->where('title', 'Old Witch')
            ->where('plan.sections.act-1.items.slots.helmet.stats.0.text', '+10 to maximum Life')
            ->where('plan.sections.act-1.items.slots.helmet.stats.0.values', [10])
            ->has('plan.sections.act-1.items.slots.helmet.stats', 1)
            ->missing('plan.sections.act-1.items.slots.body')
            ->missing('plan.sections.single.items.slots.body')
            ->where('plan.sections.act-2.items.slots.body.uniqueMods', [['key' => '+# to maximum Life', 'values' => [90]]])
            ->where('plan.sections.act-1.gems.groups.0.gems', [['type' => 'gem', 'id' => 'SkillGemAlpha']])
            ->where('conversion.slug', 'oldPlan0001')
            ->where('conversion.gear.removed', [
                ['kind' => 'mod', 'name' => '+3 to Old Stat', 'phases' => ['Act I']],
                ['kind' => 'mod', 'name' => '+5 to Strength', 'phases' => ['Act I']],
                ['kind' => 'mod', 'name' => '+2 to maximum Life', 'phases' => ['Act I']],
                ['kind' => 'item', 'name' => 'Old Hat', 'phases' => ['Act I']],
                ['kind' => 'gem', 'name' => 'Beta', 'phases' => ['Act I']],
            ])
            ->where('conversion.gear.changed', [
                ['kind' => 'mod', 'name' => 'Hale', 'before' => '+7 to maximum Life', 'after' => '+10 to maximum Life', 'phases' => ['Act I']],
                ['kind' => 'uniqueMod', 'name' => '+# to maximum Life', 'before' => '+110 to maximum Life', 'after' => '+90 to maximum Life', 'phases' => ['Act II']],
            ])
        );

    expect(BuildPlan::count())->toBe(1);
});

test('a live guide has nothing to convert', function () {
    fakeGameDataRoot();
    $plan = BuildPlan::create(['slug' => 'livePlan001', 'edit_token' => str_repeat('a', 64), 'title' => 'Live', 'schema_version' => PlanSchema::CURRENT_VERSION, 'data' => PlanSchema::blank()]);

    $this->get(route('planner.convert', $plan))->assertNotFound();
});

test('freezing an era publishes only its icons', function () {
    $root = fakeGameDataRoot();
    File::ensureDirectoryExists("{$root}/archive/4.4.3.1/public/icons/poe2");

    app(GameDataReleases::class)->linkEraIcons();

    expect(readlink("{$root}/era-icons/4.4.3.1"))->toBe('../archive/4.4.3.1/public/icons/poe2')
        ->and(is_dir("{$root}/era-icons/4.4.3.1"))->toBeTrue();
});

test('icons that cannot be published do not keep a new era from going live', function () {
    $root = fakeGameDataRoot();
    config()->set('poe.eras', ['4.5' => '0.5', '5.0' => '1.0']);
    fakeGameDataRelease('4.5.5.0');
    fakeGameDataRelease('5.0.0.1');
    File::put("{$root}/era-icons", 'not a directory');
    $releases = app(GameDataReleases::class);
    $releases->activate('4.5.5.0');

    $releases->activate('5.0.0.1');

    expect($releases->currentVersion())->toBe('5.0.0.1')
        ->and($releases->archivedVersions())->toBe(['4.5.5.0']);
});
