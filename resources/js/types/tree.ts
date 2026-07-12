import type {
    AttributeChoice,
    JewelInfo,
    WeaponSet,
} from '@poe2-toolkit/tree-core';

/**
 * The passive-tree selection every surface shares: the allocated node ids plus
 * the choices the renderer replays (per-node attribute picks, weapon-set
 * assignments, socketed jewels) and the tree version they were made against.
 * Mirrors the backend's App\Tree\TreeAllocation, the one stored shape a shared
 * tree, a build plan phase and the PoB decode endpoint all use.
 */
export interface TreeAllocation {
    allocated: number[];
    attributeChoices: Record<number, AttributeChoice>;
    weaponSets: Record<number, WeaponSet>;
    jewels: Record<number, JewelInfo>;
    treeVersion: string | null;
}

/**
 * One passive tree as a whole: the class by *name* (an import's numeric id is
 * not stable across versions), the ascendancy id and the allocation. Mirrors
 * the backend's App\Tree\TreeSnapshot JSON form - what /t/{slug} pages receive
 * as their build prop, what ?from={slug} seeds the /tree editor with, what the
 * PoB decode endpoint returns and what the save endpoints persist.
 */
export interface TreeSnapshot extends TreeAllocation {
    className: string;
    ascendId: string | null;
}
