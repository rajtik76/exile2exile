import { chosenAttributeOption } from '@poe2-toolkit/tree-core';
import type { BuildAllocation, TreeData } from '@poe2-toolkit/tree-core';

/** Shortest node-search query that highlights matches (avoids matching everything). */
export const SEARCH_MIN = 2;

/** Tests one node name or stat line against a query. */
export type NodeMatcher = (text: string) => boolean;

/**
 * Punctuation that marks a query as a pattern. A bare `+` and a bare `.` are
 * excluded on purpose: stat lines are full of both ("+5 to Strength", "0.6
 * seconds"), and promoting those to syntax would change what a literal search
 * finds.
 */
const PATTERN_HINT = /[|()[\]\\^$*?]|\{\d+(?:,\d*)?\}|\.\+/;

/**
 * Compiles a query into a text predicate, or null when it is too short to
 * highlight anything. A query holding {@link PATTERN_HINT} punctuation compiles
 * as a case-insensitive regex; everything else, and any pattern the engine
 * rejects, searches as a case-insensitive substring.
 */
export function compileNodeMatcher(search: string): NodeMatcher | null {
    const query = search.trim();

    if (query.length < SEARCH_MIN) {
        return null;
    }

    if (PATTERN_HINT.test(query)) {
        try {
            const pattern = new RegExp(query, 'i');

            return (text) => pattern.test(text);
        } catch {
            // Half-typed or invalid: search it as plain text instead.
        }
    }

    const needle = query.toLowerCase();

    return (text) => text.toLowerCase().includes(needle);
}

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
    const matches = compileNodeMatcher(search);

    if (!matches || !data) {
        return new Set();
    }

    const hits = new Set<number>();

    for (const [skill, node] of Object.entries(data.nodes)) {
        if (node.ascendancyName && node.ascendancyName !== ascendancy) {
            continue;
        }

        const chosen = chosenAttributeOption(node, allocation ?? undefined);

        const hit =
            (node.name !== undefined && matches(node.name)) ||
            (node.stats?.some(matches) ?? false) ||
            (chosen !== undefined && matches(chosen.name)) ||
            (chosen?.stats?.some(matches) ?? false);

        if (hit) {
            hits.add(Number(skill));
        }
    }

    return hits;
}
