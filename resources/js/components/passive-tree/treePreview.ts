import { pathToNode, weaponSetRemovalSet } from '@poe2-toolkit/tree-core';
import type { AllocMode, TreeGraph, WeaponSet } from '@poe2-toolkit/tree-core';
import type { AllocationPreview } from '@poe2-toolkit/tree-react';

/** Edge key matching the renderer's preview set: `min-max` of the two node ids. */
export function edgeKey(a: number, b: number): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * The hover preview for a click on `target`: the gold path it would allocate,
 * or the red set it would remove. `null` when the target is already a source or
 * unreachable.
 *
 * `mode` and `weaponSets` mirror the actual allocation rules so the preview never
 * suggests a route the click would refuse: a weapon-set path roots only at the
 * basic tree or the same set, never crossing the other set. Ascendancy previews
 * pass mode 0 with no weapon sets, so they behave exactly as before.
 *
 * Removal is Path-of-Building-shaped: the clicked node and everything that
 * depended on it are removed, and only rails *between two removed nodes* are
 * painted - exactly 1:1 with what disappears. The renderer also rings each
 * removed node, so a lone tip (no internal edge) still shows.
 */
export function previewFor(
    graph: TreeGraph,
    start: number,
    allocatedSet: Set<number>,
    target: number,
    mode: AllocMode,
    weaponSets: Record<number, WeaponSet>,
): AllocationPreview | null {
    const edges = new Set<string>();

    if (allocatedSet.has(target)) {
        const removed = weaponSetRemovalSet(
            graph,
            start,
            allocatedSet,
            weaponSets,
            target,
        );

        for (const id of removed) {
            for (const neighbour of graph.get(id) ?? []) {
                if (removed.has(neighbour)) {
                    edges.add(edgeKey(id, neighbour));
                }
            }
        }

        return { kind: 'remove', nodes: removed, edges };
    }

    // Root the path at the start plus the nodes this mode may branch from (basic
    // or the same set); block the other set so the route can't cross it.
    const sources = new Set<number>([start]);
    const blocked = new Set<number>();

    for (const id of allocatedSet) {
        // Absent from the map = basic (always a valid branch root); otherwise the
        // node is usable only when its set matches the paint mode.
        const nodeMode = weaponSets[id] as WeaponSet | undefined;

        if (nodeMode === undefined || nodeMode === mode) {
            sources.add(id);
        } else {
            blocked.add(id);
        }
    }

    const path = pathToNode(graph, sources, target, blocked);

    if (!path || path.length === 0) {
        return null;
    }

    const anchor = [...(graph.get(path[0]) ?? [])].find((id) =>
        sources.has(id),
    );
    const chain = anchor !== undefined ? [anchor, ...path] : path;

    for (let i = 0; i < chain.length - 1; i++) {
        edges.add(edgeKey(chain[i], chain[i + 1]));
    }

    // Tint the planned path in the paint mode's colour (basic stays gold).
    return {
        kind: 'add',
        nodes: new Set(path),
        edges,
        ...(mode === 0 ? {} : { weaponSet: mode }),
    };
}
