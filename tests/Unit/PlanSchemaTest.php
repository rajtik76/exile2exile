<?php

use App\Support\Planner\PlanSchema;

test('a blank plan opens with only the first phase and its section set', function () {
    $blank = PlanSchema::blank();

    expect($blank['mode'])->toBe('phases')
        ->and($blank['description'])->toBe('')
        ->and($blank['tabs'])->toHaveCount(1)
        ->and(array_column($blank['tabs'], 'id'))->toBe(['act-1'])
        ->and($blank['sections'])->toHaveKey('act-1')
        ->and($blank['sections'])->not->toHaveKey('early-endgame')
        ->and($blank['sections'])->toHaveKey(PlanSchema::SINGLE_KEY);
});

test('canonicalize fills missing keys into the full current shape', function () {
    $data = PlanSchema::canonicalize(['mode' => 'single']);

    expect($data['description'])->toBe('')
        ->and($data['mode'])->toBe('single')
        ->and($data['tabs'])->toHaveCount(1)
        ->and($data['sections']['single'])->toHaveKeys(['items', 'gems', 'tree'])
        ->and($data['sections']['single']['items'])->toBe(['notes' => '', 'entries' => [], 'slots' => []])
        ->and($data['sections']['single']['gems'])->toBe(['notes' => '', 'entries' => [], 'groups' => []]);
});

test('canonicalize keeps valid gem groups and drops empty or malformed ones', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'gems' => [
                    'groups' => [
                        ['id' => 'g1', 'gems' => [
                            ['type' => 'gem', 'id' => 'SkillGemSpark'],
                            ['type' => 'gem', 'id' => 'SupportX'],
                            ['type' => 'rune', 'id' => 'nope'],
                        ]],
                        ['id' => 'g2', 'gems' => []],
                        ['gems' => [['type' => 'gem', 'id' => 'SkillGemIceNova']]],
                    ],
                ],
            ],
        ],
    ]);

    $groups = $data['sections']['act-1']['gems']['groups'];

    expect($groups)->toHaveCount(2)
        ->and($groups[0]['gems'])->toBe([
            ['type' => 'gem', 'id' => 'SkillGemSpark'],
            ['type' => 'gem', 'id' => 'SupportX'],
        ])
        ->and($groups[1]['id'])->toBe('g-3')
        ->and($groups[1]['gems'][0]['id'])->toBe('SkillGemIceNova');
});

test('canonicalize recomputes entry priorities from list order', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'entries' => [
                        ['id' => 'a', 'name' => 'First', 'priority' => 8],
                        ['id' => 'b', 'name' => 'Second', 'priority' => 2],
                    ],
                ],
            ],
        ],
    ]);

    $entries = $data['sections']['act-1']['items']['entries'];

    expect($entries[0]['priority'])->toBe(1)
        ->and($entries[1]['priority'])->toBe(2);
});

test('canonicalize forces base tabs to the front and keeps customs after', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => [
            ['id' => 'c-1', 'label' => 'Maps', 'kind' => 'custom'],
            ...PlanSchema::baseTabs(),
        ],
    ]);

    expect(array_column($data['tabs'], 'id'))
        ->toBe([...PlanSchema::baseTabIds(), 'c-1']);
});

test('canonicalize gives a gem entry a default kind but leaves items without one', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'gems' => ['entries' => [['id' => 'g', 'name' => 'Spark']]],
                'items' => ['entries' => [['id' => 'i', 'name' => 'Wand']]],
            ],
        ],
    ]);

    expect($data['sections']['act-1']['gems']['entries'][0]['kind'])->toBe('active')
        ->and($data['sections']['act-1']['items']['entries'][0])->not->toHaveKey('kind');
});

test('canonicalize drops sections for tabs that no longer exist', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'ghost-tab' => ['items' => ['entries' => [['id' => 'x', 'name' => 'Orphan']]]],
        ],
    ]);

    expect($data['sections'])->not->toHaveKey('ghost-tab');
});

test('normalize brings a legacy-versioned blob up to the current shape', function () {
    $data = PlanSchema::normalize(['mode' => 'phases'], 1);

    expect($data['tabs'])->toHaveCount(1)
        ->and(array_column($data['tabs'], 'id'))->toBe(['act-1'])
        ->and($data['sections'])->toHaveKey('act-1');
});

test('canonicalize keeps the base tabs as a leading prefix and drops gaps', function () {
    // Act I + Act III present but Act II missing → the prefix stops at Act I, so the
    // gap can't resurrect a skipped phase; a trailing custom still lands after it.
    $data = PlanSchema::canonicalize([
        'tabs' => [
            ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
            ['id' => 'act-3', 'label' => 'Act III', 'kind' => 'base'],
            ['id' => 'c-1', 'label' => 'Maps', 'kind' => 'custom'],
        ],
    ]);

    expect(array_column($data['tabs'], 'id'))->toBe(['act-1', 'c-1']);
});

test('canonicalize keeps a longer base prefix intact', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => [
            ['id' => 'act-1', 'label' => 'Act I', 'kind' => 'base'],
            ['id' => 'act-2', 'label' => 'Act II', 'kind' => 'base'],
            ['id' => 'act-3', 'label' => 'Act III', 'kind' => 'base'],
        ],
    ]);

    expect(array_column($data['tabs'], 'id'))->toBe(['act-1', 'act-2', 'act-3']);
});

test('a blank plan carries an empty build and a per-phase tree allocation', function () {
    $blank = PlanSchema::blank();

    expect($blank['build'])->toBe(['className' => null, 'ascendId' => null])
        ->and($blank['sections']['act-1']['tree']['allocation']['allocated'])->toBe([])
        ->and($blank['sections']['act-1']['items'])->not->toHaveKey('allocation');
});

test('canonicalize coerces a tree allocation and the build', function () {
    $data = PlanSchema::canonicalize([
        'build' => ['className' => 'Witch', 'ascendId' => 'Witch1'],
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'tree' => [
                    'allocation' => [
                        'allocated' => ['4', 16, 30],
                        'attributeChoices' => [4 => 'int', 5 => 'nonsense'],
                        'weaponSets' => [16 => 1, 30 => 9],
                        'treeVersion' => '0_5',
                    ],
                ],
            ],
        ],
    ]);

    $allocation = $data['sections']['act-1']['tree']['allocation'];

    expect($data['build'])->toBe(['className' => 'Witch', 'ascendId' => 'Witch1'])
        ->and($allocation['allocated'])->toBe([4, 16, 30])
        ->and($allocation['attributeChoices'])->toBe([4 => 'int'])
        ->and($allocation['weaponSets'])->toBe([16 => 1])
        ->and($allocation['treeVersion'])->toBe('0_5');
});

test('canonicalize coerces the tree notable priority to a unique int list', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'tree' => [
                    'notablePriority' => ['12', 12, 7, 7, 30],
                ],
            ],
        ],
    ]);

    expect($data['sections']['act-1']['tree']['notablePriority'])->toBe([12, 7, 30])
        ->and($data['sections']['act-1']['items'])->not->toHaveKey('notablePriority');
});

test('a blank plan carries an empty tree notable priority', function () {
    expect(PlanSchema::blank()['sections']['act-1']['tree']['notablePriority'])->toBe([]);
});

test('normalize upgrades a v1 blob to carry build, tree allocation and item slots', function () {
    $data = PlanSchema::normalize(['mode' => 'phases'], 1);

    expect($data['build'])->toBe(['className' => null, 'ascendId' => null])
        ->and($data['sections']['act-1']['tree'])->toHaveKey('allocation')
        ->and($data['sections']['act-1']['items'])->toHaveKey('slots')
        ->and($data['sections']['act-1']['items']['slots'])->toBe([]);
});

test('canonicalize coerces equipment items and drops empty or unknown slots', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'slots' => [
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Advanced Plate Vest'],
                            'stats' => [
                                ['modId' => 'IncreasedLife5', 'values' => [100]],
                                ['modId' => '   ', 'values' => []],
                                '+40 Spirit',
                            ],
                        ],
                        'helmet' => ['rarity' => 'unique', 'base' => ['type' => 'unique', 'id' => 'Goldrim'], 'stats' => []],
                        'ghost' => ['rarity' => 'rare', 'base' => ['type' => 'base', 'id' => 'X'], 'stats' => []],
                        'boots' => ['rarity' => 'rare', 'base' => null, 'stats' => []],
                    ],
                ],
            ],
        ],
    ]);

    $slots = $data['sections']['act-1']['items']['slots'];

    expect(array_keys($slots))->toBe(['helmet', 'body'])
        ->and($slots['body'])->toBe([
            'rarity' => 'rare',
            'base' => ['type' => 'base', 'id' => 'Advanced Plate Vest'],
            'name' => '',
            'corrupted' => false,
            'itemLevel' => null,
            'props' => ['quality' => 0, 'armour' => 0, 'evasion' => 0, 'energyShield' => 0, 'block' => 0],
            // The blank-id entry and the bare string are dropped; only a real mod ref stays.
            'stats' => [
                ['modId' => 'IncreasedLife5', 'values' => [100]],
            ],
            'uniqueMods' => [],
            'sockets' => [],
            'priority' => null,
        ]);
});

test('canonicalize keeps mod references and coerces their values', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'slots' => [
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Advanced Plate Vest'],
                            'stats' => [
                                ['modId' => 'IncreasedLife5', 'values' => [100]],
                                ['modId' => 'AddedColdDamage3', 'values' => ['4', '7']],
                                ['values' => [10]],
                                ['modId' => '', 'values' => []],
                                'nope',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);

    // String-numeric values are coerced; entries with no mod id are dropped.
    expect($data['sections']['act-1']['items']['slots']['body']['stats'])->toBe([
        ['modId' => 'IncreasedLife5', 'values' => [100]],
        ['modId' => 'AddedColdDamage3', 'values' => [4, 7]],
    ]);
});

test('canonicalize coerces the item name, defensive properties and rune sockets', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'slots' => [
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Advanced Plate Vest'],
                            'name' => '  Rift Pelt  ',
                            'corrupted' => 'yes',
                            'props' => ['quality' => '20', 'armour' => 400, 'evasion' => -3, 'block' => 25],
                            'stats' => [],
                            'sockets' => [
                                ['type' => 'rune', 'id' => 'Iron Rune'],
                                ['type' => 'gem', 'id' => 'nope'],
                                ['type' => 'rune', 'id' => 'Body Rune'],
                                null,
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);

    $item = $data['sections']['act-1']['items']['slots']['body'];

    // The name is trimmed; any truthy value coerces "corrupted" to a real bool; string
    // values coerce, negatives clamp to 0, and the defensive properties fill in every key.
    expect($item['name'])->toBe('Rift Pelt')
        ->and($item['corrupted'])->toBe(true)
        ->and($item['props'])->toBe([
            'quality' => 20,
            'armour' => 400,
            'evasion' => 0,
            'energyShield' => 0,
            'block' => 25,
        ])
        // A non-rune socket becomes an empty slot; the trailing empty is trimmed.
        ->and($item['sockets'])->toBe([
            ['type' => 'rune', 'id' => 'Iron Rune'],
            null,
            ['type' => 'rune', 'id' => 'Body Rune'],
        ]);
});

test('canonicalize caps an item name at the max length', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'slots' => [
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Advanced Plate Vest'],
                            'name' => str_repeat('x', PlanSchema::MAX_ITEM_NAME_LENGTH + 20),
                        ],
                    ],
                ],
            ],
        ],
    ]);

    $name = $data['sections']['act-1']['items']['slots']['body']['name'];

    expect(mb_strlen((string) $name))->toBe(PlanSchema::MAX_ITEM_NAME_LENGTH);
});

test('normalize v1 to v2 upgrader strips the retired req key from item slots', function () {
    $data = PlanSchema::normalize([
        'mode' => 'phases',
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'slots' => [
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Advanced Plate Vest'],
                            'req' => ['level' => 65],
                        ],
                    ],
                ],
            ],
        ],
    ], 1);

    $item = $data['sections']['act-1']['items']['slots']['body'];

    expect($item)->not->toHaveKey('req')
        ->and($item['name'])->toBe('');
});

test('canonicalize keeps a valid item priority and nulls an out-of-range one', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'slots' => [
                        'helmet' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Iron Helmet'],
                            'priority' => '3',
                        ],
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Plate Vest'],
                            'priority' => 99,
                        ],
                        'boots' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Iron Greaves'],
                            'priority' => 0,
                        ],
                    ],
                ],
            ],
        ],
    ]);

    $slots = $data['sections']['act-1']['items']['slots'];

    // A string-numeric in range is coerced; out-of-range (too high, or below 1) is dropped.
    expect($slots['helmet']['priority'])->toBe(3)
        ->and($slots['body']['priority'])->toBeNull()
        ->and($slots['boots']['priority'])->toBeNull();
});

test('canonicalize nulls a duplicate item priority on the later slot', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'slots' => [
                        'helmet' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Iron Helmet'],
                            'priority' => 1,
                        ],
                        'body' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Plate Vest'],
                            'priority' => 1,
                        ],
                    ],
                ],
            ],
        ],
    ]);

    $slots = $data['sections']['act-1']['items']['slots'];

    // The first slot in EQUIPMENT_SLOTS order keeps the number; the collision is dropped.
    expect($slots['helmet']['priority'])->toBe(1)
        ->and($slots['body']['priority'])->toBeNull();
});

test('flask and charm slots are accepted equipment slots', function () {
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => [
            'act-1' => [
                'items' => [
                    'slots' => [
                        'flask1' => [
                            'rarity' => 'unique',
                            'base' => ['type' => 'unique', 'id' => "Olroth's Resolve"],
                        ],
                        'charm1' => [
                            'rarity' => 'unique',
                            'base' => ['type' => 'unique', 'id' => 'The Black Cat'],
                        ],
                        'nonsense' => [
                            'rarity' => 'rare',
                            'base' => ['type' => 'base', 'id' => 'Whatever'],
                        ],
                    ],
                ],
            ],
        ],
    ]);

    // The two new slots survive canonicalisation; an unknown slot key is dropped.
    expect(array_keys($data['sections']['act-1']['items']['slots']))
        ->toBe(['flask1', 'charm1']);
});

test('a rare flask or charm is rejected but a rare gear item is allowed', function () {
    expect(PlanSchema::itemErrors('flask1', ['rarity' => 'rare']))
        ->toContain('A flask or charm cannot be rare.')
        ->and(PlanSchema::itemErrors('charm2', ['rarity' => 'rare']))
        ->toContain('A flask or charm cannot be rare.')
        ->and(PlanSchema::itemErrors('body', ['rarity' => 'rare']))
        ->not->toContain('A flask or charm cannot be rare.')
        // Magic and normal flasks are fine.
        ->and(PlanSchema::itemErrors('flask1', ['rarity' => 'magic']))
        ->not->toContain('A flask or charm cannot be rare.');
});

test('item quality is clamped to the ceiling and flagged when a raw payload exceeds it', function () {
    // "+X% to Maximum Quality" mods and implicits stack well past the ordinary 20%
    // (a corrupted Refined Breach Ring shows +73%), so the ceiling is generous.
    // Canonicalisation clamps, so a stored item is always legal…
    $data = PlanSchema::canonicalize([
        'tabs' => PlanSchema::baseTabs(),
        'sections' => ['act-1' => ['items' => ['slots' => [
            'body' => ['rarity' => 'rare', 'base' => ['type' => 'base', 'id' => 'X'], 'props' => ['quality' => 150]],
        ]]]],
    ]);

    expect($data['sections']['act-1']['items']['slots']['body']['props']['quality'])->toBe(100)
        // …while itemErrors flags a raw over-cap payload.
        ->and(PlanSchema::itemErrors('body', ['rarity' => 'rare', 'props' => ['quality' => 101]]))
        ->toContain('Quality cannot exceed 100%.')
        ->and(PlanSchema::itemErrors('body', ['rarity' => 'rare', 'props' => ['quality' => 73]]))
        ->toBe([]);
});

test('all three defence types at once are legal (triple-hybrid bases exist)', function () {
    expect(PlanSchema::itemErrors('body', ['rarity' => 'rare', 'props' => ['armour' => 100, 'evasion' => 100, 'energyShield' => 100]]))
        ->toBe([]);
});

test('tabsError passes the base tabs and rejects a reorder', function () {
    $reordered = PlanSchema::baseTabs();
    [$reordered[0], $reordered[1]] = [$reordered[1], $reordered[0]];

    expect(PlanSchema::tabsError(PlanSchema::baseTabs()))->toBeNull()
        ->and(PlanSchema::tabsError($reordered))->not->toBeNull();
});

test('tabsError rejects a custom tab slipped between the base tabs', function () {
    $tabs = PlanSchema::baseTabs();
    array_splice($tabs, 3, 0, [['id' => 'c', 'label' => 'Sneaky', 'kind' => 'custom']]);

    expect(PlanSchema::tabsError($tabs))->not->toBeNull();
});

test('tabsError accepts custom tabs appended after the base tabs', function () {
    $tabs = [...PlanSchema::baseTabs(), ['id' => 'c-1', 'label' => 'Mapping', 'kind' => 'custom']];

    expect(PlanSchema::tabsError($tabs))->toBeNull();
});
