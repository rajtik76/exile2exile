import type { TreeData, TreeNode } from '@poe2-toolkit/tree-core';
import { describe, expect, it } from 'vitest';
import { ASCENDANCY_POINT_LIMIT, ascendancyPointsUsed } from './treePoints';

/**
 * `ascendancyPointsUsed` gauges a build against the flat 8-point ascendancy cap.
 * It counts only the named ascendancy's nodes, drops its free start node, and
 * never bleeds basic-tree or other-ascendancy nodes into the total - the rules
 * the planner's cap guard relies on.
 */

/** Minimal node fixture; only the fields the counter reads are set. */
function node(skill: number, extra: Partial<TreeNode> = {}): TreeNode {
    return { skill, ...extra } as TreeNode;
}

// A "Deadeye" disc (free start 100, three nodes), a second "Pathfinder"
// ascendancy, and a basic-tree node - to prove only the asked-for pool counts.
const data = {
    nodes: {
        1: node(1), // basic tree
        100: node(100, {
            ascendancyName: 'Deadeye',
            isAscendancyStart: true,
        }),
        101: node(101, { ascendancyName: 'Deadeye' }),
        102: node(102, { ascendancyName: 'Deadeye' }),
        103: node(103, { ascendancyName: 'Deadeye' }),
        200: node(200, {
            ascendancyName: 'Pathfinder',
            isAscendancyStart: true,
        }),
        201: node(201, { ascendancyName: 'Pathfinder' }),
    },
} as unknown as TreeData;

describe('ascendancyPointsUsed', () => {
    it('counts the ascendancy nodes, excluding the free start node', () => {
        expect(ascendancyPointsUsed(data, [100, 101, 102], 'Deadeye')).toBe(2);
    });

    it('ignores basic-tree and other-ascendancy nodes', () => {
        expect(
            ascendancyPointsUsed(data, [1, 100, 101, 200, 201], 'Deadeye'),
        ).toBe(1);
    });

    it('is zero for a build that has only entered the disc', () => {
        expect(ascendancyPointsUsed(data, [100], 'Deadeye')).toBe(0);
    });

    it('caps a fully-spent disc at the 8-point budget', () => {
        const full = [200, 201, 202, 203, 204, 205, 206, 207, 208];
        const fullData = {
            nodes: Object.fromEntries(
                full.map((id) => [
                    id,
                    node(id, {
                        ascendancyName: 'Pathfinder',
                        ...(id === 200 ? { isAscendancyStart: true } : {}),
                    }),
                ]),
            ),
        } as unknown as TreeData;

        expect(ascendancyPointsUsed(fullData, full, 'Pathfinder')).toBe(
            ASCENDANCY_POINT_LIMIT,
        );
    });
});
