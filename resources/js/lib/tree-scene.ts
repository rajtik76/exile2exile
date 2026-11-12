import type { TreeData } from '@poe2-toolkit/tree-core';
import { normalizeGggTree } from '@poe2-toolkit/tree-core/ggg';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import type { RenderResources } from '@poe2-toolkit/tree-react';
import { withAssetVersion } from '@/lib/assetVersion';
import { isRecord } from '@/lib/guards';
import { loadTreeAtlases } from '@/lib/tree-atlases';

/**
 * The live passive tree, served version-less from `/tree/current` and cache-busted
 * with the data's content stamp. `TREE_VERSION` still tags builds (PoB
 * `treeVersion`) and feeds normalisation; it does not drive the asset path.
 */
const TREE_VERSION = '0_5';
export const TREE_BASE = '/tree/current';

/** Public base for the GGG sprite atlases (skill icons, frames, centre art). */
export const treeAssetBase = `${TREE_BASE}/assets`;

/** Which published tree to load; `version` null is the live tree, stamped from the page meta. */
export interface TreeSource {
    base: string;
    version: string | null;
}

export const LIVE_TREE: TreeSource = { base: TREE_BASE, version: null };

export function patchTree(patch: string, version: string): TreeSource {
    return { base: `/tree/patches/${encodeURIComponent(patch)}`, version };
}

export function treeSourceKey(source: TreeSource): string {
    return `${source.base}?${source.version ?? ''}`;
}

function stampFor(source: TreeSource): (url: string) => string {
    const { version } = source;

    return version === null
        ? withAssetVersion
        : (url) => `${url}?v=${encodeURIComponent(version)}`;
}

/** Cache-busted URL for a `.webp` sprite atlas under the tree asset base. */
export function treeAssetUrl(name: string): string {
    return withAssetVersion(`${treeAssetBase}/${name}.webp`);
}

const rawPromises = new Map<string, Promise<unknown>>();
const dataPromises = new Map<string, Promise<TreeData>>();
const resourcesPromises = new Map<string, Promise<RenderResources>>();

function once<T>(
    cache: Map<string, Promise<T>>,
    source: TreeSource,
    load: () => Promise<T>,
): Promise<T> {
    const key = treeSourceKey(source);
    let promise = cache.get(key);

    if (promise === undefined) {
        promise = load();
        cache.set(key, promise);
    }

    return promise;
}

/** Fetch and parse the raw `data.json` once; shared by every derived loader. */
function loadRawTree(source: TreeSource): Promise<unknown> {
    return once(rawPromises, source, () =>
        fetch(stampFor(source)(`${source.base}/data.json`)).then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response.json() as Promise<unknown>;
        }),
    );
}

/**
 * The normalised tree, fetched and parsed once and shared across panels - the
 * comparison view renders two trees from the same ~5 MB source.
 */
export function loadTreeData(
    source: TreeSource = LIVE_TREE,
): Promise<TreeData> {
    return once(dataPromises, source, () =>
        loadRawTree(source).then((raw) => {
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

            return normalizeGggTree(
                raw as unknown as GggTreeJson,
                TREE_VERSION,
            );
        }),
    );
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
export function loadPointBudget(
    source: TreeSource = LIVE_TREE,
): Promise<PointBudget> {
    return loadRawTree(source).then((raw) => {
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
export function loadTreeResources(
    source: TreeSource = LIVE_TREE,
): Promise<RenderResources> {
    return once(resourcesPromises, source, () =>
        loadTreeAtlases(`${source.base}/assets`, stampFor(source)),
    );
}
