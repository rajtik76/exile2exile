import { ascendancyStartNode } from '@poe2-toolkit/tree-core';
import type { TreeData } from '@poe2-toolkit/tree-core';

/**
 * Ascendancy points are earned by completing the campaign's ascension trials -
 * a flat 8 at most. Unlike the basic and weapon-set budgets this isn't a passive
 * tree property, so the GGPK-derived extract doesn't carry it; the planner holds
 * the game's fixed cap here and enforces it on allocation (Path of Building
 * hard-codes the same number).
 */
export const ASCENDANCY_POINT_LIMIT = 8;

/**
 * How many ascendancy points a build spends in a given ascendancy: its allocated
 * nodes for that ascendancy, less the always-free start node. Ascendancy nodes
 * draw from this separate pool and never count toward the basic or weapon-set
 * budgets, so they are gauged on their own.
 *
 * @param data            the live tree (resolves the free start node)
 * @param allocated       every allocated node id (other ascendancies are ignored)
 * @param ascendancyName  the ascendancy to count, e.g. "Deadeye"
 */
export function ascendancyPointsUsed(
    data: TreeData,
    allocated: Iterable<number>,
    ascendancyName: string,
): number {
    const start = ascendancyStartNode(data, ascendancyName);
    let used = 0;

    for (const id of allocated) {
        if (id !== start && data.nodes[id]?.ascendancyName === ascendancyName) {
            used += 1;
        }
    }

    return used;
}
