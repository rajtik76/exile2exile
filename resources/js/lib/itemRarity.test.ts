import { expect, test } from 'vitest';
import { deriveRarity } from '@/lib/itemRarity';
import type { ItemMod } from '@/types/planner';

const stat = (id: string, type: 'prefix' | 'suffix' | null): ItemMod => ({
    modId: type ? id : null,
    text: id,
    name: null,
    type,
    family: null,
    tier: null,
    rolls: null,
    values: [],
});
const base = (type: 'base' | 'unique') => ({ type, id: 'X' });

test('a unique base is Unique regardless of its stats', () => {
    expect(
        deriveRarity(base('unique'), [
            stat('p1', 'prefix'),
            stat('s1', 'suffix'),
        ]),
    ).toBe('unique');
});

test('no modifiers is Normal', () => {
    expect(deriveRarity(base('base'), [])).toBe('normal');
    expect(deriveRarity(null, [])).toBe('normal');
});

test('up to one prefix and one suffix is Magic', () => {
    expect(deriveRarity(base('base'), [stat('p1', 'prefix')])).toBe('magic');
    expect(deriveRarity(base('base'), [stat('s1', 'suffix')])).toBe('magic');
    expect(
        deriveRarity(base('base'), [
            stat('p1', 'prefix'),
            stat('s1', 'suffix'),
        ]),
    ).toBe('magic');
});

test('more than one of either is Rare', () => {
    expect(
        deriveRarity(base('base'), [
            stat('p1', 'prefix'),
            stat('p2', 'prefix'),
        ]),
    ).toBe('rare');
    expect(
        deriveRarity(base('base'), [
            stat('p1', 'prefix'),
            stat('s1', 'suffix'),
            stat('s2', 'suffix'),
        ]),
    ).toBe('rare');
});

test('a single unmatched (plain-text) stat still counts toward the total', () => {
    expect(deriveRarity(base('base'), [stat('unknown', null)])).toBe('magic');
});

test('two unmatched stats fall back to the total-count heuristic (Magic)', () => {
    expect(deriveRarity(base('base'), [stat('a', null), stat('b', null)])).toBe(
        'magic',
    );
});

test('one known and one unmatched stat also falls back to the heuristic (Magic)', () => {
    expect(
        deriveRarity(base('base'), [stat('p1', 'prefix'), stat('a', null)]),
    ).toBe('magic');
});

test('three or more stats are Rare even when some are unmatched', () => {
    expect(
        deriveRarity(base('base'), [
            stat('p1', 'prefix'),
            stat('a', null),
            stat('b', null),
        ]),
    ).toBe('rare');
});
