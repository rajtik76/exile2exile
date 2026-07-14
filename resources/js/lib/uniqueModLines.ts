/**
 * A unique item's own mods are fixed - the game rolls them, the author only records the
 * result. This mirrors `modLines.ts`'s template/value substitution for that case: a
 * `UniqueModLine` (server `App\Pob\Uniques\UniqueModLine`, synced from Path of Building) is
 * a template with `(min-max)` tokens, decimal-capable (PoB's own data carries genuinely
 * fractional rolls, e.g. "11.9 Life Regeneration per second") - `modLines.ts`'s `RANGE` is
 * integer-only by design (GGPK affix rolls always are), so this is a sibling, not a reuse.
 */

import type { ModToken } from '@/lib/modLines';
import type { UniqueModLine } from '@/lib/planReferences';

/** Matches a `(min-max)` range token, decimal-capable, e.g. `(80-120)` or `(3.1-6)`. */
const RANGE = /\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g;

/**
 * The line's concrete text: each `(min-max)` token replaced by the given rolled value, in
 * order. A line with no ranges (flavour text) passes through unchanged. A missing value
 * (nothing rolled in yet) falls back to the roll's own minimum, same as `modLines.ts`.
 */
export function renderUniqueModLine(
    line: UniqueModLine,
    values: number[],
): string {
    let slot = 0;

    return line.template.replace(RANGE, () => {
        const rollIndex = slot++;
        const value = values[rollIndex] ?? line.rolls[rollIndex]?.min ?? 0;

        return String(value);
    });
}

/** Whether every rolled value sits inside its roll's range (one value per roll). */
export function uniqueModValuesValid(
    line: UniqueModLine,
    values: number[],
): boolean {
    if (values.length !== line.rolls.length) {
        return false;
    }

    return line.rolls.every((roll, index) => {
        const value = values[index];

        return (
            typeof value === 'number' && value >= roll.min && value <= roll.max
        );
    });
}

/**
 * Split a unique mod line into text runs and value inputs for inline editing - the same
 * `ModToken` shape `modDisplayLines` builds for an authored affix, so `ModRow`'s rendering
 * can be shared. Each `(min-max)` token becomes a `value` token bound to that roll.
 */
export function uniqueModTokens(line: UniqueModLine): ModToken[] {
    const tokens: ModToken[] = [];
    const regex = new RegExp(RANGE.source, 'g');
    let last = 0;
    let match: RegExpExecArray | null;
    let rollIndex = 0;

    while ((match = regex.exec(line.template)) !== null) {
        if (match.index > last) {
            tokens.push({
                kind: 'text',
                text: line.template.slice(last, match.index),
            });
        }

        const roll = line.rolls[rollIndex];
        tokens.push({
            kind: 'value',
            rollIndex: rollIndex++,
            min: roll.min,
            max: roll.max,
        });
        last = match.index + match[0].length;
    }

    if (last < line.template.length) {
        tokens.push({ kind: 'text', text: line.template.slice(last) });
    }

    return tokens;
}
