/**
 * Inline reference tokens embedded in a plan's Markdown texts. A token -
 * `{{type:id|Display Name}}` - points at a gem, rune or (later) unique item; the
 * server resolves the ones a plan uses to display data, and the picker inserts new
 * ones. The catalogue behind them is GGPK-only (see the server IconResolver).
 */

export type RefType = 'gem' | 'rune' | 'unique' | 'notable';

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
    /** Whether a weapon base/unique is two-handed (fills the off-hand). */
    twoHanded?: boolean;
    /**
     * A crop rect into a sprite atlas, used when the reference has no single-file
     * icon (notable passives, whose art lives only in the tree atlas). Null otherwise.
     */
    sprite?: ReferenceSprite | null;
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
