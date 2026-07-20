<?php

declare(strict_types=1);

use App\Support\Planner\PlanTabs;

it('rejects a malformed tabs payload', function (mixed $tabs, string $message) {
    expect(PlanTabs::error($tabs))->toBe($message);
})->with([
    'not a list at all' => ['nonsense', 'The tabs list is malformed.'],
    'a non-array tab' => [['nonsense'], 'The tabs list is malformed.'],
    'an empty list' => [[], 'At least one phase must be present.'],
    'an unknown base id' => [
        [['id' => 'act-9', 'label' => 'Act IX', 'kind' => 'base']],
        'A base phase tab has an unknown id.',
    ],
    'a base tab without a name' => [
        [['id' => 'act-1', 'label' => '  ', 'kind' => 'base']],
        'Every phase needs a name.',
    ],
    'a custom tab without a name' => [
        [['id' => 'c-1', 'label' => '  ', 'kind' => 'custom']],
        'Every phase needs a name.',
    ],
    'an unknown kind' => [
        [['id' => 'act-1', 'label' => 'Act I', 'kind' => 'mystery']],
        'A phase tab has an unknown kind.',
    ],
    'a custom tab squatting on a base id' => [
        [['id' => 'act-1', 'label' => 'Sneaky', 'kind' => 'custom']],
        'A custom tab cannot use a base phase id.',
    ],
    'duplicate ids' => [
        [
            ['id' => 'c-1', 'label' => 'One', 'kind' => 'custom'],
            ['id' => 'c-1', 'label' => 'Two', 'kind' => 'custom'],
        ],
        'Phases must have distinct ids.',
    ],
    'too many custom tabs' => [
        [
            ['id' => 'c-1', 'label' => 'One', 'kind' => 'custom'],
            ['id' => 'c-2', 'label' => 'Two', 'kind' => 'custom'],
            ['id' => 'c-3', 'label' => 'Three', 'kind' => 'custom'],
            ['id' => 'c-4', 'label' => 'Four', 'kind' => 'custom'],
            ['id' => 'c-5', 'label' => 'Five', 'kind' => 'custom'],
        ],
        'Too many custom tabs.',
    ],
]);

it('accepts base phases in any subset and order, followed or preceded by custom tabs', function () {
    $tabs = [
        ['id' => 'act-3', 'label' => 'Act III', 'kind' => 'base'],
        ['id' => 'c-1', 'label' => 'Maps', 'kind' => 'custom'],
        ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
        ['id' => 'early-endgame', 'label' => 'Early Endgame', 'kind' => 'base'],
    ];

    expect(PlanTabs::error($tabs))->toBeNull();
});

it('accepts a renamed base tab - the fixed label is only a default', function () {
    expect(PlanTabs::error([['id' => 'act-1', 'label' => 'Prologue', 'kind' => 'base']]))->toBeNull();
});

it('accepts a single custom tab with no base phase at all', function () {
    expect(PlanTabs::error([['id' => 'c-1', 'label' => 'Only custom', 'kind' => 'custom']]))->toBeNull();
});

it('canonicalises a tabs blob, preserving submitted order and dropping malformed entries', function () {
    $canonical = PlanTabs::canonical([
        ['id' => 'act-3', 'label' => 'Act III', 'kind' => 'base'],
        ['id' => 'c-1', 'label' => ' Maps ', 'kind' => 'custom'],
        ['id' => 'c-1', 'label' => 'Duplicate', 'kind' => 'custom'],
        ['id' => '', 'label' => 'No id', 'kind' => 'custom'],
        ['id' => 'act-1', 'label' => ' Prologue ', 'kind' => 'base'],
        ['id' => 'act-1', 'label' => 'Duplicate id, dropped', 'kind' => 'base'],
        ['id' => 'act-2', 'label' => '  ', 'kind' => 'base'],
        ['id' => 'c-2', 'label' => 'Two', 'kind' => 'custom'],
        ['id' => 'c-3', 'label' => 'Three', 'kind' => 'custom'],
        ['id' => 'c-4', 'label' => 'Four', 'kind' => 'custom'],
        ['id' => 'c-5', 'label' => 'Past the cap', 'kind' => 'custom'],
    ]);

    expect($canonical)->toBe([
        ['id' => 'act-3', 'label' => 'Act III', 'kind' => 'base'],
        ['id' => 'c-1', 'label' => 'Maps', 'kind' => 'custom'],
        ['id' => 'act-1', 'label' => 'Prologue', 'kind' => 'base'],
        ['id' => 'c-2', 'label' => 'Two', 'kind' => 'custom'],
        ['id' => 'c-3', 'label' => 'Three', 'kind' => 'custom'],
        ['id' => 'c-4', 'label' => 'Four', 'kind' => 'custom'],
    ]);
});

it('falls back to "Act I" alone when the blob carries no valid phase', function () {
    expect(PlanTabs::canonical([['id' => '', 'label' => 'No id', 'kind' => 'custom']]))
        ->toBe([
            ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
        ]);
});

it('drops a custom tab squatting on a base id instead of storing it', function () {
    $canonical = PlanTabs::canonical([
        ['id' => 'act-1', 'label' => 'Sneaky', 'kind' => 'custom'],
        ['id' => 'c-1', 'label' => 'Maps', 'kind' => 'custom'],
    ]);

    expect($canonical)->toBe([
        ['id' => 'c-1', 'label' => 'Maps', 'kind' => 'custom'],
    ]);
});
