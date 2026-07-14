import { expect, test } from 'vitest';
import {
    referenceToDisplayItem,
    toDisplayItem,
} from '@/components/planner/equipment/displayItem';
import type { ModMap } from '@/lib/modLines';
import { refKey } from '@/lib/planReferences';
import type { PlanReference, ReferenceMap } from '@/lib/planReferences';
import { EQUIPMENT_SLOTS } from '@/types/planner';
import type { ItemPlan } from '@/types/planner';

const slot = EQUIPMENT_SLOTS.find((s) => s.key === 'body')!;
const emptyModMap: ModMap = {};

function item(overrides: Partial<ItemPlan> = {}): ItemPlan {
    return {
        rarity: 'unique',
        base: null,
        name: '',
        corrupted: false,
        props: { quality: 0, armour: 0, evasion: 0, energyShield: 0, block: 0 },
        stats: [],
        uniqueMods: [],
        sockets: [],
        priority: null,
        ...overrides,
    };
}

function uniqueRef(overrides: Partial<PlanReference> = {}): PlanReference {
    return {
        type: 'unique',
        id: 'Constricting Command',
        name: 'Constricting Command',
        implicits: [],
        implicitLines: [],
        modLines: [],
        tooltip: null,
        ...overrides,
    };
}

test('referenceToDisplayItem adapts a bare unique reference to the same Item shape an equipped one gets', () => {
    const reference = uniqueRef({
        icon: '/icons/poe2/uniques/constricting-command.png',
        baseType: 'Viper Cap',
        flavour: 'A serpent coils tighter the more it is provoked.',
        implicitLines: [],
        modLines: [
            {
                key: '+# to maximum Life',
                template: '+(80-120) to maximum Life',
                rolls: [{ min: 80, max: 120 }],
            },
        ],
    });

    const display = referenceToDisplayItem(reference);

    expect(display.rarity).toBe('unique');
    expect(display.name).toBe('Constricting Command');
    expect(display.baseType).toBe('Viper Cap');
    expect(display.icon).toBe('/icons/poe2/uniques/constricting-command.png');
    expect(display.flavour).toBe(
        'A serpent coils tighter the more it is provoked.',
    );
    // No ItemPlan context (no props/sockets/corrupted) - and no rolled value to
    // substitute, so a ranged mod line falls back to its range placeholder, same as
    // an equipped-but-unsynced unique would.
    expect(display.explicitMods).toEqual(['+(80-120) to maximum Life']);
    expect(display.runes).toEqual([]);
    expect(display.corrupted).toBeUndefined();
});

test('referenceToDisplayItem falls back to the unique name when no base type is synced', () => {
    const display = referenceToDisplayItem(uniqueRef({ baseType: null }));

    expect(display.baseType).toBe('Constricting Command');
});

test('a unique item shows its synced base type, distinct from its own name', () => {
    const plan = item({ base: { type: 'unique', id: 'Constricting Command' } });
    const map: ReferenceMap = {
        [refKey('unique', 'Constricting Command')]: uniqueRef({
            baseType: 'Viper Cap',
        }),
    };

    const display = toDisplayItem(slot, plan, map, emptyModMap);

    expect(display.name).toBe('Constricting Command');
    expect(display.baseType).toBe('Viper Cap');
});

test('a unique with no synced base type falls back to its own name (no false subtitle)', () => {
    const plan = item({ base: { type: 'unique', id: 'Constricting Command' } });
    const map: ReferenceMap = {
        [refKey('unique', 'Constricting Command')]: uniqueRef({
            baseType: null,
        }),
    };

    const display = toDisplayItem(slot, plan, map, emptyModMap);

    expect(display.baseType).toBe('Constricting Command');
});

test('a unique item with no stored value shows its synced mod lines as ranges', () => {
    const plan = item({
        base: { type: 'unique', id: 'Constricting Command' },
        stats: [],
    });
    const map: ReferenceMap = {
        [refKey('unique', 'Constricting Command')]: uniqueRef({
            modLines: [
                {
                    key: '+# to maximum Life',
                    template: '+(80-120) to maximum Life',
                    rolls: [{ min: 80, max: 120 }],
                },
                {
                    key: '# Life Regeneration per second',
                    template: '(8-12) Life Regeneration per second',
                    rolls: [{ min: 8, max: 12 }],
                },
            ],
        }),
    };

    const display = toDisplayItem(slot, plan, map, emptyModMap);

    expect(display.explicitMods).toEqual([
        '+(80-120) to maximum Life',
        '(8-12) Life Regeneration per second',
    ]);
    expect(display.modDetails).toEqual([]);
});

test('a unique item substitutes its stored rolled value into the matching mod line', () => {
    const plan = item({
        base: { type: 'unique', id: 'Constricting Command' },
        uniqueMods: [
            { key: '+# to maximum Life', values: [110] },
            { key: '# Life Regeneration per second', values: [11.9] },
        ],
    });
    const map: ReferenceMap = {
        [refKey('unique', 'Constricting Command')]: uniqueRef({
            modLines: [
                {
                    key: '+# to maximum Life',
                    template: '+(80-120) to maximum Life',
                    rolls: [{ min: 80, max: 120 }],
                },
                {
                    key: '# Life Regeneration per second',
                    template: '(8-12) Life Regeneration per second',
                    rolls: [{ min: 8, max: 12 }],
                },
            ],
        }),
    };

    const display = toDisplayItem(slot, plan, map, emptyModMap);

    expect(display.explicitMods).toEqual([
        '+110 to maximum Life',
        '11.9 Life Regeneration per second',
    ]);
});

test('a unique whose sync has no mods yet still renders, just without them', () => {
    const plan = item({ base: { type: 'unique', id: 'Constricting Command' } });
    const map: ReferenceMap = {
        [refKey('unique', 'Constricting Command')]: uniqueRef(),
    };

    const display = toDisplayItem(slot, plan, map, emptyModMap);

    expect(display.explicitMods).toEqual([]);
    expect(display.name).toBe('Constricting Command');
});

test('a unique carries its synced implicit lines as implicitMods, substituted the same way', () => {
    const plan = item({
        base: { type: 'unique', id: 'The Anvil' },
        uniqueMods: [{ key: '+# to maximum Life', values: [35] }],
    });
    const map: ReferenceMap = {
        [refKey('unique', 'The Anvil')]: uniqueRef({
            id: 'The Anvil',
            name: 'The Anvil',
            implicitLines: [
                {
                    key: '+# to maximum Life',
                    template: '+(30-40) to maximum Life',
                    rolls: [{ min: 30, max: 40 }],
                },
            ],
            modLines: [
                {
                    key: '10% reduced Movement Speed',
                    template: '10% reduced Movement Speed',
                    rolls: [],
                },
            ],
        }),
    };

    const display = toDisplayItem(slot, plan, map, emptyModMap);

    expect(display.implicitMods).toEqual(['+35 to maximum Life']);
    expect(display.explicitMods).toEqual(['10% reduced Movement Speed']);
});

test('a rare item still aggregates its authored stats, unaffected by the unique path', () => {
    const plan = item({
        rarity: 'rare',
        base: { type: 'base', id: 'Viper Cap' },
        stats: [{ modId: 'Life1', values: [15] }],
    });
    const map: ReferenceMap = {
        [refKey('base', 'Viper Cap')]: {
            type: 'base',
            id: 'Viper Cap',
            name: 'Viper Cap',
        },
    };
    const modMap: ModMap = {
        Life1: {
            id: 'Life1',
            name: '',
            group: 'IncreasedLife',
            type: 'prefix',
            tier: 1,
            level: 1,
            stats: ['+(10-19) to maximum Life'],
            rolls: [{ stat: 'base_maximum_life', min: 10, max: 19 }],
            families: ['IncreasedLife'],
        },
    };

    const display = toDisplayItem(slot, plan, map, modMap);

    expect(display.explicitMods).toEqual(['+15 to maximum Life']);
});
