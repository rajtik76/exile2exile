import {
    ascendancyNodeOwner,
    classOverrideNode,
} from '@poe2-toolkit/tree-core';
import type { TreeData, TreeNode } from '@poe2-toolkit/tree-core';
import type { PlanReference } from '@/lib/planReferences';

/**
 * A node that earns a spot in the priority list - a named notable or a keystone.
 * Plain passives, attributes and pathing nodes are skipped: only landmarks matter
 * to "take this first".
 */
function isPriorityNode(data: TreeData, skill: number): boolean {
    const node = data.nodes[skill];

    return !!node && (node.isNotable === true || node.isKeystone === true);
}

/**
 * Fold the current allocation into the stored priority order. The stored order is
 * authoritative - every id still allocated keeps its place - and any newly allocated
 * notable is appended in allocation order (tree-core keeps `allocated` in the order
 * nodes were taken, so this is "first clicked, first in the list"). De-allocated
 * notables drop out. Pure and idempotent, so it seeds legacy plans (empty priority)
 * straight from the allocation and never reorders on a no-op change.
 */
export function reconcileNotablePriority(
    priority: number[],
    allocated: number[],
    data: TreeData,
): number[] {
    const allocatedSet = new Set(allocated);
    const kept = priority.filter(
        (skill) => allocatedSet.has(skill) && isPriorityNode(data, skill),
    );
    const keptSet = new Set(kept);
    const appended = allocated.filter(
        (skill) => isPriorityNode(data, skill) && !keptSet.has(skill),
    );

    return [...kept, ...appended];
}

/**
 * The node a build shows at `skill`: its class or ascendancy override applied (the
 * Abyssal Lich shows the Lich's "Price of Power" as "Steward of Kulemak"), the base
 * node otherwise. Undefined for an unknown id.
 */
export function shownNode(
    data: TreeData,
    skill: number,
    classId: number | null = null,
    ascendancy: string | null = null,
): TreeNode | undefined {
    const node = data.nodes[skill];

    return node
        ? classOverrideNode(data, classId, node, ascendancy)
        : undefined;
}

/**
 * Build the tooltip reference for an allocated notable/keystone straight from the
 * GGPK tree data - name, its stat lines and the landmark kind, as the build's class
 * and ascendancy show it. Feeds the shared {@link ReferenceTooltip}, so a priority row
 * hovers with the same card (and tree location mini-map) as an inline notable
 * reference. Null for a non-landmark id.
 */
export function notableReference(
    data: TreeData,
    skill: number,
    classId: number | null = null,
    ascendancy: string | null = null,
): PlanReference | null {
    const node = shownNode(data, skill, classId, ascendancy);

    if (!node || !isPriorityNode(data, skill)) {
        return null;
    }

    // A replacing ascendancy (the Abyssal Lich) owns the notables it plays on.
    const owner =
        ascendancy &&
        node.ascendancyName === ascendancyNodeOwner(data, ascendancy)
            ? ascendancy
            : node.ascendancyName;
    const category = node.isKeystone
        ? 'Keystone'
        : owner
          ? `${owner} notable`
          : 'Notable';

    return {
        type: 'notable',
        id: node.name,
        name: node.name,
        category,
        tooltip: node.stats.length > 0 ? node.stats.join('\n') : null,
        color: null,
    };
}
