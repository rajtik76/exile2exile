<?php

use App\Models\BuildPlan;
use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Support\Planner\PlanSchema;
use Database\Seeders\PlanSeeder;

/**
 * The sample seeder must produce three fully-populated plans, each a different class,
 * with every stored id resolving against the live GGPK catalogues and every rare item's
 * modifiers passing the same validation the save endpoint enforces.
 */
test('the plan seeder creates three distinct-class builds', function () {
    $this->seed(PlanSeeder::class);

    $plans = BuildPlan::whereIn('slug', ['build1', 'build2', 'build3'])->get();

    expect($plans)->toHaveCount(3);

    $classes = $plans
        ->map(fn (BuildPlan $plan) => PlanSchema::normalize($plan->data, $plan->schema_version)['build']['className'])
        ->all();

    expect(array_unique($classes))->toHaveCount(3);
});

test('every phase of every seeded build is fully populated with resolvable data', function () {
    $this->seed(PlanSeeder::class);

    $icons = app(IconResolver::class);
    $catalogue = app(ModCatalogue::class);

    foreach (BuildPlan::whereIn('slug', ['build1', 'build2', 'build3'])->get() as $plan) {
        $data = PlanSchema::normalize($plan->data, $plan->schema_version);

        // All six base acts are present.
        expect($data['tabs'])->toHaveCount(6);

        foreach ($data['sections'] as $key => $section) {
            if ($key === PlanSchema::SINGLE_KEY) {
                continue;
            }

            // At least five skill gems, each with at least two supports, all resolvable.
            expect(count($section['gems']['groups']))->toBeGreaterThanOrEqual(5);

            foreach ($section['gems']['groups'] as $group) {
                expect(count($group['gems']))->toBeGreaterThanOrEqual(3);

                foreach ($group['gems'] as $gem) {
                    expect($icons->resolveReference('gem', $gem['id']))->not->toBeNull();
                }
            }

            // A full paper-doll with at least three valid rares (3-6 real mods each).
            $slots = $section['items']['slots'];
            $rares = 0;

            foreach ($slots as $slotKey => $item) {
                $base = $item['base'];
                expect($icons->resolveReference($base['type'], $base['id']))->not->toBeNull();

                foreach ($item['sockets'] as $socket) {
                    if ($socket !== null) {
                        expect($icons->resolveReference('rune', $socket['id']))->not->toBeNull();
                    }
                }

                if ($item['rarity'] === 'rare') {
                    $rares++;

                    expect(count($item['stats']))->toBeGreaterThanOrEqual(3)->toBeLessThanOrEqual(6);

                    $modErrors = $catalogue->modErrors(
                        'rare',
                        $item['stats'],
                        $icons->itemModDomain($base['id']),
                        $icons->itemTags($base['id']),
                    );
                    $shapeErrors = PlanSchema::itemErrors($slotKey, $item);

                    expect($modErrors)->toBe([])
                        ->and($shapeErrors)->toBe([]);
                }
            }

            expect(count($slots))->toBeGreaterThanOrEqual(12)
                ->and($rares)->toBeGreaterThanOrEqual(3);

            // At least fifty passive points spent.
            expect(count($section['tree']['allocation']['allocated']))->toBeGreaterThanOrEqual(50);
        }
    }
});

test('re-running the plan seeder is idempotent', function () {
    $this->seed(PlanSeeder::class);
    $this->seed(PlanSeeder::class);

    expect(BuildPlan::whereIn('slug', ['build1', 'build2', 'build3'])->count())->toBe(3);
});
