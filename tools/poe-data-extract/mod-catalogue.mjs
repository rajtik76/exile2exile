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
 * The `HandWraps*` mod family (elemental "gained as extra" damage, onslaught chance,
 * crit chance, resistances, attributes, life/mana, local defenses, leech, rarity) is
 * GGG's affix pool for Runeforged gloves - confirmed against a real Runeforged Fists
 * of Stone item (PoB headless import, all 9 disputed lines `recognised=true`) and
 * against PoB's own ModItem.lua, which matches this exact family by text. Every tier
 * carries `SpawnWeight_Tags: [0], SpawnWeight_Values: [0]` in the GGPK export - GGG
 * ships the pool with zero natural weight everywhere, the same data PoB itself sees
 * (its `weightVal = {0}`), and PoB never applies the weight gate on import (it parses
 * item text against the full ModItem.lua dictionary regardless of weight). Nothing in
 * the extracted tables (SpawnWeight_Tags/Values, GenerationWeights, EssenceMods,
 * Expedition2*, .it metadata) ties the family to a base by any other route.
 *
 * This is a curated, hand-verified exception to "mod values are GGPK-only": only the
 * pool -> base ASSOCIATION is manual here (GGPK carries none), every roll range and
 * rendered line still comes straight from GGPK. The `runeforged` tag already exists on
 * the affected bases (e.g. Runeforged Fists of Stone carries GGPK tag `runeforged`
 * alongside its normal `gloves` tag) and is otherwise unused as a mod gate, so mods are
 * synthetically granted a positive weight on that tag - reusing the app's existing
 * tag-gate join instead of adding a new flag/field the picker and the import matcher
 * would both need to learn about.
 *
 * The tag alone is not enough: `runeforged` is shared across every equipment class
 * (Runeforged Rusted Cuirass, a body armour, carries it too - see
 * Expedition2VerisiumCrafts, which converts ordinary bases of any class to their
 * Runeforged counterpart via Verisium). A base's `spawnWeights` tags are matched as
 * an OR (ModCatalogue::canRollOn(), app side) - any one shared positive-weight tag
 * makes a mod eligible - so a bare `runeforged` weight would let this glove-only pool
 * (HandWraps* = the hand-wraps/unarmed namespace) leak onto Runeforged body armour,
 * rings, etc. Each entry also carries `itemClasses: ['Gloves']`; ModCatalogue::canRollOn()
 * ANDs a non-empty itemClasses list against the base's own item class on top of the tag
 * match (generalised from the essence-only path to apply to any positively-weighted mod).
 *

 * Excluded from this pool (each is its own mechanism, not a runeforged-gloves affix):
 * `HandWrapsAbyssMod*` (Abyss jewel socket mods), `HandWrapsDecayInfluence*` (Decay
 * influence), `HandWrapsMarksmanInfluence*` (Marksman ascendancy influence),
 * `HandWrapsUnique*`/other `Unique`-generation entries (unique-item-only or base
 * implicits, never craftable affixes), and `HandWrapsEssence*` (a separate craft-only
 * bucket, already handled by the `essence` flag above).
 */
const RUNEFORGED_TAG = 'runeforged';
const RUNEFORGED_HANDWRAPS_EXCLUDE_PREFIX = [
    'HandWrapsAbyssMod',
    'HandWrapsDecayInfluence',
    'HandWrapsMarksmanInfluence',
    'HandWrapsUnique',
];
const RUNEFORGED_HANDWRAPS_EXCLUDE_ID = new Set([
    'HandWrapsAddedLightningDamageWhileUnarmedUniqueGloves_1',
    'HandWrapsBaseUnarmedCriticalStrikeChanceUnique__2',
    'HandWrapsDemigodIncreasedSkillSpeed1',
    'HandWrapsImplicitLocalBaseEvasionAndEnergyShieldPerLevel',
    'HandWrapsImplicitLocalBaseEvasionEnergyShieldAndWardPerLevel',
    'HandWrapsImplicitLocalCopyPlayerLevelValue',
    'HandWrapsThunderfistUnique__1',
    'HandWrapsEssenceGoldDropped1',
    'HandWrapsEssenceLightningRecoupLife1',
    'HandWrapsEssenceLocalRuneAndSoulCoreEffect1',
]);

/**
 * True for a `HandWraps*` mod id that belongs to the curated runeforged-gloves pool
 * (see {@link RUNEFORGED_TAG} above) - i.e. it should be granted a synthetic positive
 * weight on the `runeforged` tag rather than left at its native zero weight.
 *
 * @param {string} id
 * @returns {boolean}
 */
function isRuneforgedHandWrapsMod(id) {
    if (!id.startsWith('HandWraps')) {
        return false;
    }

    if (RUNEFORGED_HANDWRAPS_EXCLUDE_PREFIX.some((prefix) => id.startsWith(prefix))) {
        return false;
    }

    return !RUNEFORGED_HANDWRAPS_EXCLUDE_ID.has(id);
}

/**
 * The `Alloy*` mod family turned out to need no overlay at all: it is a
 * Verisium-crafted mechanism (its own P0/S0 tier slot, confirmed against real
 * trade listings - `item-mod--crafted` CSS class, a "Verisium"/"of the Stars"
 * affix label with "(Crafted)" - and NOT tied to the Runeforged base mechanism
 * despite the shared currency name), but 48 of its 51 ids are independently
 * referenced by `EssenceMods` and already flow through the existing `essence`
 * flag / {@link buildEssenceClasses} itemClasses gate below - no Alloy-specific
 * code needed. That essence-sourced scoping was spot-checked against 4 mods
 * verified on real trade listings (Wand, Staff, Helmet, and the One Hand Mace/
 * Spear/Talisman subset of the essence-granted Weapons category) and matched
 * exactly, so it is trustworthy for the rest of the family too.
 *
 * `AlloyLocalWardIncreasePercent2` is patched in here: it shares both `ModType`
 * and `Families` with `AlloyLocalWardIncreasePercent1` (an essence-covered id) -
 * a tier-ladder relationship, the same kind every other mod family's tiers
 * already share, not a guess.
 */
const ALLOY_TIER_SIBLING_ITEM_CLASSES = {
    AlloyLocalWardIncreasePercent2: 'AlloyLocalWardIncreasePercent1',
};

/**
 * The last two `Alloy*` ids had no essence reference and no tier sibling to
 * inherit from, so they are patched in directly from a real trade listing:
 * `AlloySpiritPresenceAreaOfEffectHybrid1` -> Body Armour ("increased Presence
 * Area of Effect", S0, "of the Stars (>=25, Crafted)"); `AlloyManaNearbyAllyAttackSpeedHybrid1`
 * -> Ring ("increased Attack Speed", S0, "of the Stars (>=45, Crafted)"). The
 * latter needed care: the same rendered stat text ("increased Attack Speed")
 * also belongs to an unrelated Jewel-only crafted mod ("of Alacrity", S1, no
 * "(>=45)" gate) on real listings - confirmed distinct by affix name, not by
 * matching the rendered stat text (which both mods share).
 */
const ALLOY_VERIFIED_ITEM_CLASSES = {
    AlloySpiritPresenceAreaOfEffectHybrid1: ['Body Armour'],
    AlloyManaNearbyAllyAttackSpeedHybrid1: ['Ring'],
};

/**
 * A handful of otherwise-signal-less mods (zero-weight everywhere, no itemClasses,
 * no route through essence/tier-sibling/runeforged) verified individually against
 * real trade listings (pathofexile.com/trade2, Stat Filter search on the exact
 * rendered wording with numeric tokens replaced by `#`). Only the class actually
 * seen on a live listing is recorded - no inference to sibling classes. Each is
 * granted a synthetic positive weight on the GGPK tag its confirmed class already
 * carries naturally (`warstaff`/`belt`/`jewel` - see `resources/poe2/ggpk/items.json`
 * `tags`), the same mechanism {@link RUNEFORGED_TAG} uses; `itemClasses` is kept
 * alongside it for explicitness even though these tags are already class-specific
 * (unlike the cross-slot `runeforged` tag, so it is not load-bearing here).
 *
 * Each entry below is `id: [[itemClass, tag], ...]` - a list of class/tag pairs,
 * one per class the trade listing confirmed (usually one), grouped by the trade
 * listing that confirmed it:
 *
 * - "Leeches #% of Physical Damage as Life" (`LifeLeechPermyriadLocalEssence1..7`,
 *   identical wording across all 7 tiers) -> Warstaff (trade UI label "Quarterstaff").
 * - "Leech Life #% faster" (`IncreasedLifeLeechRateEssence1`) -> Belt (not the
 *   `decay` tag a stat-FK co-occurrence guess had suggested - that guess was wrong).
 * - "#% increased Effect of your Mark Skills" (`MarkEffectEssence1`) -> Jewel (not
 *   the `marksman` tag a stat-FK co-occurrence guess had suggested - also wrong).
 * - "#% increased Flask Life/Mana Recovery rate" (`BeltFlaskLifeRecoveryRateEssence1..7`,
 *   `BeltFlaskManaRecoveryRateEssence1..3`) -> Belt. A FIRST verification pass without
 *   the `#` placeholder had mismatched the trade Stat Filter's autocomplete to an
 *   unrelated option and wrongly read this as "Body Armour" - PoE2 trade replaces
 *   numeric tokens with a literal `#` in the filter search text, a plain number never
 *   matches; re-run with `#` confirms the original stat-FK `belt` guess was right.
 * - "Damage Penetrates #% Cold/Fire/Lightning Resistance" (`ColdResistancePenetrationEssence*`,
 *   `ColdResistancePenetrationTwoHandEssence*`, `ColdResistancePenetrationWarbands`,
 *   and the Fire/Lightning equivalents) -> Jewel in all three elements, not the
 *   `gloves` tag a stat-FK co-occurrence guess had suggested.
 * - "# Life/Mana gained when you Block" (`GainLifeOnBlock1..6`, `GainManaOnBlock1..4`)
 *   -> Shield, confirmed on Shield and Buckler (a Shield subtype) listings - matches
 *   the `shield` tag a stat-FK co-occurrence guess had suggested.
 * - "# to Level of all Chaos/Cold/Fire/Lightning/Physical Spell Skills"
 *   (`GlobalChaosSpellGemsLevel1..3`, `GlobalColdSpellGemsLevel1..3`,
 *   `GlobalFireSpellGemsLevel1..3`, `GlobalLightningSpellGemsLevel1..3`,
 *   `GlobalPhysicalSpellGemsLevel1..3`) -> both Wand AND Staff for every element
 *   (each queried separately with the `Item Category` trade filter, not inferred
 *   from one element to the rest) - matches the `wand`/`staff` tags a stat-FK
 *   co-occurrence guess had suggested.
 * - "Hits against you have #% reduced Critical Damage Bonus"
 *   (`HandWrapsMarksmanInfluenceCriticalHitChance1..3`) -> Shield (specifically the
 *   `str_dex_shield`-tagged "Targe" shield bases), confirmed on a live listing -
 *   matches the `str_dex_shield` tag a stat-FK co-occurrence guess had suggested.
 *   Despite the `HandWraps...MarksmanInfluence` id prefix (normally the excluded
 *   Marksman-ascendancy-influence mechanism, see {@link RUNEFORGED_HANDWRAPS_EXCLUDE_PREFIX}),
 *   this family's own donors (`ReducedExtraDamageFromCrits1..5`) are unrelated,
 *   unambiguous, real-weight Shield mods - the shared id prefix is coincidental
 *   naming, not evidence of the Marksman mechanism.
 * - "Leech #% of Physical Attack Damage as Life" (`HandWrapsDecayInfluenceLeechAmount1`)
 *   -> Gloves AND Ring, both confirmed on live listings with an explicit tier-tagged
 *   mod line (not just header stats) - Belt and Boots were checked and ruled out
 *   (0 results), Amulet too. Despite the `HandWraps...DecayInfluence` id prefix
 *   (normally the excluded Decay-influence mechanism, see
 *   {@link RUNEFORGED_HANDWRAPS_EXCLUDE_PREFIX}), same reasoning as the Marksman
 *   case above - the shared prefix is coincidental naming.
 */
const TRADE_VERIFIED_SOURCE = {
    LifeLeechPermyriadLocalEssence1: [['Warstaff', 'warstaff']],
    LifeLeechPermyriadLocalEssence2: [['Warstaff', 'warstaff']],
    LifeLeechPermyriadLocalEssence3: [['Warstaff', 'warstaff']],
    LifeLeechPermyriadLocalEssence4: [['Warstaff', 'warstaff']],
    LifeLeechPermyriadLocalEssence5: [['Warstaff', 'warstaff']],
    LifeLeechPermyriadLocalEssence6: [['Warstaff', 'warstaff']],
    LifeLeechPermyriadLocalEssence7: [['Warstaff', 'warstaff']],
    IncreasedLifeLeechRateEssence1: [['Belt', 'belt']],
    MarkEffectEssence1: [['Jewel', 'jewel']],
    BeltFlaskLifeRecoveryRateEssence1: [['Belt', 'belt']],
    BeltFlaskLifeRecoveryRateEssence2: [['Belt', 'belt']],
    BeltFlaskLifeRecoveryRateEssence3: [['Belt', 'belt']],
    BeltFlaskLifeRecoveryRateEssence4: [['Belt', 'belt']],
    BeltFlaskLifeRecoveryRateEssence5: [['Belt', 'belt']],
    BeltFlaskLifeRecoveryRateEssence6: [['Belt', 'belt']],
    BeltFlaskLifeRecoveryRateEssence7: [['Belt', 'belt']],
    BeltFlaskManaRecoveryRateEssence1: [['Belt', 'belt']],
    BeltFlaskManaRecoveryRateEssence2: [['Belt', 'belt']],
    BeltFlaskManaRecoveryRateEssence3: [['Belt', 'belt']],
    ColdResistancePenetrationEssence1: [['Jewel', 'jewel']],
    ColdResistancePenetrationEssence2: [['Jewel', 'jewel']],
    ColdResistancePenetrationEssence3: [['Jewel', 'jewel']],
    ColdResistancePenetrationEssence4_: [['Jewel', 'jewel']],
    ColdResistancePenetrationEssence5: [['Jewel', 'jewel']],
    ColdResistancePenetrationEssence6_: [['Jewel', 'jewel']],
    ColdResistancePenetrationTwoHandEssence1: [['Jewel', 'jewel']],
    ColdResistancePenetrationTwoHandEssence2: [['Jewel', 'jewel']],
    ColdResistancePenetrationTwoHandEssence3: [['Jewel', 'jewel']],
    ColdResistancePenetrationTwoHandEssence4: [['Jewel', 'jewel']],
    ColdResistancePenetrationTwoHandEssence5: [['Jewel', 'jewel']],
    ColdResistancePenetrationTwoHandEssence6__: [['Jewel', 'jewel']],
    ColdResistancePenetrationWarbands: [['Jewel', 'jewel']],
    FireResistancePenetrationEssence1: [['Jewel', 'jewel']],
    FireResistancePenetrationEssence2: [['Jewel', 'jewel']],
    FireResistancePenetrationEssence3: [['Jewel', 'jewel']],
    FireResistancePenetrationEssence4___: [['Jewel', 'jewel']],
    FireResistancePenetrationEssence5: [['Jewel', 'jewel']],
    FireResistancePenetrationTwoHandEssence1: [['Jewel', 'jewel']],
    FireResistancePenetrationTwoHandEssence2_: [['Jewel', 'jewel']],
    FireResistancePenetrationTwoHandEssence3: [['Jewel', 'jewel']],
    FireResistancePenetrationTwoHandEssence4: [['Jewel', 'jewel']],
    FireResistancePenetrationTwoHandEssence5: [['Jewel', 'jewel']],
    FireResistancePenetrationWarbands: [['Jewel', 'jewel']],
    LightningResistancePenetrationEssence1_: [['Jewel', 'jewel']],
    LightningResistancePenetrationEssence2: [['Jewel', 'jewel']],
    LightningResistancePenetrationEssence3: [['Jewel', 'jewel']],
    LightningResistancePenetrationEssence4: [['Jewel', 'jewel']],
    LightningResistancePenetrationTwoHandEssence1_: [['Jewel', 'jewel']],
    LightningResistancePenetrationTwoHandEssence2: [['Jewel', 'jewel']],
    LightningResistancePenetrationTwoHandEssence3_: [['Jewel', 'jewel']],
    LightningResistancePenetrationTwoHandEssence4: [['Jewel', 'jewel']],
    LightningPenetrationWarbands: [['Jewel', 'jewel']],
    GainLifeOnBlock1: [['Shield', 'shield']],
    GainLifeOnBlock2_: [['Shield', 'shield']],
    GainLifeOnBlock3: [['Shield', 'shield']],
    GainLifeOnBlock4: [['Shield', 'shield']],
    GainLifeOnBlock5: [['Shield', 'shield']],
    GainLifeOnBlock6_: [['Shield', 'shield']],
    GainManaOnBlock1: [['Shield', 'shield']],
    GainManaOnBlock2: [['Shield', 'shield']],
    GainManaOnBlock3: [['Shield', 'shield']],
    GainManaOnBlock4: [['Shield', 'shield']],
    GlobalChaosSpellGemsLevel1: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalChaosSpellGemsLevel2: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalChaosSpellGemsLevel3: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalColdSpellGemsLevel1_: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalColdSpellGemsLevel2: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalColdSpellGemsLevel3: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalFireSpellGemsLevel1_: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalFireSpellGemsLevel2: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalFireSpellGemsLevel3: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalLightningSpellGemsLevel1: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalLightningSpellGemsLevel2: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalLightningSpellGemsLevel3: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalPhysicalSpellGemsLevel1: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalPhysicalSpellGemsLevel2: [['Wand', 'wand'], ['Staff', 'staff']],
    GlobalPhysicalSpellGemsLevel3: [['Wand', 'wand'], ['Staff', 'staff']],
    HandWrapsMarksmanInfluenceCriticalHitChance1: [['Shield', 'str_dex_shield']],
    HandWrapsMarksmanInfluenceCriticalHitChance2: [['Shield', 'str_dex_shield']],
    HandWrapsMarksmanInfluenceCriticalHitChance3: [['Shield', 'str_dex_shield']],
    HandWrapsDecayInfluenceLeechAmount1: [['Gloves', 'gloves'], ['Ring', 'ring']],
};
const TRADE_VERIFIED = Object.fromEntries(
    Object.entries(TRADE_VERIFIED_SOURCE).map(([id, pairs]) => [
        id,
        { itemClasses: pairs.map(([itemClass]) => itemClass), tags: pairs.map(([, tag]) => tag) },
    ]),
);

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
 * {@link buildEssenceClasses} since their spawn weights are all zero). The Verisium-
 * crafted `Alloy*` family (see {@link ALLOY_TIER_SIBLING_ITEM_CLASSES} above) rides
 * the same essence `itemClasses` gate without its own flag - see that comment for why.
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
        // The curated runeforged-gloves pool (see RUNEFORGED_TAG above) gets a synthetic
        // positive weight on the runeforged tag injected here, before the essence check,
        // so it joins the picker/import tag gate exactly like a naturally-weighted mod.
        // Prepended, not appended: the app's matchingWeight() takes the FIRST spawnWeight
        // entry whose tag the base carries (GGG's own first-match semantics), and every
        // native HandWraps* entry already starts with an unconditional `{tag: "default",
        // weight: 0}` - appended after it, the injected runeforged weight would never be
        // reached.
        const spawnWeights = isRuneforgedHandWrapsMod(id)
            ? [{ tag: RUNEFORGED_TAG, weight: 1 }, ...(mod.spawnWeights ?? [])]
            : TRADE_VERIFIED[id]
                ? [...TRADE_VERIFIED[id].tags.map((tag) => ({ tag, weight: 1 })), ...(mod.spawnWeights ?? [])]
                : (mod.spawnWeights ?? []);
        const essence = essenceClasses[id] !== undefined && !spawnWeights.some((gate) => gate.weight > 0);
        // The one Alloy tier-sibling patch (see ALLOY_TIER_SIBLING_ITEM_CLASSES above):
        // inherits its essence-sourced itemClasses from its covered tier-1 sibling.
        const tierSiblingId = ALLOY_TIER_SIBLING_ITEM_CLASSES[id];
        const tierSiblingItemClasses = tierSiblingId ? (essenceClasses[tierSiblingId] ?? []) : [];

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
            // Empty means "no class restriction, tag match alone decides" - the app
            // ANDs this against the base's item class only when non-empty. Unioned
            // rather than picked exclusively: a mod can be reachable through more than
            // one route at once (essence, the runeforged-gloves overlay, a tier-sibling
            // patch), and restricting to just one route's list would silently drop
            // items only reachable through another.
            itemClasses: [...new Set([
                ...(essence ? essenceClasses[id] : []),
                ...tierSiblingItemClasses,
                ...(ALLOY_VERIFIED_ITEM_CLASSES[id] ?? []),
                ...(TRADE_VERIFIED[id]?.itemClasses ?? []),
                ...(isRuneforgedHandWrapsMod(id) ? ['Gloves'] : []),
            ])],
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
