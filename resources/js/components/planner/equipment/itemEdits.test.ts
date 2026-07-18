import { expect, test } from 'vitest';
import type { PlanReference } from '@/lib/planReferences';
import { MAX_ITEM_QUALITY } from '@/types/planner';
import type { ItemMod, ItemPlan } from '@/types/planner';
import {
    clampedProp,
    countModTypes,
    familiesInUse,
    fullTypesInUse,
    normalizeItem,
    visiblePropFields,
    withBasePicked,
    withUniqueModValues,
} from './itemEdits';

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

/** A matched stat with a given id, type and mutual-exclusion family. */
function stat(
    id: string,
    type: 'prefix' | 'suffix' | null,
    family: string | null = id,
): ItemMod {
    return {
        modId: type ? id : null,
        text: id,
        name: null,
        type,
        family: type ? family : null,
        tier: null,
        rolls: null,
        values: [],
    };
}

test('normalizeItem groups prefixes first (stable) and re-derives the rarity', function () {
    const normalized = normalizeItem(
        item({
            stats: [
                stat('FireSuffix', 'suffix', 'FireResist'),
                stat('LifePrefix', 'prefix', 'Life'),
                stat('ColdSuffix', 'suffix', 'ColdResist'),
            ],
        }),
    );

    expect(normalized.stats.map((s) => s.modId)).toEqual([
        'LifePrefix',
        'FireSuffix',
        'ColdSuffix',
    ]);
    // One prefix + two suffixes is past the magic cap.
    expect(normalized.rarity).toBe('rare');

    const light = normalizeItem(
        item({ stats: [stat('LifePrefix', 'prefix', 'Life')] }),
    );

    expect(light.rarity).toBe('magic');
    expect(normalizeItem(item({ stats: [] })).rarity).toBe('normal');
});

test('normalizeItem sorts a still-unmatched mod after the known affixes', function () {
    const normalized = normalizeItem(
        item({
            stats: [
                stat('Unresolved', null),
                stat('FireSuffix', 'suffix', 'FireResist'),
                stat('LifePrefix', 'prefix', 'Life'),
            ],
        }),
    );

    expect(normalized.stats.map((s) => s.modId)).toEqual([
        'LifePrefix',
        'FireSuffix',
        null,
    ]);
});

test('picking a unique drops author mods and stale rolled values', function () {
    const next = withBasePicked(
        item({
            stats: [stat('LifePrefix', 'prefix', 'Life')],
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

test('lists the mutual-exclusion families in use, skipping the row being changed', function () {
    const stats = [
        stat('LifePrefix', 'prefix', 'Life'),
        stat('FireSuffix', 'suffix', 'FireResist'),
        stat('Unresolved', null),
    ];

    expect(familiesInUse(stats)).toEqual(['Life', 'FireResist']);
    expect(familiesInUse(stats, 0)).toEqual(['FireResist']);
});

test('reports the generation types at their cap, freeing the row being swapped', function () {
    const stats = [
        stat('LifePrefix', 'prefix', 'Life'),
        stat('FireSuffix', 'suffix', 'FireResist'),
        stat('ColdSuffix', 'suffix', 'ColdResist'),
    ];

    expect(countModTypes(stats)).toEqual({ prefix: 1, suffix: 2 });
    // Magic caps (1 + 1): both types full.
    expect(fullTypesInUse(stats, 1)).toEqual(['prefix', 'suffix']);
    // Swapping the lone prefix frees its type (the two suffixes stay full).
    expect(fullTypesInUse(stats, 1, 0)).toEqual(['suffix']);
    // Rare caps (3 + 3): nothing full.
    expect(fullTypesInUse(stats, 3)).toEqual([]);
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
