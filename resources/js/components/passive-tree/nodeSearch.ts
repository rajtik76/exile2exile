import { chosenAttributeOption } from '@poe2-toolkit/tree-core';
import type { BuildAllocation, TreeData } from '@poe2-toolkit/tree-core';

/** Shortest node-search query that highlights matches (avoids matching everything). */
export const SEARCH_MIN = 2;

/**
 * Skill ids whose node name OR stat description matches the query - drawn with a
 * ring. Only the active ascendancy's nodes are on screen (relocated into the
 * hub); every other ascendancy's nodes sit at far-flung raw positions, so
 * matching them would ring empty spots on the tree's edges. Keep the active
 * one - the renderer highlights it at its relocated position.
 *
 * An allocated "any attribute" node carries no Str/Dex/Int text on the base
 * node - the pick lives in the allocation. The chosen option is resolved so
 * searching "intelligence" rings the node it was set to.
 */
export function searchTreeNodes(
    data: TreeData | null,
    search: string,
    ascendancy: string | null,
    allocation: BuildAllocation | null,
): Set<number> {
    const query = search.trim().toLowerCase();

    if (query.length < SEARCH_MIN || !data) {
        return new Set();
    }

    const hits = new Set<number>();

    for (const [skill, node] of Object.entries(data.nodes)) {
        if (node.ascendancyName && node.ascendancyName !== ascendancy) {
            continue;
        }

        const chosen = chosenAttributeOption(node, allocation ?? undefined);

        const matches =
            node.name?.toLowerCase().includes(query) ||
            node.stats?.some((stat) => stat.toLowerCase().includes(query)) ||
            chosen?.name.toLowerCase().includes(query) ||
            chosen?.stats?.some((stat) => stat.toLowerCase().includes(query));

        if (matches) {
            hits.add(Number(skill));
        }
    }

    return hits;
}
