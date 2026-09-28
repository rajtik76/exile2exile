<?php

use App\Support\TreeDataVersion;
use Illuminate\Support\Facades\DB;

/**
 * The migration that adds `game_patch`. Required directly so it can be rolled back
 * and re-run against rows that predate the column (under RefreshDatabase it ran on
 * empty tables).
 */
function gamePatchMigration(): object
{
    return require database_path('migrations/2026_09_28_083122_add_game_patch_to_shared_trees_and_build_plans.php');
}

test('rows saved before the column existed are stamped with the live patch', function () {
    $this->mock(TreeDataVersion::class)->shouldReceive('current')->andReturn('4.5.5.4');
    gamePatchMigration()->down();

    DB::table('shared_trees')->insert(['slug' => 'legacyTree01', 'build' => '{"className":"Witch"}', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('build_plans')->insert(['slug' => 'legacyPlan01', 'edit_token' => str_repeat('a', 64), 'title' => 'Old', 'schema_version' => 1, 'data' => '{}', 'created_at' => now(), 'updated_at' => now()]);

    gamePatchMigration()->up();

    expect(DB::table('shared_trees')->value('game_patch'))->toBe('4.5.5.4')
        ->and(DB::table('build_plans')->value('game_patch'))->toBe('4.5.5.4');
});

test('it refuses to stamp rows when the live data belongs to no game era', function () {
    $this->mock(TreeDataVersion::class)->shouldReceive('current')->andReturn('9.9.0.1');
    gamePatchMigration()->down();

    expect(fn () => gamePatchMigration()->up())->toThrow(RuntimeException::class, 'no configured era');
});
