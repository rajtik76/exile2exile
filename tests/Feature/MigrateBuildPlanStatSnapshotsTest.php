<?php

use App\Models\BuildPlan;
use App\Support\GameEra;
use App\Support\Planner\PlanSchema;
use Illuminate\Support\Str;

beforeEach(function () {
    fakeGameData([
        'resources/poe2/ggpk/mods.json' => [
            ['id' => 'IncreasedLife9', 'name' => "Athlete's", 'domain' => 'Item', 'group' => 'IncreasedLife', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['+# to maximum Life'], 'rolls' => [['stat' => 'life', 'min' => 0, 'max' => 200]], 'families' => ['IncreasedLife'], 'spawnWeights' => [['tag' => 'default', 'weight' => 1000]]],
        ],
    ]);
});

/** A plan whose one ring still carries a stat in the old `{modId, values}` shape. */
function planWithLiveReferenceStat(string $slug, string $gamePatch): BuildPlan
{
    return BuildPlan::create([
        'slug' => $slug,
        'edit_token' => Str::random(64),
        'title' => 'Cold Witch',
        'schema_version' => PlanSchema::CURRENT_VERSION,
        'game_patch' => $gamePatch,
        'data' => ['sections' => ['single' => ['items' => ['slots' => [
            'ring1' => ['stats' => [['modId' => 'IncreasedLife9', 'values' => [130]]]],
        ]]]]],
    ]);
}

test('only plans of the live game era are frozen against the live catalogue', function () {
    $live = planWithLiveReferenceStat('liveplan0001', app(GameEra::class)->livePatch());
    $older = planWithLiveReferenceStat('oldplan00001', olderEraPatch());

    $this->artisan('planner:migrate-stat-snapshots')->assertSuccessful();

    expect($live->fresh()->data['sections']['single']['items']['slots']['ring1']['stats'][0])->toHaveKey('text')
        ->and($older->fresh()->data)->toBe($older->data);
});
