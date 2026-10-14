import type { TreeData } from '@poe2-toolkit/tree-core';
import { describe, expect, it } from 'vitest';
import { notableReference, reconcileNotablePriority } from './treeNotables';

function treeData(nodes: Record<number, unknown>): TreeData {
    return { nodes } as unknown as TreeData;
}

const data = treeData({
    1: { name: 'Fire Mastery', isNotable: true, stats: ['+10% fire'] },
    2: { name: 'Cadence', isKeystone: true, stats: ['No mana'] },
    3: {
        name: 'Deadeye Focus',
        isNotable: true,
        ascendancyName: 'Deadeye',
        stats: [],
    },
    10: { name: 'Plain Node', stats: [] },
    11: { name: 'Dexterity', stats: [] },
});

describe('reconcileNotablePriority', () => {
    it('seeds an empty priority from the allocation in allocation order', () => {
        expect(reconcileNotablePriority([], [11, 2, 10, 1], data)).toEqual([
            2, 1,
        ]);
    });

    it('keeps the stored order and appends newly allocated notables at the end', () => {
        expect(reconcileNotablePriority([1], [10, 1, 2], data)).toEqual([1, 2]);
    });

    it('drops de-allocated notables', () => {
        expect(reconcileNotablePriority([2, 1], [1], data)).toEqual([1]);
    });

    it('ignores non-landmark allocated nodes', () => {
        expect(reconcileNotablePriority([], [10, 11], data)).toEqual([]);
    });

    it('is idempotent on a settled list', () => {
        const settled = reconcileNotablePriority([], [1, 2], data);

        expect(reconcileNotablePriority(settled, [1, 2], data)).toEqual(
            settled,
        );
    });
});

describe('notableReference', () => {
    it('builds a notable reference with joined stat lines', () => {
        expect(notableReference(data, 1)).toEqual({
            type: 'notable',
            id: 'Fire Mastery',
            name: 'Fire Mastery',
            category: 'Notable',
            tooltip: '+10% fire',
            color: null,
        });
    });

    it('labels keystones', () => {
        expect(notableReference(data, 2)?.category).toBe('Keystone');
    });

    it('labels an ascendancy notable with its ascendancy', () => {
        expect(notableReference(data, 3)?.category).toBe('Deadeye notable');
    });

    it('returns null for a non-landmark node', () => {
        expect(notableReference(data, 10)).toBeNull();
    });

    it("names an overridden notable as the build's ascendancy shows it", () => {
        // The Abyssal Lich plays on the Lich's disc and shows node 20 as node 900.
        const lich = {
            nodes: {
                20: {
                    skill: 20,
                    name: 'Price of Power',
                    isNotable: true,
                    ascendancyName: 'Lich',
                    stats: ['a'],
                },
                900: { skill: 900, name: 'Steward of Kulemak', stats: ['b'] },
            },
            classes: [
                {
                    id: 0,
                    ascendancies: [
                        { id: 'Lich' },
                        {
                            id: 'Abyssal Lich',
                            replaces: 'Lich',
                            overridePairs: { 20: 900 },
                        },
                    ],
                },
            ],
        } as unknown as TreeData;

        expect(notableReference(lich, 20, 0, 'Abyssal Lich')).toMatchObject({
            name: 'Steward of Kulemak',
            category: 'Abyssal Lich notable',
            tooltip: 'b',
        });
        expect(notableReference(lich, 20, 0, 'Lich')).toMatchObject({
            name: 'Price of Power',
            category: 'Lich notable',
        });
    });
});
