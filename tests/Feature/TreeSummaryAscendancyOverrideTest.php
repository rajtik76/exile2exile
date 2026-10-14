<?php

declare(strict_types=1);

use App\Tree\TreeSnapshot;
use App\Tree\TreeSummaryBuilder;

/**
 * An ascendancy can play on another's nodes and show some of them as other passives
 * (the Abyssal Lich on the Lich's disc). The summary must name the notables the
 * build's own ascendancy shows, exactly as the tree renderer does.
 */
beforeEach(function () {
    fakeGameData([
        'public/tree/current/data.json' => [
            'nodes' => [
                '2516' => ['name' => 'Price of Power', 'isNotable' => true, 'ascendancyId' => 'Witch3'],
                '11705' => ['name' => 'Steward of Kulemak'],
            ],
            'classes' => [
                [
                    'name' => 'Witch',
                    'ascendancies' => [
                        ['id' => 'Witch3', 'name' => 'Lich'],
                        ['id' => 'Witch3b', 'name' => 'Abyssal Lich', 'replaces' => 'Witch3', 'overridePairs' => ['2516' => 11705]],
                    ],
                ],
            ],
        ],
    ]);
});

/** A Witch build with the Lich's Price of Power allocated, under the given ascendancy. */
function lichSnapshot(string $ascendId): TreeSnapshot
{
    return TreeSnapshot::fromArray([
        'className' => 'Witch',
        'ascendId' => $ascendId,
        'allocated' => [2516],
        'attributeChoices' => [],
        'jewels' => [],
        'treeVersion' => '0_5',
    ]);
}

test('a notable shows under the name the build ascendancy gives it', function (string $ascendId, string $ascendancy, string $notable) {
    $summary = app(TreeSummaryBuilder::class)->build(lichSnapshot($ascendId));

    expect($summary->ascendancy)->toBe($ascendancy)
        ->and(collect($summary->notables)->pluck('name')->all())->toBe([$notable]);
})->with([
    'the Abyssal Lich, by tree id' => ['Witch3b', 'Abyssal Lich', 'Steward of Kulemak'],
    'the Abyssal Lich, by name' => ['Abyssal Lich', 'Abyssal Lich', 'Steward of Kulemak'],
    'the Lich itself' => ['Witch3', 'Lich', 'Price of Power'],
]);
