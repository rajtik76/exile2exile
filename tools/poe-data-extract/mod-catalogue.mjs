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

/**
 * PoE2's desecrated (Well of Souls) equipment mods live in their own mod domain,
 * number 28, which the extractor's PoE1-era enum table names "Unveiled". They are
 * ordinary prefixes/suffixes scoped by their spawn-weight tags (weapon, helmet, …);
 * they just never roll naturally - only desecration puts them on an item. They are
 * folded into the Item domain carrying `desecrated: true`, so the app can offer and
 * validate them while keeping them apart from natural affixes.
 */
const DESECRATED_DOMAIN = 'Unveiled';

/** The Mods stat foreign-key + value columns, paired (Stat1 -> Stat1Value, …). */
const STAT_SLOTS = [1, 2, 3, 4, 5, 6];

/**
 * Stats GGG stores per minute but describes per second (`per_minute_to_per_second*`
 * value handlers): flask charge gain, life/mana regeneration and the like. The
 * toolkit's renderer either skips those handlers (unknown `_2dp` variants leave the
 * raw per-minute roll: "Gains 15 Charges per Second") or misapplies them (the plain
 * variant divides by 100 and rounds: "1 Life Regeneration per second" for a 60-120
 * roll), so the rendered numbers are rebuilt from the raw rolls here.
 */
const PER_MINUTE_STAT = /_(?:every|per)_minute$/;

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
 * Rewrite per-minute rolls in rendered stat lines to the per-second display GGG's
 * own `per_minute_to_per_second*` handlers produce ("Gains 15 …" -> "Gains 0.25 …",
 * two decimals). The replacement values come from the RAW rolls, not the rendered
 * token - the renderer may have already mangled the token (its plain `per_minute`
 * handler divides by 100 and rounds), while the raw per-minute roll is exact. A shim
 * over the toolkit renderer; drop it once the renderer applies the handlers itself.
 * Number tokens are walked in text order, aligned one-to-one with `rawRolls` (the
 * same convention as {@link toDisplayRolls}); a roll only rewrites when its line
 * carries the per-second wording, and on a token-count mismatch the lines are
 * returned untouched.
 *
 * @param {string[]} stats  the rendered ranged line(s)
 * @param {Array<{stat: string, min: number, max: number}>} rawRolls  raw ranges, in text order
 * @returns {string[]}
 */
export function toPerSecondStats(stats, rawRolls) {
    if (!rawRolls.some((roll) => PER_MINUTE_STAT.test(roll.stat))) {
        return stats;
    }

    const tokenCount = stats.join(' ').match(ROLL_TOKEN)?.length ?? 0;

    if (tokenCount !== rawRolls.length) {
        return stats;
    }

    const perSecond = (value) => String(Math.round((Number(value) / 60) * 100) / 100);
    let index = 0;

    return stats.map((line) => line.replace(ROLL_TOKEN, (token) => {
        const roll = rawRolls[index++];

        if (!PER_MINUTE_STAT.test(roll.stat) || !/per second/i.test(line)) {
            return token;
        }

        const min = perSecond(roll.min);
        const max = perSecond(roll.max);

        return min === max ? min : `(${min}-${max})`;
    }));
}

/**
 * Map each essence-granted mod to the item classes its essence can put it on, from
 * the EssenceMods table (mod, display mod and outcome mods all count) joined through
 * EssenceTargetItemCategories to ItemClasses ids. Essence mods carry no positive
 * spawn weight - an essence targets item classes directly - so this list is the only
 * gate the app can apply.
 *
 * @param {Array<{TargetItemCategory?: number, Mod?: number, DisplayMod?: number, OutcomeMods?: number[]}>} essenceModRows
 * @param {Array<{Id?: string, ItemClasses?: number[]}>} categoryRows
 * @param {Array<{Id?: string}>} itemClassRows
 * @param {Array<{Id?: string}>} modRows
 * @returns {Record<string, string[]>} mod id => sorted item-class ids
 */
export function buildEssenceClasses(essenceModRows, categoryRows, itemClassRows, modRows) {
    /** @type {Record<string, Set<string>>} */
    const classesByMod = {};

    for (const row of essenceModRows) {
        const category = row.TargetItemCategory != null ? categoryRows[row.TargetItemCategory] : undefined;
        const classes = (category?.ItemClasses ?? [])
            .map((index) => itemClassRows[index]?.Id)
            .filter((id) => typeof id === 'string');

        for (const ref of [row.Mod, row.DisplayMod, ...(row.OutcomeMods ?? [])]) {
            const id = ref != null ? modRows[ref]?.Id : undefined;

            if (typeof id !== 'string' || id === '') {
                continue;
            }

            const set = (classesByMod[id] ??= new Set());
            classes.forEach((itemClass) => set.add(itemClass));
        }
    }

    return Object.fromEntries(
        Object.entries(classesByMod).map(([id, set]) => [id, [...set].sort()]),
    );
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
 * Beyond naturally rolling affixes the catalogue carries two craft-only groups: the
 * desecrated domain's mods (flagged `desecrated`, see {@link DESECRATED_DOMAIN}) and
 * essence-granted mods (flagged `essence`, gated by `itemClasses` from
 * {@link buildEssenceClasses} since their spawn weights are all zero).
 *
 * @param {Record<string, import('@poe2-toolkit/mod-extractor').Mod>} modData
 * @param {Record<string, string[]>} essenceClasses  mod id => item classes its essence targets
 * @returns {{mods: Array<{id: string, name: string, domain: string, group: string|null, type: 'prefix'|'suffix', tier: number|null, level: number, stats: string[], rolls: Array<{stat: string, min: number, max: number}>, families: string[], spawnWeights: Array<{tag: string, weight: number}>, desecrated: boolean, essence: boolean, itemClasses: string[]}>, skipped: string[]}}
 */
export function buildModCatalogue(modData, essenceClasses = {}) {
    const mods = [];
    const skipped = [];

    for (const [id, mod] of Object.entries(modData)) {
        const desecrated = mod.domain === DESECRATED_DOMAIN;

        if (!AFFIX_DOMAINS.has(mod.domain) && !desecrated) {
            continue;
        }

        if (mod.generationType !== 'Prefix' && mod.generationType !== 'Suffix') {
            continue;
        }

        const rawRolls = (mod.rolls ?? []).map((roll) => ({ stat: roll.stat, min: roll.min, max: roll.max }));
        // Per-minute rolls are rescaled to the per-second display first, so the
        // re-derived display ranges below match the text (and the game tooltip).
        const stats = toPerSecondStats(mod.stats ?? [], rawRolls);

        // A mod the stat-description renderer produced no line for is unusable: the
        // picker would show an empty row and the import could never match its text.
        // Skip it loudly rather than ship a valueless entry (the Contract suite
        // asserts every shipped mod carries a rendered line).
        if (stats.length === 0) {
            skipped.push(id);

            continue;
        }

        // Essences also grant naturally rolling mods (their outcome tiers); those stay
        // plain natural affixes. The essence flag marks only mods an essence is the sole
        // route to: referenced by EssenceMods and without any positive spawn weight.
        const spawnWeights = mod.spawnWeights ?? [];
        const essence = essenceClasses[id] !== undefined && !spawnWeights.some((gate) => gate.weight > 0);

        mods.push({
            id,
            name: mod.name ?? '',
            // Desecrated mods roll on ordinary equipment, so they join as Item mods.
            domain: desecrated ? 'Item' : mod.domain,
            group: mod.group ?? null,
            type: mod.generationType === 'Prefix' ? 'prefix' : 'suffix',
            tier: mod.tier ?? null,
            level: mod.level ?? 0,
            // The rendered ranged line(s), e.g. "(170-179)% increased Physical Damage".
            stats,
            // The numeric ranges behind each `(min-max)` token, in text order, so the
            // app can offer one bounded input per range and validate the author's roll.
            // Each roll keeps its `stat` id - the key the app groups on to sum same-stat
            // rolls across an item's mods into one displayed line, exactly as the game does.
            // Re-derived in display scale from the rendered stats (see toDisplayRolls):
            // the raw extractor ranges are the undivided stat values, which the app never
            // rescales, so a divided stat (leech, %-with-decimals) would mismatch its text.
            rolls: toDisplayRolls(stats, rawRolls),
            families: mod.families ?? [],
            spawnWeights,
            desecrated,
            essence,
            itemClasses: essence ? essenceClasses[id] : [],
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

    return { mods, skipped };
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
