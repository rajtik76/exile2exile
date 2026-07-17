import { deriveRarity } from '@/lib/itemRarity';
import type { ModMap } from '@/lib/modLines';
import type { PlanReference } from '@/lib/planReferences';
import { MAX_ITEM_QUALITY } from '@/types/planner';
import type { ItemPlan, ItemProps, ItemStat } from '@/types/planner';

/**
 * Pure transforms and queries behind the slot editor: every edit of an
 * {@link ItemPlan} flows through these so the stored rarity always matches the
 * base and mods, and the affix rules (one mod per group, per-type caps, the
 * defence-field gating) live in one testable place.
 */

/**
 * The item with its invariants restored: mods grouped prefixes-first (stable
 * within each type) and the stored rarity re-derived from the base and mods.
 * Every editor mutation flows through this. `lookup` must already contain a
 * freshly picked mod (the editor folds it in before committing).
 */
export function normalizeItem(item: ItemPlan, lookup: ModMap): ItemPlan {
    const rank = (stat: ItemStat): number => {
        const type = lookup[stat.modId]?.type;

        return type === 'prefix' ? 0 : type === 'suffix' ? 1 : 2;
    };
    // Array.sort is stable, so mods keep their order within each affix type.
    const stats = [...item.stats].sort((a, b) => rank(a) - rank(b));

    return {
        ...item,
        stats,
        rarity: deriveRarity(item.base, stats, lookup),
    };
}

/**
 * The item with a new base/unique reference picked. A unique carries its own
 * modifiers, so any author mods are dropped on the pick. Any previously rolled
 * unique-mod values are dropped too - either they belonged to a different
 * unique (their keys won't match the new one) or the item is no longer a
 * unique at all. A defence value the new base doesn't have would otherwise
 * survive as a stale, now-hidden number (the editor gates its input out) with
 * no way to fix it - it is cleared the moment the base changes; unresolved
 * picks (no armour data yet) leave every value as-is.
 */
export function withBasePicked(
    item: ItemPlan,
    picked: PlanReference,
): ItemPlan {
    return {
        ...item,
        base: { type: picked.type as 'base' | 'unique', id: picked.id },
        stats: picked.type === 'unique' ? [] : item.stats,
        uniqueMods: [],
        props: picked.armour
            ? {
                  ...item.props,
                  armour: picked.armour.armour === 0 ? 0 : item.props.armour,
                  evasion: picked.armour.evasion === 0 ? 0 : item.props.evasion,
                  energyShield:
                      picked.armour.energyShield === 0
                          ? 0
                          : item.props.energyShield,
                  block: picked.armour.block === 0 ? 0 : item.props.block,
              }
            : item.props,
    };
}

/** The item with one unique-mod line's rolled value(s) set (replacing any prior). */
export function withUniqueModValues(
    item: ItemPlan,
    key: string,
    values: number[],
): ItemPlan {
    const rest = item.uniqueMods.filter((stat) => stat.key !== key);

    return { ...item, uniqueMods: [...rest, { key, values }] };
}

/** A property value clamped to its legal range: quality caps at {@link MAX_ITEM_QUALITY}; every property floors at 0. */
export function clampedProp(key: keyof ItemProps, value: number): number {
    return key === 'quality'
        ? Math.min(MAX_ITEM_QUALITY, Math.max(0, value))
        : Math.max(0, value);
}

/**
 * Affix groups already on the item - a group can hold only one mod, so the
 * picker hides any group already present (skipping `exceptIndex`, the row
 * being changed).
 */
export function groupsInUse(
    stats: ItemStat[],
    modMap: ModMap,
    exceptIndex?: number,
): string[] {
    return stats
        .filter((_, position) => position !== exceptIndex)
        .map((stat) => modMap[stat.modId]?.group)
        .filter((group): group is string => !!group);
}

/** Prefix/suffix counts across the item's resolved mods (unresolved ids don't count). */
export function countModTypes(
    stats: ItemStat[],
    modMap: ModMap,
    exceptIndex?: number,
): { prefix: number; suffix: number } {
    const counts = { prefix: 0, suffix: 0 };

    stats.forEach((stat, position) => {
        if (position === exceptIndex) {
            return;
        }

        const mod = modMap[stat.modId];

        if (mod) {
            counts[mod.type] += 1;
        }
    });

    return counts;
}

/**
 * Generation types already at their cap (e.g. 3 prefixes) - the picker hides
 * them so an over-cap mod can't be added. `exceptIndex` is the row being
 * changed, whose own type is freed for the swap.
 */
export function fullTypesInUse(
    stats: ItemStat[],
    modMap: ModMap,
    maxPerType: number,
    exceptIndex?: number,
): Array<'prefix' | 'suffix'> {
    const counts = countModTypes(stats, modMap, exceptIndex);

    return (['prefix', 'suffix'] as const).filter(
        (kind) => counts[kind] >= maxPerType,
    );
}

/**
 * The item's defensive/quality property fields. `defenceKey` gates a field
 * against the resolved base's own GGPK defensive stats: a base that's purely
 * Evasion (e.g. a dex-armour body armour) only shows the Evasion field,
 * matching how the game's own tooltip never shows a defence type the base
 * doesn't have. `shieldOnly` is the fallback for `block` when the base isn't
 * resolved yet (no GGPK data to gate on at all) - a category-name heuristic
 * (bucklers block; foci/quivers don't).
 */
export const PROP_FIELDS: Array<{
    key: keyof ItemProps;
    label: string;
    shieldOnly?: boolean;
    defenceKey?: 'armour' | 'evasion' | 'energyShield' | 'block';
}> = [
    { key: 'quality', label: 'Quality' },
    { key: 'armour', label: 'Armour', defenceKey: 'armour' },
    { key: 'evasion', label: 'Evasion', defenceKey: 'evasion' },
    {
        key: 'energyShield',
        label: 'Energy Shield',
        defenceKey: 'energyShield',
    },
    { key: 'block', label: 'Block', shieldOnly: true, defenceKey: 'block' },
];

/**
 * The property fields the editor shows for the resolved base: gated by the
 * base's own defensive stats when known, the shield heuristic for block when
 * not, everything else always visible.
 */
export function visiblePropFields(
    reference: PlanReference | undefined,
): typeof PROP_FIELDS {
    const baseArmour = reference?.armour ?? null;
    const isShield = /shield|buckler/i.test(reference?.category ?? '');

    return PROP_FIELDS.filter((field) => {
        if (field.defenceKey && baseArmour) {
            return baseArmour[field.defenceKey] !== 0;
        }

        if (field.shieldOnly) {
            return isShield;
        }

        return true;
    });
}
