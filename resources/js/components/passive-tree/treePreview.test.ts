import type { TreeGraph } from '@poe2-toolkit/tree-core';
import { describe, expect, it } from 'vitest';
import { previewFor } from './treePreview';

/**
 * `previewFor` drives the hover overlay: the gold path a click would allocate,
 * or the red set + edges it would remove. These tests pin the removal preview
 * (the red line) and the weapon-set pathing rules against a hand-built graph -
 * `previewFor` reads only an adjacency map, so no full tree data is needed.
 */

/** Build an undirected adjacency map from a list of edges. */
function graphOf(edges: [number, number][]): TreeGraph {
    const graph: TreeGraph = new Map();
    const link = (from: number, to: number): void => {
        let set = graph.get(from);

        if (!set) {
            set = new Set();
            graph.set(from, set);
        }

        set.add(to);
    };

    for (const [a, b] of edges) {
        link(a, b);
        link(b, a);
    }

    return graph;
}

// start(0)-1-2 trunk; 2 is a junction to leaves 3 and 4.
const graph = graphOf([
    [0, 1],
    [1, 2],
    [2, 3],
    [2, 4],
]);

describe('previewFor - removal (red line)', () => {
    it('marks the clicked junction, its branches, and the edges between them', () => {
        const preview = previewFor(graph, 0, new Set([1, 2, 3, 4]), 2, 0, {});

        expect(preview?.kind).toBe('remove');
        // The clicked node and everything that depended on it (PoB semantics).
        expect([...(preview?.nodes ?? [])].sort()).toEqual([2, 3, 4]);
        // The initial edges from the junction to each branch are highlighted,
        // 1:1 with what is deleted.
        expect([...(preview?.edges ?? [])].sort()).toEqual(['2-3', '2-4']);
    });

    it('marks just the clicked tip, with no edge', () => {
        const preview = previewFor(graph, 0, new Set([1, 2, 3, 4]), 4, 0, {});

        expect(preview?.kind).toBe('remove');
        expect([...(preview?.nodes ?? [])]).toEqual([4]); // only the tip
        expect(preview?.edges.size).toBe(0); // a lone node has no internal edge
    });

    it('does not paint an edge to a node that survives the click', () => {
        // Clicking the leaf 3 removes only 3; the rail 2-3 connects a removed node
        // to a kept one, so it is not part of the red line.
        const preview = previewFor(graph, 0, new Set([1, 2, 3, 4]), 3, 0, {});

        expect([...(preview?.nodes ?? [])]).toEqual([3]);
        expect(preview?.edges.size).toBe(0);
    });
});

describe('previewFor - allocate (gold path)', () => {
    it('returns the path to add and its edges, anchored to the tree', () => {
        const preview = previewFor(graph, 0, new Set(), 3, 0, {});

        expect(preview?.kind).toBe('add');
        expect([...(preview?.nodes ?? [])].sort()).toEqual([1, 2, 3]);
        expect([...(preview?.edges ?? [])].sort()).toEqual([
            '0-1',
            '1-2',
            '2-3',
        ]);
    });

    it('returns null when the target is unreachable in this mode', () => {
        // 2 belongs to weapon set II; a set I path to 3 would have to cross it, so
        // there is no valid route and nothing previews.
        const preview = previewFor(graph, 0, new Set([1, 2]), 3, 1, { 2: 2 });

        expect(preview).toBeNull();
    });
});
