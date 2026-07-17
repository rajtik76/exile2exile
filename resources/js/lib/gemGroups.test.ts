import { expect, test } from 'vitest';
import type { GemGroup, ItemSlot } from '@/types/planner';
import {
    excludedGemIds,
    gemsByPriority,
    withGemRemoved,
    withGemSet,
    withSupportMoved,
} from './gemGroups';

const gem = (id: string): ItemSlot => ({ type: 'gem', id });

const GROUPS: GemGroup[] = [
    { id: 'g-1', gems: [gem('Spark'), gem('Pierce'), gem('Chain')] },
    { id: 'g-2', gems: [gem('Arc')] },
];

test('replaces a gem at an existing index and appends past the end', function () {
    const replaced = withGemSet(GROUPS, 0, 1, gem('Fork'));

    expect(replaced[0].gems.map((g) => g.id)).toEqual([
        'Spark',
        'Fork',
        'Chain',
    ]);
    expect(replaced[1]).toBe(GROUPS[1]);

    const appended = withGemSet(GROUPS, 1, 5, gem('Fork'));

    expect(appended[1].gems.map((g) => g.id)).toEqual(['Arc', 'Fork']);
});

test('removes a gem and closes the gap', function () {
    const next = withGemRemoved(GROUPS, 0, 1);

    expect(next[0].gems.map((g) => g.id)).toEqual(['Spark', 'Chain']);
    expect(next[1]).toBe(GROUPS[1]);
});

test('moves a support within its group and ignores a cross-group drop', function () {
    const moved = withSupportMoved(GROUPS, '0:1', '0:2');

    expect(moved[0].gems.map((g) => g.id)).toEqual([
        'Spark',
        'Chain',
        'Pierce',
    ]);

    expect(withSupportMoved(GROUPS, '0:1', '1:0')).toBe(GROUPS);
});

test("a skill slot's picker bars every other group's active skill", function () {
    // Editing group 1's skill: group 0's skill is barred; supports are not.
    expect(excludedGemIds(GROUPS, { group: 1, gem: 0 })).toEqual(['Spark']);
});

test("a support slot's picker bars only its group's other supports", function () {
    // Editing g-1's second support (Chain): sibling Pierce is barred, the
    // skill Spark and the other group's gems are not.
    expect(excludedGemIds(GROUPS, { group: 0, gem: 2 })).toEqual(['Pierce']);
    // A new support slot past the end bars both existing supports.
    expect(excludedGemIds(GROUPS, { group: 0, gem: 3 })).toEqual([
        'Pierce',
        'Chain',
    ]);
});

test('an empty group excludes nothing for a skill pick', function () {
    expect(
        excludedGemIds([{ id: 'g-1', gems: [] }], { group: 0, gem: 0 }),
    ).toEqual([]);
});

test('flattens every gem in priority order with stable keys', function () {
    expect(gemsByPriority(GROUPS)).toEqual([
        { gem: gem('Spark'), support: false, key: 'g-1:0' },
        { gem: gem('Pierce'), support: true, key: 'g-1:1' },
        { gem: gem('Chain'), support: true, key: 'g-1:2' },
        { gem: gem('Arc'), support: false, key: 'g-2:0' },
    ]);
});
