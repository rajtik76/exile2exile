/**
 * Client-side mirror of the build-plan JSON shape owned by the server's
 * `App\Support\Planner\PlanSchema` (schema v2). Keep the two in step: a change to
 * the stored shape is a new schema version there and an update here.
 */

import type { TreeAllocation } from '@/types/tree';

export type PlanMode = 'phases' | 'single';
export type TabKind = 'base' | 'custom';
export type SectionKey = 'items' | 'gems' | 'tree';
export type GemKind = 'active' | 'support';
export type ReferenceType = 'gem' | 'rune' | 'unique' | 'base';

/** A gem reference sitting in a gem group (resolved live, never persisted). */
export interface ItemSlot {
    type: 'gem';
    id: string;
}

export type ItemRarity = 'normal' | 'magic' | 'rare' | 'unique';

/** The GGPK reference an equipment item is built on: a base type or a named unique. */
export interface ItemRef {
    type: 'base' | 'unique';
    id: string;
}

/** A rune reference sitting in an item socket. */
export interface RuneRef {
    type: 'rune';
    id: string;
}

/**
 * An item's own defensive/quality properties, as the game tooltip shows them (0 = hidden).
 * Block is shields-only. Mirrors the server's PlanSchema ITEM_PROP_KEYS.
 */
export interface ItemProps {
    quality: number;
    armour: number;
    evasion: number;
    energyShield: number;
    block: number;
}

/**
 * One modifier on a planned item: a reference to a real GGPK affix (`Mods.Id`, which
 * encodes the tier) plus the author's rolled values (one per range in the tier). The
 * wording, ranges and generation type resolve live from the mod catalogue.
 */
export interface ItemStat {
    modId: string;
    values: number[];
}

/**
 * One rolled value on a UNIQUE item's own (fixed) mod - the counterpart to {@link ItemStat}
 * for a unique, which carries no author-picked affixes. `key` names one of the unique's
 * synced Path of Building mod lines (stable across a value changing - see the server's
 * `UniqueModLine`); `values` is empty for a line with no numeric range (flavour text).
 */
export interface UniqueModStat {
    key: string;
    values: number[];
}

/**
 * Most prefixes and most suffixes an item of each rarity may carry (a game rule, mirrored
 * on the server in ModCatalogue). Normal carries none; magic one of each; rare three.
 */
export const MODS_PER_RARITY: Record<ItemRarity, number> = {
    normal: 0,
    magic: 1,
    rare: 3,
    unique: 0,
};

/**
 * A planned equipment item, PoB-style: a rarity, the GGPK base/unique it's built on
 * (drives the icon), an optional display name and author-typed modifier lines. Only
 * the ref is a token - icon/category resolve live; name and stats are the author's.
 */
export interface ItemPlan {
    rarity: ItemRarity;
    base: ItemRef | null;
    /**
     * The item's own rolled name (e.g. "Rift Pelt" on a "Slipstrike Vest"), author-typed
     * or carried over from a PoB import. Empty falls back to the base/unique's own name
     * wherever the item is displayed - {@link MAX_ITEM_NAME_LENGTH} caps it.
     */
    name: string;
    /** Whether the item is Corrupted (author-toggled or carried over from a PoB import). */
    corrupted: boolean;
    props: ItemProps;
    stats: ItemStat[];
    /** A unique item's own rolled mod values (see {@link UniqueModStat}); empty otherwise. */
    uniqueMods: UniqueModStat[];
    sockets: (RuneRef | null)[];
    /**
     * The item's gearing priority (1..{@link MAX_PRIORITY}), or null when unset. A number
     * is unique within one phase's equipment, so the whole gearing order reads off the
     * paper-doll badges. Optional - an item without one carries no badge.
     */
    priority: number | null;
}

/** A visual gem group: the first gem is the active skill, the rest its supports. */
export interface GemGroup {
    id: string;
    gems: ItemSlot[];
}

/** The build's class + ascendancy - one per plan, shared by every phase's tree. */
export interface PlanBuild {
    className: string | null;
    ascendId: string | null;
}

export interface PlanTab {
    id: string;
    label: string;
    kind: TabKind;
}

export interface PlanEntry {
    id: string;
    name: string;
    note: string;
    priority: number;
    /** Present only on gems: an active skill or its support. */
    kind?: GemKind;
}

export interface PlanGroup {
    notes: string;
    entries: PlanEntry[];
    /** Present only on the tree group: the phase's visual passive-tree allocation. */
    allocation?: TreeAllocation;
    /** Present only on the tree group: notable/keystone skill ids in the order the
     * author allocated them - the "take this first" priority, built from tree clicks. */
    notablePriority?: number[];
    /** Present only on the items group: equipment slot -> planned item. */
    slots?: Record<string, ItemPlan>;
    /** Present only on the gems group: the visual gem groups (skill + supports). */
    groups?: GemGroup[];
}

export type PlanSection = Record<SectionKey, PlanGroup>;

export interface PlanData {
    description: string;
    mode: PlanMode;
    build: PlanBuild;
    tabs: PlanTab[];
    /** Keyed by tab id, plus the reserved SINGLE_KEY for tabs-off mode. */
    sections: Record<string, PlanSection>;
}

/** The reserved section key used when tabs are switched off. */
export const SINGLE_KEY = 'single';

/** Rarity → frame/name colour, matching the in-game item colours. */
export const RARITY_COLOR: Record<ItemRarity, string> = {
    normal: '#c8c8c8',
    magic: '#8f8fff',
    rare: '#e6e04c',
    unique: '#cf8a4a',
};

/** Base categories a slot may hold, so its picker offers only fitting items. */
const WEAPON_CATEGORIES = [
    'Mace',
    'Axe',
    'Sword',
    'Claw',
    'Dagger',
    'Flail',
    'Spear',
    'Bow',
    'Crossbow',
    'Staff',
    'Warstaff',
    'Sceptre',
    'Wand',
];
const OFFHAND_CATEGORIES = ['Shield', 'Focii', 'Quiver'];

/**
 * The equipment paper-doll layout: each slot's placement on the planner's 10-column
 * grid (weapons flank the sides, armour down the centre), its base
 * categories, and its in-game inventory footprint in cells ([width, height]) - so the
 * item image is drawn at its real proportions (square helmet, tall weapon/chest).
 */
export const EQUIPMENT_SLOTS: Array<{
    key: string;
    label: string;
    column: string;
    row: string;
    categories: string[];
    cells: [number, number];
    /** Flask/charm tiles render smaller; align nudges flask art. */
    align?: 'left' | 'right' | 'center';
    flask?: boolean;
    trinket?: boolean;
}> = [
    {
        key: 'weapon1',
        label: 'Weapon',
        column: '2 / span 2',
        row: '1 / span 4',
        categories: WEAPON_CATEGORIES,
        cells: [2, 4],
        align: 'left',
    },
    {
        key: 'weapon2',
        label: 'Off-hand',
        column: '8 / span 2',
        row: '1 / span 4',
        categories: [...WEAPON_CATEGORIES, ...OFFHAND_CATEGORIES],
        cells: [2, 4],
        align: 'right',
    },
    {
        key: 'helmet',
        label: 'Helmet',
        column: '5 / span 2',
        row: '1 / span 2',
        categories: ['Helmet'],
        cells: [2, 2],
    },
    {
        key: 'amulet',
        label: 'Amulet',
        column: '7',
        row: '3',
        categories: ['Amulet', 'Talisman'],
        cells: [1, 1],
        align: 'right',
    },
    {
        key: 'body',
        label: 'Body Armour',
        column: '5 / span 2',
        row: '3 / span 3',
        categories: ['Body Armour'],
        cells: [2, 3],
    },
    {
        key: 'ring1',
        label: 'Ring',
        column: '4',
        row: '4',
        categories: ['Ring'],
        cells: [1, 1],
        align: 'left',
    },
    {
        key: 'ring2',
        label: 'Ring',
        column: '7',
        row: '4',
        categories: ['Ring'],
        cells: [1, 1],
        align: 'right',
    },
    {
        key: 'gloves',
        label: 'Gloves',
        column: '3 / span 2',
        row: '5 / span 2',
        categories: ['Gloves'],
        cells: [2, 2],
        align: 'left',
    },
    {
        key: 'boots',
        label: 'Boots',
        column: '7 / span 2',
        row: '5 / span 2',
        categories: ['Boots'],
        cells: [2, 2],
        align: 'right',
    },
    {
        key: 'belt',
        label: 'Belt',
        column: '5 / span 2',
        row: '6',
        categories: ['Belt'],
        cells: [2, 1],
    },
    // Life flask under the gloves, mana flask under the boots, three charms centred
    // between them - the bottom row of the doll.
    {
        key: 'flask1',
        label: 'Life Flask',
        column: '3 / span 2',
        row: '7 / span 2',
        categories: ['Life Flask'],
        cells: [1, 2],
        align: 'left',
        flask: true,
    },
    {
        key: 'flask2',
        label: 'Mana Flask',
        column: '7 / span 2',
        row: '7 / span 2',
        categories: ['Mana Flask'],
        cells: [1, 2],
        align: 'right',
        flask: true,
    },
    {
        key: 'charm1',
        label: 'Charm',
        column: '4 / span 4',
        row: '7 / span 2',
        categories: ['Charm'],
        cells: [1, 1],
        align: 'left',
        trinket: true,
    },
    {
        key: 'charm2',
        label: 'Charm',
        column: '4 / span 4',
        row: '7 / span 2',
        categories: ['Charm'],
        cells: [1, 1],
        trinket: true,
    },
    {
        key: 'charm3',
        label: 'Charm',
        column: '4 / span 4',
        row: '7 / span 2',
        categories: ['Charm'],
        cells: [1, 1],
        align: 'right',
        trinket: true,
    },
];

/** Total equipment slots, and thus the count of distinct gearing-priority numbers. */
export const MAX_PRIORITY = EQUIPMENT_SLOTS.length;

/** Slot keys with no rare tier in the game (flasks and charms cap at magic). */
export const NO_RARE_SLOTS = new Set(
    EQUIPMENT_SLOTS.filter((slot) => slot.flask || slot.trinket).map(
        (slot) => slot.key,
    ),
);

/** Longest author-typed item name (e.g. a rare's rolled name, "Rift Pelt"). */
export const MAX_ITEM_NAME_LENGTH = 60;

/**
 * Validation ceiling for item quality. Ordinary gear caps at 20%, but "+X% to Maximum
 * Quality" modifiers and implicits stack well past it (a corrupted Refined Breach Ring
 * shows +73%), so the ceiling is generous rather than a game rule. Mirrors PlanSchema.
 */
export const MAX_ITEM_QUALITY = 100;

/** The three defence types; triple-hybrid bases carry all of them at once. */
export const ITEM_DEFENCE_KEYS = ['armour', 'evasion', 'energyShield'] as const;

/**
 * Most rune sockets any item carries; uniques reach it even on small gear
 * (Greymake wears four on a helmet). Mirrors PlanSchema.
 */
export const MAX_ITEM_SOCKETS = 4;

/**
 * Max rune sockets per slot: the natural maximum plus the one socket a Vaal
 * corruption can add. Runes go in weapons and armour only - rings, amulets
 * and belts take none. (PoE2 runecrafting is a game rule, not a GGPK data column.)
 */
export const SLOT_MAX_SOCKETS: Record<string, number> = {
    weapon1: 4,
    weapon2: 4,
    body: 4,
    helmet: 3,
    gloves: 3,
    boots: 3,
    belt: 0,
    amulet: 0,
    ring1: 0,
    ring2: 0,
    flask1: 0,
    flask2: 0,
    charm1: 0,
    charm2: 0,
    charm3: 0,
};

/** Most custom phases an author can add after the fixed base tabs. */
export const MAX_CUSTOM_TABS = 4;

/**
 * The fixed phase sequence, mirroring PlanSchema::BASE_TABS. A new build starts with
 * only the first ("Act I"); "Add phase" reveals the next base phase in order, then
 * custom phases beyond "Early Endgame".
 */
export const BASE_PHASES: Array<{ id: string; label: string }> = [
    { id: 'act-1', label: 'Act I' },
    { id: 'act-2', label: 'Act II' },
    { id: 'act-3', label: 'Act III' },
    { id: 'act-4', label: 'Act IV' },
    { id: 'interlude', label: 'Interlude' },
    { id: 'early-endgame', label: 'Early Endgame' },
];

/** At most 12 skill gems (one active skill per gem group). Mirrors PlanSchema. */
export const MAX_GEM_GROUPS = 12;

/** A group holds one active skill plus its 5 support gems. Mirrors PlanSchema. */
export const MAX_GEMS_PER_GROUP = 6;

/**
 * The planner's reading typography: Plus Jakarta Sans (self-hosted), chosen over
 * the brand display fonts for legibility. `base` is the root size the em-based
 * content scales from; the `.planner-reading` wrapper applies both.
 */
export const PLANNER_FONT = {
    stack: '"Plus Jakarta Sans", system-ui, sans-serif',
    base: '16px',
} as const;

export const SECTION_KEYS: SectionKey[] = ['items', 'gems', 'tree'];

/** Human labels + helper copy for each content group, shared by editor and viewer. */
export const SECTION_META: Record<
    SectionKey,
    { label: string; hint: string; priorityLabel: string }
> = {
    items: {
        label: 'Items & Runes',
        hint: 'Gear and runes to aim for. Order is priority - top item first.',
        priorityLabel: 'get',
    },
    gems: {
        label: 'Gems',
        hint: 'Skill and support gems. Order is the levelling priority.',
        priorityLabel: 'level',
    },
    tree: {
        label: 'Passive tree',
        hint: 'Notables and keystones. Order is which to take first.',
        priorityLabel: 'take',
    },
};
