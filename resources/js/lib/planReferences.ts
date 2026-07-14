/**
 * Inline reference tokens embedded in a plan's Markdown texts. A token -
 * `{{type:id|Display Name}}` - points at a gem, rune or (later) unique item; the
 * server resolves the ones a plan uses to display data, and the picker inserts new
 * ones. The catalogue behind them is GGPK-only (see the server IconResolver).
 */

/**
 * `base` never appears in an inline `{{type:id|name}}` text token - only an equipped
 * slot's own base pick resolves to one (see `IconResolver::baseReference`) - but it's
 * still a real value of a `PlanReference.type` the `ReferenceMap` server-side can
 * return, so it has to be part of the same union.
 */
export type RefType = 'gem' | 'rune' | 'unique' | 'notable' | 'base';

export interface PlanReference {
    type: RefType;
    id: string;
    name: string;
    icon?: string | null;
    category?: string | null;
    /** Gem socket-colour letter (b/g/r/w); null for runes. Tints the chip. */
    color?: string | null;
    tags?: string[];
    tooltip?: string | null;
    /** Unique-item flavour/lore text (lines joined by "\n"); shown italic. */
    flavour?: string | null;
    /** A base type's own fixed implicit modifier lines (read-only); empty otherwise. */
    implicits?: string[];
    /**
     * A unique's synced mods/implicits, structured (key/rolls) rather than flat text - the
     * editor uses these to render a value input per ranged line and to substitute a stored
     * rolled value into the tooltip. Empty (or absent) for anything that isn't a unique.
     */
    modLines?: UniqueModLine[];
    implicitLines?: UniqueModLine[];
    /**
     * A unique's underlying base item (e.g. "Viper Cap" for Constricting Command),
     * synced from Path of Building alongside its mods - .dat carries no unique-to-
     * base-type link either. Shown under the item's name, same as the game's own
     * unique tooltip. Absent for anything that isn't a unique, or an unsynced one.
     */
    baseType?: string | null;
    /** Whether a weapon base/unique is two-handed (fills the off-hand). */
    twoHanded?: boolean;
    /**
     * A crop rect into a sprite atlas, used when the reference has no single-file
     * icon (notable passives, whose art lives only in the tree atlas). Null otherwise.
     */
    sprite?: ReferenceSprite | null;
    /**
     * A gem's hover-art background (the game's own SmartHover/GemHoverImage art,
     * painted behind the tooltip header). Coverage is genuinely sparse in the game's
     * own data - null/absent for most gems is expected, not a missing-asset bug.
     * Absent for anything that isn't a gem.
     */
    hoverImage?: string | null;
    /** A gem's per-level tooltip scaling (cost, cast time, crit, stat lines, quality). Absent for anything that isn't a gem. */
    scaling?: GemScaling | null;
    /**
     * A gem's level/attribute requirement range, as the game's own tooltip shows it -
     * capped at the game's character level cap (a gem level needing more is
     * unreachable through normal play). `str`/`dex`/`int` are null when the gem
     * never needs that attribute (weight 0 throughout), matching the in-game
     * "Requires:" line, which omits an attribute the gem doesn't need. Absent for
     * anything that isn't a gem.
     */
    requires?: GemRequires | null;
    /**
     * A base type's own defensive stats (GGPK `ArmourTypes`/`ShieldTypes`) - which of
     * Armour/Evasion/Energy Shield/Block it actually carries, each 0 when the base
     * doesn't have that defence type. Null/absent for a base GGPK has no defensive row
     * for (weapons, jewellery, ...) and always absent for a unique - .dat has no
     * unique-to-base-type link, so a unique's defence can't be looked up this way.
     */
    armour?: ReferenceArmour | null;
}

/** A base type's own defensive stats, mirroring the server's `IconResolver::itemArmour`. */
export interface ReferenceArmour {
    armour: number;
    evasion: number;
    energyShield: number;
    ward: number;
    block: number;
}

/** Per-level tooltip scaling for a gem, mirroring the server's `IconResolver::gemScaling`. */
export interface GemScaling {
    name: string;
    levels: GemScalingLevel[];
    qualityStats: GemScalingStat[];
}

export interface GemScalingLevel {
    level: number;
    cost: number | null;
    castTime: number | null;
    cooldown: number | null;
    reservation: number | null;
    spellCritChance: number | null;
    attackCritChance: number | null;
    stats: GemScalingStat[];
}

/** One scaling stat line, already translated to text; `min`/`max` are the raw values a level-scaling slider needs. */
export interface GemScalingStat {
    text: string;
    min: number;
    max: number;
}

/** A gem's level/attribute requirement range, mirroring the server's `IconResolver::gemRequires`. */
export interface GemRequires {
    level: [number, number];
    str: [number, number] | null;
    dex: [number, number] | null;
    int: [number, number] | null;
}

/**
 * One of a unique's synced mod lines, structured - mirrors the server's `UniqueModLine`.
 * `key` is the template with every ranged number blanked to `#` (stable identity, used to
 * key a stored rolled value); `rolls` is empty for flavour text with nothing to roll.
 */
export interface UniqueModLine {
    key: string;
    template: string;
    rolls: { min: number; max: number }[];
}

/** A rect within a sprite atlas sheet, enough to crop one icon out with CSS. */
export interface ReferenceSprite {
    /** Atlas sheet URL (version-stamped at render time). */
    url: string;
    x: number;
    y: number;
    w: number;
    h: number;
    sheetW: number;
    sheetH: number;
}

/** Resolved references keyed by "type:id". */
export type ReferenceMap = Record<string, PlanReference>;

export function refKey(type: string, id: string): string {
    return `${type}:${id}`;
}

/**
 * Every distinct reference token ({type, id}) found across the given texts. The
 * editor uses this to resolve tokens to live catalogue data - only the token (id)
 * is ever stored; icon/tooltip/flavour are always fetched fresh, never persisted.
 */
export function collectTokens(
    texts: string[],
): Array<{ type: RefType; id: string }> {
    const seen = new Set<string>();
    const tokens: Array<{ type: RefType; id: string }> = [];

    for (const text of texts) {
        const regex = tokenRegex();
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const type = match[1] as RefType;
            const id = match[2];
            const key = refKey(type, id);

            if (!seen.has(key)) {
                seen.add(key);
                tokens.push({ type, id });
            }
        }
    }

    return tokens;
}

/** Source for the token pattern; callers build their own RegExp (own lastIndex). */
const TOKEN_SOURCE =
    '\\{\\{(gem|rune|unique|notable):([^|{}]+)\\|([^{}]*)\\}\\}';

export function tokenRegex(): RegExp {
    return new RegExp(TOKEN_SOURCE, 'g');
}

export function formatToken(ref: {
    type: string;
    id: string;
    name: string;
}): string {
    return `{{${ref.type}:${ref.id}|${ref.name}}}`;
}

/**
 * Insert a reference token over a textarea's selection, returning the new value and
 * where the caret should land (just after the token).
 */
export function insertToken(
    text: string,
    selectionStart: number,
    selectionEnd: number,
    ref: { type: string; id: string; name: string },
): { text: string; caret: number } {
    const token = formatToken(ref);
    const next =
        text.slice(0, selectionStart) + token + text.slice(selectionEnd);

    return { text: next, caret: selectionStart + token.length };
}

/** A minimal mdast/unist node shape - enough to walk and rewrite text nodes. */
interface MdNode {
    type: string;
    value?: string;
    children?: MdNode[];
    data?: unknown;
}

/**
 * A remark plugin that turns reference tokens inside text into custom `ref-chip`
 * inline elements (via `data.hName`/`hProperties`, so they survive mdast→hast and
 * map to a React component). Everything else stays plain Markdown.
 */
export function remarkRefTokens() {
    return (tree: MdNode): void => walk(tree);
}

function walk(node: MdNode): void {
    if (!Array.isArray(node.children)) {
        return;
    }

    const next: MdNode[] = [];

    for (const child of node.children) {
        if (
            child.type === 'text' &&
            typeof child.value === 'string' &&
            child.value.includes('{{')
        ) {
            next.push(...splitTokens(child.value));
        } else {
            walk(child);
            next.push(child);
        }
    }

    node.children = next;
}

function splitTokens(value: string): MdNode[] {
    const nodes: MdNode[] = [];
    const regex = tokenRegex();
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(value)) !== null) {
        if (match.index > lastIndex) {
            nodes.push({
                type: 'text',
                value: value.slice(lastIndex, match.index),
            });
        }

        const [, type, id, name] = match;
        nodes.push({
            type: 'refChip',
            data: {
                hName: 'ref-chip',
                hProperties: { reftype: type, refid: id, refname: name },
            },
            children: [],
        });

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < value.length) {
        nodes.push({ type: 'text', value: value.slice(lastIndex) });
    }

    return nodes;
}
