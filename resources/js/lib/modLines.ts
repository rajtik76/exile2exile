/**
 * Equipment modifiers: real GGPK affixes the author picks for a planned item, then rolls
 * a concrete value inside the chosen tier's range. Only the affix id (`Mods.Id`) and the
 * rolled values are stored on the plan; the wording, ranges and generation type are
 * resolved live from the mod catalogue (see the server ModCatalogue). This module renders
 * a stored mod to concrete text and drives the tier's value inputs.
 *
 * A mod's `stats` are its rendered ranged line(s) - e.g. `+(170-179)% increased Physical
 * Damage`. Each `(min-max)` token is one rollable value; a fixed roll (min == max) renders
 * as a plain number with no token. So the editable, substitutable slots are exactly the
 * ranged rolls, matched to their `(min-max)` tokens in text order.
 */

/** One roll's numeric range (min == max for a fixed roll). */
export interface ModRoll {
    /** The GGPK stat id this roll feeds (`local_armour_and_evasion_+%`), the key the
     *  item tooltip groups on to sum same-stat rolls across mods, as the game does. */
    stat: string;
    min: number;
    max: number;
}

/** A resolved mod: one tier of a real affix, from the mod catalogue. */
export interface ModInfo {
    id: string;
    name: string;
    group: string | null;
    type: 'prefix' | 'suffix';
    tier: number | null;
    level: number;
    /** The rendered ranged line(s), e.g. `+(10-19) to maximum Life`. */
    stats: string[];
    /** One entry per rollable value, in text order (min == max for a fixed roll). */
    rolls: ModRoll[];
    /** Mutual-exclusion group ids - two mods sharing one cannot both be on an item. */
    families: string[];
}

/** Resolved mods keyed by `Mods.Id`. */
export type ModMap = Record<string, ModInfo>;

/** Matches a `(min-max)` range token, e.g. `(170-179)` or `(-5--3)`. */
const RANGE = /\((-?\d+)-(-?\d+)\)/g;

/**
 * The indices into a mod's `rolls` that are actually ranged (min < max) - the values the
 * author rolls, matched one-to-one and in order with the `(min-max)` tokens in the text.
 * Fixed rolls are omitted: they carry no token and no choice.
 */
export function rangedRollIndices(mod: ModInfo): number[] {
    const indices: number[] = [];

    mod.rolls.forEach((roll, index) => {
        if (roll.min < roll.max) {
            indices.push(index);
        }
    });

    return indices;
}

/** A freshly picked mod's default values: every roll at its minimum (fixed rolls too). */
export function defaultModValues(mod: ModInfo): number[] {
    return mod.rolls.map((roll) => roll.min);
}

/**
 * The mod's concrete line(s): each ranged `(min-max)` token replaced by the author's
 * rolled value. Fixed rolls are already concrete in the text, so they pass through.
 */
export function renderModLines(mod: ModInfo, values: number[]): string[] {
    const ranged = rangedRollIndices(mod);
    let slot = 0;

    return mod.stats.map((line) =>
        line.replace(RANGE, () => {
            const rollIndex = ranged[slot++];
            const value = values[rollIndex] ?? mod.rolls[rollIndex]?.min ?? 0;

            return String(value);
        }),
    );
}

/** Any number token in a rendered line (signed, decimals kept). */
const NUMBER = /-?\d+(?:\.\d+)?/g;

/** Render a summed value: whole numbers plain, fractional ones to two decimals. */
function formatSum(value: number): string {
    return Number.isInteger(value)
        ? String(value)
        : String(Math.round(value * 100) / 100);
}

/**
 * Sum rendered mod lines that share the same wording into one line, as the game does on
 * the item tooltip: two "increased Armour and Evasion" lines become their total, two
 * "+to maximum Life" lines add up, and so on. Lines are grouped by their number-free
 * template (identical wording ⇒ same stat), and the numbers at each position are summed;
 * a line whose wording is unique passes through unchanged. First-seen order is kept.
 */
export function aggregateModLines(lines: string[]): string[] {
    const groups = new Map<string, number[]>();
    const order: string[] = [];

    for (const line of lines) {
        const template = line.replace(NUMBER, '#');
        const numbers = (line.match(NUMBER) ?? []).map(Number);
        const sums = groups.get(template);

        if (sums === undefined) {
            groups.set(template, numbers);
            order.push(template);
        } else {
            numbers.forEach((value, index) => {
                sums[index] = (sums[index] ?? 0) + value;
            });
        }
    }

    return order.map((template) => {
        const sums = groups.get(template) ?? [];
        let index = 0;

        return template.replace(/#/g, () => formatSum(sums[index++] ?? 0));
    });
}

/**
 * The mod's line(s) in the game's detailed (Alt-held) form: every ranged roll shown as
 * `value(min-max)`, e.g. `41(39-42)% increased Armour and Evasion`. Fixed rolls stay as
 * their plain number.
 */
export function renderModDetail(mod: ModInfo, values: number[]): string[] {
    return modDisplayLines(mod).map((tokens) =>
        tokens
            .map((token) =>
                token.kind === 'text'
                    ? token.text
                    : `${values[token.rollIndex] ?? token.min}(${token.min}-${token.max})`,
            )
            .join(''),
    );
}

/** The value slots the editor shows: one bounded input per ranged roll, in text order. */
export function modValueSlots(
    mod: ModInfo,
): Array<{ rollIndex: number; min: number; max: number }> {
    return rangedRollIndices(mod).map((rollIndex) => ({
        rollIndex,
        min: mod.rolls[rollIndex].min,
        max: mod.rolls[rollIndex].max,
    }));
}

/** Whether every rolled value sits inside its roll's range (one value per roll). */
export function modValuesValid(mod: ModInfo, values: number[]): boolean {
    if (values.length !== mod.rolls.length) {
        return false;
    }

    return mod.rolls.every((roll, index) => {
        const value = values[index];

        return value >= roll.min && value <= roll.max;
    });
}

/** A token in an editable mod line: literal text, or a bounded value input for one roll. */
export type ModToken =
    | { kind: 'text'; text: string }
    | { kind: 'value'; rollIndex: number; min: number; max: number };

/**
 * Split a mod's line(s) into text runs and value inputs for inline editing: each
 * `(min-max)` token becomes a `value` token bound to its ranged roll; everything else is
 * literal text (fixed rolls included, already concrete). Returns one token list per line.
 */
export function modDisplayLines(mod: ModInfo): ModToken[][] {
    const ranged = rangedRollIndices(mod);
    let slot = 0;

    return mod.stats.map((line) => {
        const tokens: ModToken[] = [];
        const regex = new RegExp(RANGE.source, 'g');
        let last = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
            if (match.index > last) {
                tokens.push({
                    kind: 'text',
                    text: line.slice(last, match.index),
                });
            }

            const rollIndex = ranged[slot++];
            tokens.push({
                kind: 'value',
                rollIndex,
                min: mod.rolls[rollIndex].min,
                max: mod.rolls[rollIndex].max,
            });
            last = match.index + match[0].length;
        }

        if (last < line.length) {
            tokens.push({ kind: 'text', text: line.slice(last) });
        }

        return tokens;
    });
}

/** The affix wording with every number blanked to `#`, for a stable tier-ladder label. */
export function previewModLabel(stats: string[]): string {
    return stats
        .join(', ')
        .replace(RANGE, '#')
        .replace(/-?\d+(?:\.\d+)?/g, '#');
}
