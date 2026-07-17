<?php

declare(strict_types=1);

use App\Support\Planner\PlanTabs;

it('rejects a malformed tabs payload', function (mixed $tabs, string $message) {
    expect(PlanTabs::error($tabs))->toBe($message);
})->with([
    'not a list at all' => ['nonsense', 'The tabs list is malformed.'],
    'a non-array tab' => [['nonsense'], 'The tabs list is malformed.'],
    'an empty list' => [[], 'At least the first phase must be present.'],
    'a custom tab first' => [
        [['id' => 'c-1', 'label' => 'My Tab', 'kind' => 'custom']],
        '"Act I" must be the first phase.',
    ],
    'a renamed base tab' => [
        [['id' => 'act-1', 'label' => 'Act One', 'kind' => 'base']],
        'The base phase tabs must be a leading prefix of the fixed list, in order.',
    ],
    'a custom tab without a name' => [
        [['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'], ['id' => 'c-1', 'label' => '  ', 'kind' => 'custom']],
        'Every custom tab needs a name.',
    ],
    'duplicate custom ids' => [
        [
            ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
            ['id' => 'c-1', 'label' => 'One', 'kind' => 'custom'],
            ['id' => 'c-1', 'label' => 'Two', 'kind' => 'custom'],
        ],
        'Custom tabs must have distinct ids.',
    ],
    'a base tab after a custom tab' => [
        [
            ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
            ['id' => 'c-1', 'label' => 'One', 'kind' => 'custom'],
            ['id' => 'act-2', 'label' => 'Act II', 'kind' => 'base'],
        ],
        'A custom tab is malformed or placed before "Early Endgame".',
    ],
    'too many custom tabs' => [
        [
            ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
            ['id' => 'c-1', 'label' => 'One', 'kind' => 'custom'],
            ['id' => 'c-2', 'label' => 'Two', 'kind' => 'custom'],
            ['id' => 'c-3', 'label' => 'Three', 'kind' => 'custom'],
            ['id' => 'c-4', 'label' => 'Four', 'kind' => 'custom'],
            ['id' => 'c-5', 'label' => 'Five', 'kind' => 'custom'],
        ],
        'Too many custom tabs.',
    ],
]);

it('accepts a base prefix followed by well-formed custom tabs', function () {
    $tabs = [
        ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
        ['id' => 'act-2', 'label' => 'Act II', 'kind' => 'base'],
        ['id' => 'c-1', 'label' => 'Maps', 'kind' => 'custom'],
    ];

    expect(PlanTabs::error($tabs))->toBeNull();
});

it('canonicalises a gapped or duplicate tabs blob back to a legal list', function () {
    // Act III without Act II must not resurrect the skipped phase; a nameless or
    // duplicate custom tab is dropped; customs past the cap are cut.
    $canonical = PlanTabs::canonical([
        ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
        ['id' => 'act-3', 'label' => 'Act III', 'kind' => 'base'],
        ['id' => 'c-1', 'label' => ' Maps ', 'kind' => 'custom'],
        ['id' => 'c-1', 'label' => 'Duplicate', 'kind' => 'custom'],
        ['id' => '', 'label' => 'No id', 'kind' => 'custom'],
        ['id' => 'c-2', 'label' => 'Two', 'kind' => 'custom'],
        ['id' => 'c-3', 'label' => 'Three', 'kind' => 'custom'],
        ['id' => 'c-4', 'label' => 'Four', 'kind' => 'custom'],
        ['id' => 'c-5', 'label' => 'Past the cap', 'kind' => 'custom'],
    ]);

    expect($canonical)->toBe([
        ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
        ['id' => 'c-1', 'label' => 'Maps', 'kind' => 'custom'],
        ['id' => 'c-2', 'label' => 'Two', 'kind' => 'custom'],
        ['id' => 'c-3', 'label' => 'Three', 'kind' => 'custom'],
        ['id' => 'c-4', 'label' => 'Four', 'kind' => 'custom'],
    ]);
});

it('falls back to "Act I" alone when the blob carries no base tab', function () {
    expect(PlanTabs::canonical([['id' => 'c-1', 'label' => 'Only custom', 'kind' => 'custom']]))
        ->toBe([
            ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
            ['id' => 'c-1', 'label' => 'Only custom', 'kind' => 'custom'],
        ]);
});
