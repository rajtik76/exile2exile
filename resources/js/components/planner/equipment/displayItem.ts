import type { Item, Rune } from '@/components/build/ItemDisplay';
import {
    aggregateModLines,
    renderModDetail,
    renderModLines,
} from '@/lib/modLines';
import type { ModMap } from '@/lib/modLines';
import { refKey } from '@/lib/planReferences';
import type { PlanReference, ReferenceMap } from '@/lib/planReferences';
import type { EQUIPMENT_SLOTS } from '@/types/planner';
import type { ItemPlan, RuneRef } from '@/types/planner';

export type SlotDef = (typeof EQUIPMENT_SLOTS)[number];

/** A blank item for a freshly opened slot. */
export function emptyItem(): ItemPlan {
    return {
        rarity: 'normal',
        base: null,
        name: '',
        corrupted: false,
        props: {
            quality: 0,
            armour: 0,
            evasion: 0,
            energyShield: 0,
            block: 0,
        },
        stats: [],
        sockets: [],
        priority: null,
    };
}

/** Whether an item carries anything worth keeping (requirements alone don't count). */
export function isEmptyItem(item: ItemPlan): boolean {
    return (
        item.base === null &&
        item.stats.length === 0 &&
        item.sockets.every((socket) => socket === null)
    );
}

/**
 * The item's filled rune sockets as display runes. Every filled socket renders (its
 * glyph comes from the name/id, so it shows even before the reference resolves); a
 * resolved reference just adds the icon and effects for the tooltip.
 */
export function resolveRunes(
    sockets: (RuneRef | null)[],
    map: ReferenceMap,
): Rune[] {
    return sockets
        .filter((socket): socket is RuneRef => socket !== null)
        .map((socket) => {
            const reference: PlanReference | undefined =
                map[refKey('rune', socket.id)];

            return {
                name: reference?.name ?? socket.id,
                icon: reference?.icon ?? null,
                levelRequirement: null,
                effects: reference?.tooltip
                    ? reference.tooltip
                          .split('\n')
                          .filter((line) => line.trim() !== '')
                    : [],
            };
        });
}

/** Adapt a planner item (plus live-resolved refs/mods) to the shared display Item shape. */
export function toDisplayItem(
    slot: SlotDef,
    item: ItemPlan,
    map: ReferenceMap,
    modMap: ModMap,
): Item {
    const baseRef = item.base
        ? map[refKey(item.base.type, item.base.id)]
        : undefined;

    // Author affixes paired with their resolved mod (unresolved ids drop out).
    const resolvedStats = item.stats.flatMap((stat) => {
        const mod = modMap[stat.modId];

        return mod ? [{ mod, values: stat.values }] : [];
    });

    return {
        slot: slot.key,
        rarity: item.rarity,
        name: item.name || baseRef?.name || slot.label,
        baseType: baseRef?.name ?? slot.label,
        icon: baseRef?.icon ?? null,
        twoHanded: baseRef?.twoHanded ?? false,
        corrupted: item.corrupted,
        // The item's authored defensive/quality properties (0 = hidden in the tooltip).
        quality: item.props.quality || null,
        armour: item.props.armour || null,
        evasion: item.props.evasion || null,
        energyShield: item.props.energyShield || null,
        block: item.props.block || null,
        runes: resolveRunes(item.sockets, map),
        emptySockets: item.sockets.filter((socket) => socket === null).length,
        // A base's own fixed implicit lines (read-only), from the resolved base ref.
        implicitMods: baseRef?.implicits ?? [],
        // Unique flavour/lore, shown italic at the foot of the tooltip.
        flavour: baseRef?.flavour ?? null,
        // Same-stat affixes are summed into one line, as the game shows them by default.
        explicitMods: aggregateModLines(
            resolvedStats.flatMap(({ mod, values }) =>
                renderModLines(mod, values),
            ),
        ),
        // The per-affix breakdown for the Alt-held detailed view.
        modDetails: resolvedStats.map(({ mod, values }) => ({
            type: mod.type,
            tier: mod.tier,
            lines: renderModDetail(mod, values),
        })),
    };
}
