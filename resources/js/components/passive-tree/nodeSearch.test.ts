import type { TreeData } from '@poe2-toolkit/tree-core';
import { expect, test } from 'vitest';
import { searchTreeNodes } from './nodeSearch';

/**
 * A minimal tree: a named notable, a node matched only by its stat text, an
 * attribute node whose pick lives in the allocation, and one node in each of
 * two ascendancies (only the active one is on screen).
 */
const DATA = {
    nodes: {
        1: { skill: 1, name: 'Heavy Buffer', stats: ['10% increased Armour'] },
        2: {
            skill: 2,
            name: 'Mystic',
            stats: ['20% increased Mana Regeneration Rate'],
        },
        3: {
            skill: 3,
            name: 'Attribute',
            stats: [],
            isAttribute: true,
            options: [
                {
                    id: 30,
                    name: 'Strength',
                    stats: ['+5 to Strength'],
                    icon: '',
                },
                {
                    id: 31,
                    name: 'Intelligence',
                    stats: ['+5 to Intelligence'],
                    icon: '',
                },
            ],
        },
        4: {
            skill: 4,
            name: 'Gathering Storm',
            stats: [],
            ascendancyName: 'Deadeye',
        },
        5: {
            skill: 5,
            name: 'Storm Rider',
            stats: [],
            ascendancyName: 'Stormweaver',
        },
    },
} as unknown as TreeData;

test('matches by node name and by stat text, case-insensitively', function () {
    expect(searchTreeNodes(DATA, 'heavy', null, null)).toEqual(new Set([1]));
    expect(searchTreeNodes(DATA, 'mana regen', null, null)).toEqual(
        new Set([2]),
    );
});

test('a query shorter than the minimum, or no tree data, matches nothing', function () {
    expect(searchTreeNodes(DATA, 'h', null, null).size).toBe(0);
    expect(searchTreeNodes(DATA, '   ', null, null).size).toBe(0);
    expect(searchTreeNodes(null, 'heavy', null, null).size).toBe(0);
});

test("only the active ascendancy's nodes can match", function () {
    // Both ascendancy nodes carry "Storm" in their name; only Deadeye is active,
    // so Stormweaver's node (off-canvas at its raw position) must not ring.
    expect(searchTreeNodes(DATA, 'storm', 'Deadeye', null)).toEqual(
        new Set([4]),
    );
    expect(searchTreeNodes(DATA, 'storm', null, null).size).toBe(0);
});

test("an allocated attribute node matches by its chosen option's text", function () {
    const allocation = {
        classId: 0,
        allocated: [3],
        attributeChoices: { 3: 'int' as const },
    };

    expect(searchTreeNodes(DATA, 'intelligence', null, allocation)).toEqual(
        new Set([3]),
    );
    // The un-chosen option's text must not match.
    expect(searchTreeNodes(DATA, 'strength', null, allocation).size).toBe(0);
    // Without the pick there is no option text at all.
    expect(searchTreeNodes(DATA, 'intelligence', null, null).size).toBe(0);
});
