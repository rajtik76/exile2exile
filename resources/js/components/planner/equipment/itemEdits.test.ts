import { expect, test } from 'vitest';
import type { ModMap } from '@/lib/modLines';
import type { PlanReference } from '@/lib/planReferences';
import { MAX_ITEM_QUALITY } from '@/types/planner';
import type { ItemPlan } from '@/types/planner';
import {
    clampedProp,
    countModTypes,
    fullTypesInUse,
    groupsInUse,
    normalizeItem,
    visiblePropFields,
    withBasePicked,
    withUniqueModValues,
} from './itemEdits';

const MODS = {
    LifePrefix: { type: 'prefix', group: 'Life' },
    ArmourPrefix: { type: 'prefix', group: 'Armour' },
    FireSuffix: { type: 'suffix', group: 'FireResist' },
    ColdSuffix: { type: 'suffix', group: 'ColdResist' },
} as unknown as ModMap;

function item(overrides: Partial<ItemPlan> = {}): ItemPlan {
    return {
        rarity: 'rare',
        base: { type: 'base', id: 'Gilded Circlet' },
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

function reference(overrides: Partial<PlanReference> = {}): PlanReference {
    return {
        type: 'base',
        id: 'Gilded Circlet',
        name: 'Gilded Circlet',
        icon: null,
        ...overrides,
    } as PlanReference;
}

test('normalizeItem groups prefixes first (stable) and re-derives the rarity', function () {
    const normalized = normalizeItem(
        item({
            stats: [
                { modId: 'FireSuffix', values: [10] },
                { modId: 'LifePrefix', values: [20] },
                { modId: 'ColdSuffix', values: [15] },
            ],
        }),
        MODS,
    );

    expect(normalized.stats.map((stat) => stat.modId)).toEqual([
        'LifePrefix',
        'FireSuffix',
        'ColdSuffix',
    ]);
    // One prefix + two suffixes is past the magic cap.
    expect(normalized.rarity).toBe('rare');

    const light = normalizeItem(
        item({ stats: [{ modId: 'LifePrefix', values: [20] }] }),
        MODS,
    );

    expect(light.rarity).toBe('magic');
    expect(normalizeItem(item({ stats: [] }), MODS).rarity).toBe('normal');
});

test('normalizeItem sorts a still-unresolved mod after the known affixes', function () {
    const normalized = normalizeItem(
        item({
            stats: [
                { modId: 'Unresolved', values: [] },
                { modId: 'FireSuffix', values: [10] },
                { modId: 'LifePrefix', values: [20] },
            ],
        }),
        MODS,
    );

    expect(normalized.stats.map((stat) => stat.modId)).toEqual([
        'LifePrefix',
        'FireSuffix',
        'Unresolved',
    ]);
});

test('picking a unique drops author mods and stale rolled values', function () {
    const next = withBasePicked(
        item({
            stats: [{ modId: 'LifePrefix', values: [20] }],
            uniqueMods: [{ key: 'old-line', values: [80] }],
        }),
        reference({ type: 'unique', id: 'Thornguard' }),
    );

    expect(next.base).toEqual({ type: 'unique', id: 'Thornguard' });
    expect(next.stats).toEqual([]);
    expect(next.uniqueMods).toEqual([]);
});

test("picking a base clears defence values the new base doesn't have", function () {
    const before = item({
        props: {
            quality: 20,
            armour: 500,
            evasion: 300,
            energyShield: 100,
            block: 25,
        },
    });

    const next = withBasePicked(
        before,
        reference({
            armour: {
                armour: 0,
                evasion: 366,
                energyShield: 0,
                ward: 0,
                block: 0,
            },
        }),
    );

    // A pure-evasion base: armour/ES/block cleared, evasion and quality kept.
    expect(next.props).toEqual({
        quality: 20,
        armour: 0,
        evasion: 300,
        energyShield: 0,
        block: 0,
    });

    // An unresolved pick (no armour data) leaves every value as-is.
    expect(withBasePicked(before, reference()).props).toEqual(before.props);

    // A triple-hybrid base (all defences nonzero) keeps every typed value.
    expect(
        withBasePicked(
            before,
            reference({
                armour: {
                    armour: 100,
                    evasion: 100,
                    energyShield: 100,
                    ward: 0,
                    block: 20,
                },
            }),
        ).props,
    ).toEqual(before.props);
});

test('setting a unique-mod value replaces its prior roll only', function () {
    const next = withUniqueModValues(
        item({
            uniqueMods: [
                { key: 'life', values: [80] },
                { key: 'mana', values: [40] },
            ],
        }),
        'life',
        [95],
    );

    expect(next.uniqueMods).toEqual([
        { key: 'mana', values: [40] },
        { key: 'life', values: [95] },
    ]);
});

test('clamps quality to its cap and floors every property at zero', function () {
    expect(clampedProp('quality', MAX_ITEM_QUALITY + 50)).toBe(
        MAX_ITEM_QUALITY,
    );
    expect(clampedProp('quality', -5)).toBe(0);
    expect(clampedProp('armour', -10)).toBe(0);
    expect(clampedProp('armour', 5000)).toBe(5000);
});

test('lists the affix groups in use, skipping the row being changed', function () {
    const stats = [
        { modId: 'LifePrefix', values: [] },
        { modId: 'FireSuffix', values: [] },
        { modId: 'Unresolved', values: [] },
    ];

    expect(groupsInUse(stats, MODS)).toEqual(['Life', 'FireResist']);
    expect(groupsInUse(stats, MODS, 0)).toEqual(['FireResist']);
});

test('reports the generation types at their cap, freeing the row being swapped', function () {
    const stats = [
        { modId: 'LifePrefix', values: [] },
        { modId: 'FireSuffix', values: [] },
        { modId: 'ColdSuffix', values: [] },
    ];

    expect(countModTypes(stats, MODS)).toEqual({ prefix: 1, suffix: 2 });
    // Magic caps (1 + 1): both types full.
    expect(fullTypesInUse(stats, MODS, 1)).toEqual(['prefix', 'suffix']);
    // Swapping the lone prefix frees its type (the two suffixes stay full).
    expect(fullTypesInUse(stats, MODS, 1, 0)).toEqual(['suffix']);
    // Rare caps (3 + 3): nothing full.
    expect(fullTypesInUse(stats, MODS, 3)).toEqual([]);
});

test('gates the defence fields by the resolved base and falls back to the shield heuristic', function () {
    // A pure-evasion base shows only Quality + Evasion.
    const evasionBase = visiblePropFields(
        reference({
            armour: {
                armour: 0,
                evasion: 366,
                energyShield: 0,
                ward: 0,
                block: 0,
            },
        }),
    );

    expect(evasionBase.map((field) => field.key)).toEqual([
        'quality',
        'evasion',
    ]);

    // No armour data: every defence shows; block only for shield-like categories.
    expect(
        visiblePropFields(reference({ category: 'Shield' })).map(
            (field) => field.key,
        ),
    ).toEqual(['quality', 'armour', 'evasion', 'energyShield', 'block']);
    expect(
        visiblePropFields(reference({ category: 'Helmet' })).map(
            (field) => field.key,
        ),
    ).toEqual(['quality', 'armour', 'evasion', 'energyShield']);
    expect(visiblePropFields(undefined).map((field) => field.key)).toEqual([
        'quality',
        'armour',
        'evasion',
        'energyShield',
    ]);
});
