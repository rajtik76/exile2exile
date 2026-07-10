import type { ModMap } from '@/lib/modLines';
import type { ItemPlan, ItemRarity, ItemStat } from '@/types/planner';

/**
 * An item's rarity - derived, never chosen. A unique base is Unique; otherwise the
 * prefix/suffix count decides: none is Normal, up to one of each is Magic, anything
 * beyond that is Rare. `lookup` resolves each stat to its mod (for the prefix/suffix
 * type); a mod missing from the map is ignored until it resolves.
 */
export function deriveRarity(
    base: ItemPlan['base'],
    stats: ItemStat[],
    lookup: ModMap,
): ItemRarity {
    if (base?.type === 'unique') {
        return 'unique';
    }

    let prefixes = 0;
    let suffixes = 0;

    for (const stat of stats) {
        const mod = lookup[stat.modId];

        if (mod?.type === 'prefix') {
            prefixes += 1;
        } else if (mod?.type === 'suffix') {
            suffixes += 1;
        }
    }

    if (prefixes === 0 && suffixes === 0) {
        return 'normal';
    }

    if (prefixes <= 1 && suffixes <= 1) {
        return 'magic';
    }

    return 'rare';
}
