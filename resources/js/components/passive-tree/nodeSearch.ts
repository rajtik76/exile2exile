import {
    ascendancyNodeOwner,
    chosenAttributeOption,
    classOverrideNode,
} from '@poe2-toolkit/tree-core';
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
 * A node is matched by what it shows: a class or ascendancy override's name and
 * stats (the Abyssal Lich's "Steward of Kulemak", not the Lich's "Price of Power").
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
    classId: number | null = allocation?.classId ?? null,
): Set<number> {
    const matches = compileNodeMatcher(search);

    if (!matches || !data) {
        return new Set();
    }

    const hits = new Set<number>();
    // A replacing ascendancy (the Abyssal Lich) plays on another's nodes.
    const owner = ascendancy ? ascendancyNodeOwner(data, ascendancy) : null;
    const overrideTargets = overrideTargetIds(data);

    for (const [skill, node] of Object.entries(data.nodes)) {
        // An override node is never drawn itself, only lent to a base node.
        if (overrideTargets.has(Number(skill))) {
            continue;
        }

        if (node.ascendancyName && node.ascendancyName !== owner) {
            continue;
        }

        // Match what the node shows: the class or ascendancy override, if any.
        const shown = classOverrideNode(data, classId, node, ascendancy);
        const chosen = chosenAttributeOption(node, allocation ?? undefined);

        const hit =
            (shown.name !== undefined && matches(shown.name)) ||
            (shown.stats?.some(matches) ?? false) ||
            (chosen !== undefined && matches(chosen.name)) ||
            (chosen?.stats?.some(matches) ?? false);

        if (hit) {
            hits.add(Number(skill));
        }
    }

    return hits;
}

/**
 * Every node a class or ascendancy shows in a base node's place. Such a node sits
 * off the tree and is only ever seen through its base node.
 */
function overrideTargetIds(data: TreeData): Set<number> {
    const targets = new Set<number>();

    for (const cls of data.classes) {
        for (const pairs of [
            cls.overridePairs,
            ...cls.ascendancies.map((asc) => asc.overridePairs),
        ]) {
            for (const target of Object.values(pairs ?? {})) {
                targets.add(target);
            }
        }
    }

    return targets;
}
