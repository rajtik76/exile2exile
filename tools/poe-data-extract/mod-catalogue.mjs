// Builds the equipment mod catalogue and base implicits from GGPK. Source of truth:
// GGPK only, via @poe2-toolkit/mod-extractor (which reads GGG's Mods table and renders
// each roll through GGG's own stat_descriptions.csd).
//
// The build planner lets an author give a planned item real modifiers. Rather than free
// text (which would never match GGG's wording), the author picks a real mod from this
// catalogue - a specific tier of a real affix - and rolls a concrete value in the tier's
// range. Each entry is one Mods.Id (a single tier), carrying its rendered ranged line(s),
// numeric ranges, prefix/suffix generation type, mutual-exclusion families and the
// spawn-weight gate the app joins to a base's tags.

import { renderBlock } from '@poe2-toolkit/ggpk';

/**
 * The mod domains the planner offers as explicit affixes: "Item" for worn equipment,
 * "Flask" for flasks and charms (they share the flask domain). The domain is the FIRST
 * gate the app joins on - a base only takes mods of its own `Item.modDomain`; the tag
 * gate is applied second (see the app's ModCatalogue). Mods from other domains (Monster,
 * Heist, Atlas, …) carry a positive default weight and would otherwise leak through the
 * tag gate alone, so the domain filter is not optional.
 */
const AFFIX_DOMAINS = new Set(['Item', 'Flask']);

/** The Mods stat foreign-key + value columns, paired (Stat1 -> Stat1Value, …). */
const STAT_SLOTS = [1, 2, 3, 4, 5, 6];

/**
 * A number token in a rendered stat line: a `(min-max)` range or a lone value.
 * Ranged is tried first so `(8-10)` and `(-5--3)` are read as one range, not two values.
 */
const ROLL_TOKEN = /\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)|(-?\d+(?:\.\d+)?)/g;

/**
 * Re-derive a mod's roll ranges in DISPLAY scale from its already-rendered `stats`.
 *
 * The extractor keeps `rolls` in the raw stat scale (e.g. leech `700`), while `stats`
 * are rendered through GGG's stat descriptions in display scale (e.g. `Leech (7-8)%`).
 * The app reads a roll's range and the author's rolled value in the same (display) scale
 * the text shows - it never applies the per-stat divisor - so a raw range breaks value
 * matching and the tier value inputs for any divided stat. The rendered numbers are the
 * source of truth for the display scale, so we read the ranges back out of the text: each
 * `(min-max)` token (or lone number for a fixed roll) in order, aligned one-to-one with
 * `rawRolls`. Each roll's `stat` id is preserved from `rawRolls` (only min/max are
 * rescaled). When the token count doesn't line up (flavour lines with no numbers, or
 * templates carrying a literal constant) the raw rolls are kept - those are scale-1 mods.
 *
 * @param {string[]} stats  the rendered ranged line(s)
 * @param {Array<{stat: string, min: number, max: number}>} rawRolls  the extractor's raw ranges, in text order
 * @returns {Array<{stat: string, min: number, max: number}>}
 */
export function toDisplayRolls(stats, rawRolls) {
    const text = stats.join(' ');
    const tokens = [];

    for (const match of text.matchAll(ROLL_TOKEN)) {
        tokens.push(
            match[1] !== undefined
                ? { min: Number(match[1]), max: Number(match[2]) }
                : { min: Number(match[3]), max: Number(match[3]) },
        );
    }

    if (tokens.length !== rawRolls.length) {
        return rawRolls;
    }

    // Keep each roll's stat id (the aggregation key); only min/max come from the text.
    return tokens.map((token, index) => ({ stat: rawRolls[index].stat, ...token }));
}

/**
 * Merge a min-rendered and max-rendered line into one: identical numbers collapse to
 * the plain value, differing ones become `(min-max)`. The two lines share a template,
 * so their numbers line up positionally.
 */
function mergeRangeLine(minLine, maxLine) {
    if (minLine === maxLine) {
        return minLine;
    }

    const maxNumbers = maxLine.match(/-?\d+/g) ?? [];
    let index = 0;

    return minLine.replace(/-?\d+/g, (low) => {
        const high = maxNumbers[index++] ?? low;

        return low === high ? low : `(${low}-${high})`;
    });
}

/**
 * Build the explicit-affix catalogue: every equipment/flask-domain prefix/suffix mod,
 * flattened from the extractor's ModData. Each entry carries its `domain` so the app can
 * join domain-first (a base only takes mods of its own `modDomain`), then group by
 * (group, type) into a tier ladder and filter by a base's tags via {@link Mod.spawnWeights}.
 *
 * @param {Record<string, import('@poe2-toolkit/mod-extractor').Mod>} modData
 * @returns {Array<{id: string, name: string, domain: string, group: string|null, type: 'prefix'|'suffix', tier: number|null, level: number, stats: string[], rolls: Array<{stat: string, min: number, max: number}>, families: string[], spawnWeights: Array<{tag: string, weight: number}>}>}
 */
export function buildModCatalogue(modData) {
    const mods = [];

    for (const [id, mod] of Object.entries(modData)) {
        if (!AFFIX_DOMAINS.has(mod.domain)) {
            continue;
        }

        if (mod.generationType !== 'Prefix' && mod.generationType !== 'Suffix') {
            continue;
        }

        mods.push({
            id,
            name: mod.name ?? '',
            domain: mod.domain,
            group: mod.group ?? null,
            type: mod.generationType === 'Prefix' ? 'prefix' : 'suffix',
            tier: mod.tier ?? null,
            level: mod.level ?? 0,
            // The rendered ranged line(s), e.g. "(170-179)% increased Physical Damage".
            stats: mod.stats ?? [],
            // The numeric ranges behind each `(min-max)` token, in text order, so the
            // app can offer one bounded input per range and validate the author's roll.
            // Each roll keeps its `stat` id - the key the app groups on to sum same-stat
            // rolls across an item's mods into one displayed line, exactly as the game does.
            // Re-derived in display scale from the rendered stats (see toDisplayRolls):
            // the raw extractor ranges are the undivided stat values, which the app never
            // rescales, so a divided stat (leech, %-with-decimals) would mismatch its text.
            rolls: toDisplayRolls(mod.stats ?? [], (mod.rolls ?? []).map((roll) => ({ stat: roll.stat, min: roll.min, max: roll.max }))),
            families: mod.families ?? [],
            spawnWeights: mod.spawnWeights ?? [],
        });
    }

    // Group then ascending tier: the app reads them as tier ladders.
    mods.sort((a, b) => {
        const group = (a.group ?? '').localeCompare(b.group ?? '');

        if (group !== 0) {
            return group;
        }

        if (a.type !== b.type) {
            return a.type.localeCompare(b.type);
        }

        return (a.tier ?? 0) - (b.tier ?? 0);
    });

    return mods;
}

/**
 * Resolve each base's implicit modifiers to rendered lines, keyed by base display name.
 *
 * A base's implicits live in `BaseItemTypes.Implicit_Mods` as row indices into the Mods
 * table. Unlike its prefix/suffix affixes, an implicit is a fixed `Unique`-generation mod
 * the mod-extractor does not render, so we render it here from GGG's own stat descriptions:
 * each mod's stats (`Stat1..6` -> `Stats.Id`) and their `[min, max]` values (`Stat1Value..6`)
 * go through {@link renderBlock}; a min-pass and a max-pass are merged so a ranged implicit
 * shows `(min-max)` and a fixed one a plain number. Implicits are the base's own mods - the
 * author does not edit them - so the app shows them read-only above the explicit affixes.
 *
 * @param {import('@poe2-toolkit/ggpk').StatIndex} statIndex  parsed stat_descriptions.csd
 * @param {Array<{Name?: string, Implicit_Mods?: number[]}>} baseRows  BaseItemTypes rows (extract.mjs output)
 * @param {Array<Record<string, unknown>>} modRows  Mods rows (extract.mjs output), index-aligned with Implicit_Mods
 * @param {Array<{Id?: string}>} statRows  Stats rows (extract.mjs output), index-aligned with a mod's Stat1..6
 * @returns {{implicits: Record<string, string[]>, unresolved: number}}
 */
export function buildBaseImplicits(statIndex, baseRows, modRows, statRows) {
    /** @type {Record<string, string[]>} */
    const implicits = {};
    let unresolved = 0;

    for (const base of baseRows) {
        const name = typeof base.Name === 'string' ? base.Name : '';
        const refs = Array.isArray(base.Implicit_Mods) ? base.Implicit_Mods : [];

        if (name === '' || refs.length === 0 || implicits[name] !== undefined) {
            continue;
        }

        const lines = [];

        for (const ref of refs) {
            const mod = modRows[ref];

            if (mod === undefined) {
                unresolved += 1;

                continue;
            }

            const statIds = [];
            const mins = [];
            const maxs = [];

            for (const slot of STAT_SLOTS) {
                const statIndexRef = mod[`Stat${slot}`];
                const statId = statIndexRef != null ? statRows[statIndexRef]?.Id : null;

                if (typeof statId !== 'string' || statId === '') {
                    continue;
                }

                const value = mod[`Stat${slot}Value`];
                const [min, max] = Array.isArray(value)
                    ? [value[0] ?? 0, value[1] ?? value[0] ?? 0]
                    : [value ?? 0, value ?? 0];

                statIds.push(statId);
                mins.push(min);
                maxs.push(max);
            }

            if (statIds.length === 0) {
                continue;
            }

            const low = renderBlock(statIndex, statIds, mins).lines;
            const high = renderBlock(statIndex, statIds, maxs).lines;

            if (low.length === 0) {
                unresolved += 1;

                continue;
            }

            low.forEach((line, index) => lines.push(mergeRangeLine(line, high[index] ?? line)));
        }

        if (lines.length > 0) {
            implicits[name] = lines;
        }
    }

    return { implicits, unresolved };
}
