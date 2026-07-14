import { expect, test } from 'vitest';
import { toDisplayItem } from '@/components/planner/equipment/displayItem';
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
        tooltip: null,
        ...overrides,
    };
}

test('a unique item reads its mods from the resolved reference tooltip, not the stat picker', () => {
    const plan = item({
        base: { type: 'unique', id: 'Constricting Command' },
        stats: [],
    });
    const map: ReferenceMap = {
        [refKey('unique', 'Constricting Command')]: uniqueRef({
            tooltip:
                '+(80-120) to maximum Life\n+(10-15) to all Attributes\n(8-12) Life Regeneration per second',
        }),
    };

    const display = toDisplayItem(slot, plan, map, emptyModMap);

    expect(display.explicitMods).toEqual([
        '+(80-120) to maximum Life',
        '+(10-15) to all Attributes',
        '(8-12) Life Regeneration per second',
    ]);
    expect(display.modDetails).toEqual([]);
});

test('a unique whose sync has no mods yet still renders, just without them', () => {
    const plan = item({ base: { type: 'unique', id: 'Constricting Command' } });
    const map: ReferenceMap = {
        [refKey('unique', 'Constricting Command')]: uniqueRef({
            tooltip: null,
        }),
    };

    const display = toDisplayItem(slot, plan, map, emptyModMap);

    expect(display.explicitMods).toEqual([]);
    expect(display.name).toBe('Constricting Command');
});

test('a unique carries its synced implicit lines as implicitMods', () => {
    const plan = item({ base: { type: 'unique', id: 'The Anvil' } });
    const map: ReferenceMap = {
        [refKey('unique', 'The Anvil')]: uniqueRef({
            id: 'The Anvil',
            name: 'The Anvil',
            implicits: ['+(30-40) to maximum Life'],
            tooltip: '10% reduced Movement Speed',
        }),
    };

    const display = toDisplayItem(slot, plan, map, emptyModMap);

    expect(display.implicitMods).toEqual(['+(30-40) to maximum Life']);
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
            type: 'gem' as PlanReference['type'],
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
