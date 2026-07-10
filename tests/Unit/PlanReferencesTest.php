<?php

use App\Pob\IconResolver;
use App\Support\Planner\PlanReferences;

/**
 * A plan blob whose texts carry a gem token (description), a rune token (a section's
 * notes) and an unknown gem token that must not resolve.
 */
function planWithTokens(): array
{
    return [
        'description' => 'Open with {{gem:SkillGemIceNova|Ice Nova}} for clear.',
        'sections' => [
            'act-1' => [
                'items' => ['notes' => 'no tokens here', 'entries' => []],
                'gems' => ['notes' => 'Socket {{gem:Nope|Ghost Gem}} later.', 'entries' => []],
                'tree' => ['notes' => 'Slot {{rune:Rune of Reach|Rune of Reach}}.', 'entries' => []],
            ],
        ],
    ];
}

test('collect gathers every distinct reference token across a plan', function () {
    $refs = PlanReferences::collect(planWithTokens());

    expect($refs)->toContain(['type' => 'gem', 'id' => 'SkillGemIceNova'])
        ->and($refs)->toContain(['type' => 'gem', 'id' => 'Nope'])
        ->and($refs)->toContain(['type' => 'rune', 'id' => 'Rune of Reach']);
});

test('collect de-duplicates repeated tokens', function () {
    $data = ['description' => '{{gem:SkillGemIceNova|A}} then {{gem:SkillGemIceNova|B}}'];

    expect(PlanReferences::collect($data))->toBe([['type' => 'gem', 'id' => 'SkillGemIceNova']]);
});

test('resolveMap resolves known references and drops unknown ones', function () {
    $map = PlanReferences::resolveMap(planWithTokens(), new IconResolver);

    expect($map)->toHaveKey('gem:SkillGemIceNova')
        ->and($map)->toHaveKey('rune:Rune of Reach')
        ->and($map)->not->toHaveKey('gem:Nope')
        ->and($map['gem:SkillGemIceNova']['name'])->toBe('Ice Nova')
        ->and($map['gem:SkillGemIceNova']['icon'])->not->toBeNull();
});

test('resolveMap resolves a gem sitting in a gem group', function () {
    $data = [
        'sections' => [
            'act-1' => [
                'gems' => [
                    'notes' => '',
                    'entries' => [],
                    'groups' => [
                        ['id' => 'g1', 'gems' => [
                            ['type' => 'gem', 'id' => 'SkillGemIceNova'],
                        ]],
                    ],
                ],
            ],
        ],
    ];

    $map = PlanReferences::resolveMap($data, new IconResolver);

    expect($map)->toHaveKey('gem:SkillGemIceNova')
        ->and($map['gem:SkillGemIceNova']['name'])->toBe('Ice Nova');
});

test('resolveMap resolves the base ref of an equipment slot item', function () {
    $data = [
        'sections' => [
            'act-1' => [
                'items' => [
                    'notes' => '',
                    'entries' => [],
                    'slots' => [
                        'body' => [
                            'rarity' => 'unique',
                            'base' => ['type' => 'unique', 'id' => 'Bramblejack'],
                            'stats' => [],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $map = PlanReferences::resolveMap($data, new IconResolver);

    expect($map)->toHaveKey('unique:Bramblejack')
        ->and($map['unique:Bramblejack']['icon'])->not->toBeNull();
});

test('resolveMap resolves a unique-item reference', function () {
    $data = ['description' => 'Aim for {{unique:Bramblejack|Bramblejack}}.'];

    $map = PlanReferences::resolveMap($data, new IconResolver);

    expect($map)->toHaveKey('unique:Bramblejack')
        ->and($map['unique:Bramblejack']['type'])->toBe('unique')
        ->and($map['unique:Bramblejack']['category'])->toContain('Unique')
        ->and($map['unique:Bramblejack']['icon'])->not->toBeNull()
        ->and($map['unique:Bramblejack']['flavour'])->not->toBeNull();
});

test('the token pattern ignores malformed tokens', function () {
    $data = ['description' => 'no {{gem}} bare, {{unknown:x|y}} type, {{gem:|empty}} id'];

    expect(PlanReferences::collect($data))->toBe([]);
});
