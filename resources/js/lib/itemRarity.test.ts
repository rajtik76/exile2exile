import { expect, test } from 'vitest';
import { deriveRarity } from '@/lib/itemRarity';
import type { ModInfo, ModMap } from '@/lib/modLines';
import type { ItemStat } from '@/types/planner';

function mod(id: string, type: 'prefix' | 'suffix'): ModInfo {
    return {
        id,
        name: '',
        group: id,
        type,
        tier: null,
        level: 1,
        stats: [],
        rolls: [],
        families: [],
    };
}

const map: ModMap = {
    p1: mod('p1', 'prefix'),
    p2: mod('p2', 'prefix'),
    s1: mod('s1', 'suffix'),
    s2: mod('s2', 'suffix'),
};

const stat = (id: string): ItemStat => ({ modId: id, values: [] });
const base = (type: 'base' | 'unique') => ({ type, id: 'X' });

test('a unique base is Unique regardless of its stats', () => {
    expect(deriveRarity(base('unique'), [stat('p1'), stat('s1')], map)).toBe(
        'unique',
    );
});

test('no modifiers is Normal', () => {
    expect(deriveRarity(base('base'), [], map)).toBe('normal');
    expect(deriveRarity(null, [], map)).toBe('normal');
});

test('up to one prefix and one suffix is Magic', () => {
    expect(deriveRarity(base('base'), [stat('p1')], map)).toBe('magic');
    expect(deriveRarity(base('base'), [stat('s1')], map)).toBe('magic');
    expect(deriveRarity(base('base'), [stat('p1'), stat('s1')], map)).toBe(
        'magic',
    );
});

test('more than one of either is Rare', () => {
    expect(deriveRarity(base('base'), [stat('p1'), stat('p2')], map)).toBe(
        'rare',
    );
    expect(
        deriveRarity(base('base'), [stat('p1'), stat('s1'), stat('s2')], map),
    ).toBe('rare');
});

test('a stat whose mod has not resolved yet is not counted', () => {
    expect(deriveRarity(base('base'), [stat('unknown')], map)).toBe('normal');
});
