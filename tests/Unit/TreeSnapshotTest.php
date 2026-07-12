<?php

use App\Tree\TreeAllocation;
use App\Tree\TreeSnapshot;

test('fromArray coerces an untrusted blob into a clean snapshot', function () {
    $snapshot = TreeSnapshot::fromArray([
        'className' => 'Witch',
        'ascendId' => 'Witch1',
        'allocated' => ['4', 16, '30'],
        'attributeChoices' => ['4' => 'int', '16' => 'bogus'],
        'weaponSets' => ['16' => '1', '30' => 9],
        'jewels' => [55 => ['name' => 'Against the Darkness']],
        'treeVersion' => '0_5',
    ]);

    expect($snapshot->className)->toBe('Witch')
        ->and($snapshot->ascendId)->toBe('Witch1')
        ->and($snapshot->allocation->allocated)->toBe([4, 16, 30])
        // A choice outside str/dex/int and a set outside 1/2 are dropped.
        ->and($snapshot->allocation->attributeChoices)->toBe([4 => 'int'])
        ->and($snapshot->allocation->weaponSets)->toBe([16 => 1])
        ->and($snapshot->allocation->jewels)->toBe([55 => ['name' => 'Against the Darkness']])
        ->and($snapshot->allocation->treeVersion)->toBe('0_5');
});

test('a legacy row missing newer keys hydrates cleanly', function () {
    $snapshot = TreeSnapshot::fromArray([
        'className' => 'Monk',
        'ascendId' => null,
        'allocated' => [4],
    ]);

    expect($snapshot->ascendId)->toBeNull()
        ->and($snapshot->allocation->attributeChoices)->toBe([])
        ->and($snapshot->allocation->weaponSets)->toBe([])
        ->and($snapshot->allocation->jewels)->toBe([])
        ->and($snapshot->allocation->treeVersion)->toBeNull();
});

test('toArray round-trips through fromArray unchanged', function () {
    $data = [
        'className' => 'Witch',
        'ascendId' => 'Witch1',
        'allocated' => [4, 16, 30],
        'attributeChoices' => [4 => 'int'],
        'weaponSets' => [16 => 1],
        'jewels' => [],
        'treeVersion' => '0_5',
    ];

    expect(TreeSnapshot::fromArray($data)->toArray())->toBe($data);
});

test('the allocated list is capped at MAX_NODES', function () {
    $snapshot = TreeSnapshot::fromArray([
        'className' => 'Witch',
        'allocated' => range(1, TreeAllocation::MAX_NODES + 50),
    ]);

    expect($snapshot->allocation->allocated)->toHaveCount(TreeAllocation::MAX_NODES);
});

test('the JSON form encodes empty node-id maps as objects, not arrays', function () {
    $snapshot = TreeSnapshot::fromArray(['className' => 'Monk', 'allocated' => [4]]);

    $json = json_encode($snapshot);

    // The renderer looks these up by node id, so an empty map must be `{}`.
    expect($json)->toContain('"attributeChoices":{}')
        ->toContain('"weaponSets":{}')
        ->toContain('"jewels":{}')
        ->toContain('"allocated":[4]');
});
