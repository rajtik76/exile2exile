import { expect, test } from 'vitest';
import { itemErrors } from '@/lib/itemRules';
import type { ModInfo, ModMap } from '@/lib/modLines';
import { MAX_ITEM_NAME_LENGTH } from '@/types/planner';
import type { ItemPlan } from '@/types/planner';

function item(overrides: Partial<ItemPlan> = {}): ItemPlan {
    return {
        rarity: 'rare',
        base: null,
        name: '',
        corrupted: false,
        itemLevel: null,
        props: { quality: 0, armour: 0, evasion: 0, energyShield: 0, block: 0 },
        stats: [],
        uniqueMods: [],
        sockets: [],
        priority: null,
        ...overrides,
    };
}

/** A resolved mod, defaulting to a single-range life prefix. */
function mod(overrides: Partial<ModInfo> = {}): ModInfo {
    return {
        id: 'IncreasedLife1',
        name: '',
        group: 'IncreasedLife',
        type: 'prefix',
        tier: 1,
        level: 1,
        stats: ['+(10-19) to maximum Life'],
        rolls: [{ stat: 'base_maximum_life', min: 10, max: 19 }],
        families: ['IncreasedLife'],
        ...overrides,
    };
}

/** A mod map built from the given mods, keyed by id. */
function modMap(...mods: ModInfo[]): ModMap {
    return Object.fromEntries(mods.map((entry) => [entry.id, entry]));
}

const fireResist = mod({
    id: 'FireResist1',
    type: 'suffix',
    group: 'FireResistance',
    stats: ['+(6-10)% to Fire Resistance'],
    rolls: [{ stat: 'base_maximum_mana', min: 6, max: 10 }],
    families: ['FireResistance'],
});

test('a legal item has no errors', () => {
    expect(
        itemErrors(
            'body',
            item({
                stats: [{ modId: 'FireResist1', values: [8] }],
                sockets: [{ type: 'rune', id: 'RuneA' }],
            }),
            modMap(fireResist),
        ),
    ).toEqual([]);
});

test('a rare flask or charm is an error, a rare gear item is not', () => {
    const rare = item({ rarity: 'rare' });

    expect(itemErrors('flask1', rare, {})).toContain(
        'A flask or charm cannot be rare.',
    );
    expect(itemErrors('charm2', rare, {})).toContain(
        'A flask or charm cannot be rare.',
    );
    expect(itemErrors('body', rare, {})).not.toContain(
        'A flask or charm cannot be rare.',
    );
});

test('an item name above the max length is an error', () => {
    const over = item({
        name: 'x'.repeat(MAX_ITEM_NAME_LENGTH + 1),
    });

    expect(itemErrors('body', over, {})).toContain(
        `Item name cannot exceed ${MAX_ITEM_NAME_LENGTH} characters.`,
    );
    expect(
        itemErrors(
            'body',
            item({ name: 'x'.repeat(MAX_ITEM_NAME_LENGTH) }),
            {},
        ),
    ).toEqual([]);
});

test('a value outside its tier range is an error', () => {
    const errors = itemErrors(
        'body',
        item({ stats: [{ modId: 'FireResist1', values: [99] }] }),
        modMap(fireResist),
    );

    expect(errors).toContain("A modifier's value is outside its tier's range.");
});

test('a normal item with any modifier is an error', () => {
    const errors = itemErrors(
        'body',
        item({
            rarity: 'normal',
            stats: [{ modId: 'FireResist1', values: [8] }],
        }),
        modMap(fireResist),
    );

    expect(errors).toContain('A normal item cannot carry modifiers.');
});

test('a magic item carries at most one prefix', () => {
    const errors = itemErrors(
        'body',
        item({
            rarity: 'magic',
            stats: [
                { modId: 'IncreasedLife1', values: [15] },
                { modId: 'IncreasedLife2', values: [25] },
            ],
        }),
        modMap(
            mod(),
            mod({
                id: 'IncreasedLife2',
                rolls: [{ stat: 'base_maximum_life', min: 20, max: 29 }],
            }),
        ),
    );

    expect(errors).toContain('Magic items carry at most 1 prefix modifier.');
});

test('two modifiers from the same family are an error', () => {
    const errors = itemErrors(
        'body',
        item({
            stats: [
                { modId: 'IncreasedLife1', values: [15] },
                { modId: 'IncreasedLife2', values: [25] },
            ],
        }),
        modMap(
            mod(),
            mod({
                id: 'IncreasedLife2',
                rolls: [{ stat: 'base_maximum_life', min: 20, max: 29 }],
            }),
        ),
    );

    expect(errors).toContain('Two modifiers share a mutual-exclusion group.');
});

test('more sockets than the slot allows is an error', () => {
    const sockets = [
        { type: 'rune' as const, id: 'A' },
        { type: 'rune' as const, id: 'B' },
        { type: 'rune' as const, id: 'C' },
        { type: 'rune' as const, id: 'D' },
    ];

    // Three fit a helmet (two natural plus one from a Vaal corruption), four do not.
    expect(
        itemErrors('helmet', item({ sockets: sockets.slice(0, 3) }), {}),
    ).toEqual([]);
    expect(itemErrors('helmet', item({ sockets }), {})).toContain(
        'This slot holds at most 3 rune sockets.',
    );

    // A unique takes the global ceiling (Greymake wears four on a helmet).
    expect(
        itemErrors(
            'helmet',
            item({
                rarity: 'unique',
                base: { type: 'unique', id: 'Greymake' },
                sockets,
            }),
            {},
        ),
    ).toEqual([]);
});

test('any socket on jewellery or a belt is an error', () => {
    const withSocket = item({ sockets: [{ type: 'rune', id: 'A' }] });

    for (const slot of ['amulet', 'ring1', 'ring2', 'belt']) {
        expect(itemErrors(slot, withSocket, {})).toContain(
            'This slot cannot hold rune sockets.',
        );
    }
});

test('a unique with author modifiers is an error, but its properties are allowed', () => {
    const withMod = itemErrors(
        'body',
        item({
            rarity: 'unique',
            stats: [{ modId: 'IncreasedLife1', values: [100] }],
        }),
        modMap(mod()),
    );
    // A unique's defences are the only way to record them, so they're legal.
    const withProps = itemErrors(
        'body',
        item({
            rarity: 'unique',
            name: 'Constricting Command',
            props: {
                quality: 20,
                armour: 500,
                evasion: 0,
                energyShield: 0,
                block: 0,
            },
        }),
        {},
    );

    expect(withMod).toContain(
        'A unique item carries its own modifiers and cannot add more.',
    );
    expect(withProps).toEqual([]);
});

test('quality above the ceiling is an error, 73% is legal', () => {
    const overCap = itemErrors(
        'body',
        item({
            props: {
                quality: 101,
                armour: 0,
                evasion: 0,
                energyShield: 0,
                block: 0,
            },
        }),
        {},
    );

    // "+X% to Maximum Quality" mods and implicits stack well past the ordinary 20%
    // (a corrupted Refined Breach Ring shows +73%), so the ceiling is generous.
    expect(overCap).toContain('Quality cannot exceed 100%.');
    expect(
        itemErrors(
            'body',
            item({
                props: {
                    quality: 73,
                    armour: 0,
                    evasion: 0,
                    energyShield: 0,
                    block: 0,
                },
            }),
            {},
        ),
    ).toEqual([]);
});

test('all three defence types at once are legal (triple-hybrid bases exist)', () => {
    const errors = itemErrors(
        'body',
        item({
            props: {
                quality: 0,
                armour: 100,
                evasion: 100,
                energyShield: 100,
                block: 0,
            },
        }),
        {},
    );

    expect(errors).toEqual([]);
});

test('a hybrid item with two defence types is legal', () => {
    const errors = itemErrors(
        'body',
        item({
            props: {
                quality: 20,
                armour: 100,
                evasion: 100,
                energyShield: 0,
                block: 0,
            },
        }),
        {},
    );

    expect(errors).toEqual([]);
});

test('a clean unique is legal', () => {
    expect(
        itemErrors(
            'body',
            item({
                rarity: 'unique',
                base: { type: 'unique', id: 'Bramblejack' },
            }),
            {},
        ),
    ).toEqual([]);
});
