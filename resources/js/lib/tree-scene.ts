import type { TreeData } from '@poe2-toolkit/tree-core';
import { normalizeGggTree } from '@poe2-toolkit/tree-core/ggg';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import type { RenderResources } from '@poe2-toolkit/tree-react';
import { withAssetVersion } from '@/lib/assetVersion';
import { isRecord } from '@/lib/guards';
import { loadTreeAtlases } from '@/lib/tree-atlases';

/**
 * Deployed passive-tree snapshot, always served version-less from
 * `/tree/current` - the app only ever renders the current league's tree.
 * `TREE_VERSION` still tags builds (PoB `treeVersion`) and feeds normalisation;
 * it no longer drives the asset path.
 */
const TREE_VERSION = '0_5';
const TREE_BASE = '/tree/current';

/** Public base for the GGG sprite atlases (skill icons, frames, centre art). */
export const treeAssetBase = `${TREE_BASE}/assets`;

/** Cache-busted URL for a `.webp` sprite atlas under the tree asset base. */
export function treeAssetUrl(name: string): string {
    return withAssetVersion(`${treeAssetBase}/${name}.webp`);
}

let rawPromise: Promise<unknown> | null = null;
let dataPromise: Promise<TreeData> | null = null;
let resourcesPromise: Promise<RenderResources> | null = null;

/** Fetch and parse the raw `data.json` once; shared by every derived loader. */
function loadRawTree(): Promise<unknown> {
    rawPromise ??= fetch(withAssetVersion(`${TREE_BASE}/data.json`)).then(
        (response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response.json() as Promise<unknown>;
        },
    );

    return rawPromise;
}

/**
 * The normalised tree, fetched and parsed once and shared across panels - the
 * comparison view renders two trees from the same ~5 MB source.
 */
export function loadTreeData(): Promise<TreeData> {
    dataPromise ??= loadRawTree().then((raw) => {
        // Fail loudly at the source when the deployed payload is not a tree
        // extract (a misrouted response, a truncated deploy) instead of letting
        // normalisation crash on a missing table.
        if (
            !isRecord(raw) ||
            !isRecord(raw.nodes) ||
            !isRecord(raw.groups) ||
            !Array.isArray(raw.classes)
        ) {
            throw new Error(
                'Malformed tree data: missing nodes/groups/classes',
            );
        }

        return normalizeGggTree(raw as unknown as GggTreeJson, TREE_VERSION);
    });

    return dataPromise;
}

/** The GGPK-derived passive-point caps the planner enforces. */
export interface PointBudget {
    /** Main always-active tree: level points + campaign weapon-set points. */
    basic: number;
    /** Per-weapon-set divergence allowance (set I and set II each get this). */
    weaponSet: number;
}

/**
 * The passive-point budget, read straight from the GGPK-derived extract
 * (`maxBasicPoints` / `maxWeaponSetPoints`). Shares the raw payload with
 * {@link loadTreeData}, so it adds no fetch. Falls back to sane defaults only
 * if an older extract without the fields is served.
 */
export function loadPointBudget(): Promise<PointBudget> {
    return loadRawTree().then((raw) => {
        const data = isRecord(raw) ? raw : {};

        return {
            basic:
                typeof data.maxBasicPoints === 'number'
                    ? data.maxBasicPoints
                    : FALLBACK_BUDGET.basic,
            weaponSet:
                typeof data.maxWeaponSetPoints === 'number'
                    ? data.maxWeaponSetPoints
                    : FALLBACK_BUDGET.weaponSet,
        };
    });
}

/** Used only when an extract predating the budget fields is served. */
const FALLBACK_BUDGET: PointBudget = { basic: 123, weaponSet: 24 };

/** The sprite atlases, loaded once and shared across panels. */
export function loadTreeResources(): Promise<RenderResources> {
    resourcesPromise ??= loadTreeAtlases(treeAssetBase);

    return resourcesPromise;
}
