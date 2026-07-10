<?php

declare(strict_types=1);

use App\Models\BuildPlan;

function witchImportCode(): string
{
    return file_get_contents(dirname(__DIR__, 2).'/resources/pob/poe2/witch-lvl80-runes-of-aldur-league.txt');
}

test('importing a PoB build returns the mapped plan without saving anything', function () {
    $response = $this->postJson(route('planner.import'), ['code' => witchImportCode()]);

    $response->assertOk()
        ->assertJsonPath('title', 'Lich · Level 80')
        ->assertJsonPath('plan.mode', 'single')
        // Lich is the witch fixture's ascendancy; stored as the live tree id.
        ->assertJsonPath('plan.build', ['className' => 'Witch', 'ascendId' => 'Witch3']);

    // An import is throwaway: it never leaves a row behind (only saving does).
    expect(BuildPlan::count())->toBe(0);
});

test('the imported plan carries the tree, gems and equipment', function () {
    $single = $this->postJson(route('planner.import'), ['code' => witchImportCode()])
        ->json('plan.sections.single');

    expect($single['tree']['allocation']['allocated'])->toHaveCount(111)
        ->and($single['gems']['groups'])->not->toBeEmpty()
        ->and($single['items']['slots'])->toHaveKey('belt');
});

test('an unresolvable code is rejected without creating a plan', function () {
    $this->from(route('planner.create'))
        ->post(route('planner.import'), ['code' => 'not-a-real-pob-code'])
        ->assertInvalid('code');

    expect(BuildPlan::count())->toBe(0);
});

test('a missing code is a validation error', function () {
    $this->from(route('planner.create'))
        ->post(route('planner.import'), [])
        ->assertInvalid('code');

    expect(BuildPlan::count())->toBe(0);
});
