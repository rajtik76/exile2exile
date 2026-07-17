import type { GemScalingLevel, GemScalingStat } from '@/lib/planReferences';

/**
 * Pure text/number helpers behind the shared tooltip system: rarity palettes,
 * the gem tooltip's level-range maths and the coloured-number line parser.
 * Kept free of JSX so they can be unit-tested directly; the components in
 * `tooltip.tsx` render from these.
 */

/** Colour triplet tinting a card to its entity (rarity / socket / element). */
export interface TooltipAccent {
    text: string;
    edge: string;
    glow: string;
}

/** Item-rarity accent, matching the game's item-name palette. */
export function rarityTone(rarity: string): TooltipAccent {
    switch (rarity.toUpperCase()) {
        case 'MAGIC':
            // The game's own magic-item blue.
            return {
                text: '#8888ff',
                edge: '#6a74d0',
                glow: 'rgba(136,136,255,0.30)',
            };
        case 'RARE':
            // The game's own rare-item yellow.
            return {
                text: '#ffff77',
                edge: '#c2a23c',
                glow: 'rgba(255,255,119,0.30)',
            };
        case 'UNIQUE':
            // #af6025 is PoE1's burnt-orange unique; PoE2 overrides it to a
            // brighter, more saturated orange for the item name specifically.
            return {
                text: '#ef6916',
                edge: '#af6025',
                glow: 'rgba(239,105,22,0.32)',
            };
        default:
            // NORMAL (white) - bright neutral so it reads clearly, never gilded.
            return {
                text: '#f7f7f3',
                edge: '#c8c5b8',
                glow: 'rgba(245,245,238,0.36)',
            };
    }
}

/**
 * Which banner the tooltip card draws behind its header (see `tooltip.tsx`'s
 * {@link TooltipRarityFrame} doc for the full GGPK-art story).
 */
export type TooltipRarityFrame =
    'white' | 'magic' | 'rare' | 'unique' | 'currency' | 'notable';

/** Maps an item rarity string to its {@link TooltipRarityFrame} banner. */
export function rarityFrame(rarity: string): TooltipRarityFrame {
    switch (rarity.toUpperCase()) {
        case 'MAGIC':
            return 'magic';
        case 'RARE':
            return 'rare';
        case 'UNIQUE':
            return 'unique';
        default:
            return 'white';
    }
}

/** The highest gem level the in-game tooltip's "Level:"/stat ranges ever display - further levels (up to 40 in the raw data) come from mechanics outside normal play and aren't shown by default. Matches poe2db's own reference tooltip. */
export const GEM_MAX_DISPLAY_LEVEL = 20;

/** `scaling.levels` capped at {@link GEM_MAX_DISPLAY_LEVEL} - empty only if the source data itself is empty. */
export function cappedLevels(levels: GemScalingLevel[]): GemScalingLevel[] {
    return levels.filter((level) => level.level <= GEM_MAX_DISPLAY_LEVEL);
}

/** A single min/max pair across the displayed level range, or `null` when there's nothing to show. */
export function minMax(values: (number | null)[]): [number, number] | null {
    const present = values.filter((v): v is number => v !== null);

    return present.length > 0
        ? [Math.min(...present), Math.max(...present)]
        : null;
}

/** `n` formatted exactly as it appears in a rendered stat line (matches `GemScalingStat.text`'s own number formatting). */
export function formatStatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Combines one stat across two levels into the range-notation line the game's own
 * tooltip shows (e.g. level 1's "Deals 1 to 13 Lightning Damage" + level 20's
 * "Deals 20 to 386 Lightning Damage" → "Deals (1—20) to (13—386) Lightning
 * Damage"). A stat whose value doesn't change between the two levels (e.g. a flat
 * "50% increased Magnitude of Shock inflicted") is left as-is - single numbers
 * don't get a range wrapped around them.
 */
export function combineStatText(
    first: GemScalingStat,
    last: GemScalingStat,
): string {
    if (first.min === last.min && first.max === last.max) {
        return first.text;
    }

    let text = first.text;
    let searchFrom = 0;

    // A plain indexOf would match the token inside an unrelated larger number
    // (e.g. token "1" inside "10%") - require it not be flanked by another digit.
    const isDigit = (ch: string | undefined) =>
        ch !== undefined && ch >= '0' && ch <= '9';

    const replaceOnce = (value: number, rangeMax: number) => {
        const token = formatStatNumber(value);
        let idx = text.indexOf(token, searchFrom);

        while (
            idx !== -1 &&
            (isDigit(text[idx - 1]) || isDigit(text[idx + token.length]))
        ) {
            idx = text.indexOf(token, idx + 1);
        }

        if (idx === -1) {
            return;
        }

        const replacement = `(${token}—${formatStatNumber(rangeMax)})`;
        text =
            text.slice(0, idx) + replacement + text.slice(idx + token.length);
        searchFrom = idx + replacement.length;
    };

    replaceOnce(first.min, last.min);

    if (first.max !== first.min) {
        replaceOnce(first.max, last.max);
    }

    return text;
}

/**
 * Combines a gem's per-level stat lines into the game's own range-notation display
 * (see {@link combineStatText}), pairing each level's stats by array index - the
 * same stat set applies to every level, only the values scale, so position is a
 * reliable identity (verified against a live extract, not assumed).
 */
export function combineStatLines(
    first: GemScalingStat[],
    last: GemScalingStat[],
): string[] {
    if (first.length !== last.length) {
        // Longer than expected to happen in practice (see the doc above) - fall
        // back to the highest level's own numbers rather than guess a pairing.
        return last.map((stat) => stat.text);
    }

    return first.map((stat, i) => combineStatText(stat, last[i]));
}

/** One coloured segment of a stat/mod line (see {@link splitNumberedText}). */
export type NumberedSegment =
    | { kind: 'text'; text: string }
    | { kind: 'number'; text: string }
    | { kind: 'range'; low: string; high: string };

/**
 * Splits a stat/mod line into colourable segments: a parenthesised range like
 * `(1—20)` becomes a `range` (white digits, grey em dash), a lone number (with
 * an optional leading `+`) a `number` (plain white), everything else `text`
 * inheriting the caller's colour (the mod-blue). Mirrors the game's own tooltip
 * number styling exactly - pixel checked against a reference screenshot, not
 * guessed. The JSX mapping lives in `tooltip.tsx`.
 */
export function splitNumberedText(text: string): NumberedSegment[] {
    const pattern =
        /(\([+-]?\d+(?:\.\d+)?—[+-]?\d+(?:\.\d+)?\))|([+-]?\d+(?:\.\d+)?)/g;
    const segments: NumberedSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({
                kind: 'text',
                text: text.slice(lastIndex, match.index),
            });
        }

        if (match[1]) {
            // A range: "(a—b)" - split the dash out for its own grey colour.
            const [, low, high] = /^\(([^—]+)—(.+)\)$/.exec(match[1]) ?? [];
            segments.push({ kind: 'range', low, high });
        } else {
            segments.push({ kind: 'number', text: match[0] });
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        segments.push({ kind: 'text', text: text.slice(lastIndex) });
    }

    return segments;
}
