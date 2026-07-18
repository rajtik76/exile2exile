import type { ItemMod, ItemPlan, ItemRarity } from '@/types/planner';

/**
 * An item's rarity - derived, never chosen. A unique base is Unique; otherwise each
 * stat's own frozen `type` (see {@link ItemMod}) decides: with every stat matched
 * (a known prefix/suffix), the exact count is exact - none is Normal, up to one of
 * each is Magic, anything beyond that is Rare. A stat with no `type` (unmatched
 * plain text) could be either, so once one is present the split can't be read
 * exactly - the total count alone still pins down 0 (Normal) and 3+ (Rare, past
 * Magic's 1 prefix + 1 suffix cap); 1-2 falls back to Magic, the overwhelmingly
 * common case (a 1-2 mod item deliberately built as Rare rather than Magic is rare
 * enough to not warrant an author-facing override for it).
 *
 * There is no fixed ceiling on the other end - a rune ("+1 Suffix Modifier allowed")
 * or a corruption can push a real Rare item's affix count past its base 3+3, so nothing
 * here rejects a high count.
 */
export function deriveRarity(
    base: ItemPlan['base'],
    stats: ItemMod[],
): ItemRarity {
    if (base?.type === 'unique') {
        return 'unique';
    }

    let prefixes = 0;
    let suffixes = 0;
    let unknown = 0;

    for (const stat of stats) {
        if (stat.type === 'prefix') {
            prefixes += 1;
        } else if (stat.type === 'suffix') {
            suffixes += 1;
        } else {
            unknown += 1;
        }
    }

    const total = prefixes + suffixes + unknown;

    if (total === 0) {
        return 'normal';
    }

    if (unknown === 0) {
        return prefixes <= 1 && suffixes <= 1 ? 'magic' : 'rare';
    }

    return total <= 2 ? 'magic' : 'rare';
}
