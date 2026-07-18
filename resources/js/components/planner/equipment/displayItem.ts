import type { Item, Rune } from '@/components/build/ItemDisplay';
import { aggregateModLines } from '@/lib/modLines';
import { refKey } from '@/lib/planReferences';
import type {
    PlanReference,
    ReferenceMap,
    UniqueModLine,
} from '@/lib/planReferences';
import { renderUniqueModLine } from '@/lib/uniqueModLines';
import { weaponStatLines } from '@/lib/weaponStats';
import type { EQUIPMENT_SLOTS } from '@/types/planner';
import type { ItemPlan, RuneRef, UniqueModStat } from '@/types/planner';

export type SlotDef = (typeof EQUIPMENT_SLOTS)[number];

/** A blank item for a freshly opened slot. */
export function emptyItem(): ItemPlan {
    return {
        rarity: 'normal',
        base: null,
        name: '',
        corrupted: false,
        itemLevel: null,
        props: {
            quality: 0,
            armour: 0,
            evasion: 0,
            energyShield: 0,
            block: 0,
        },
        stats: [],
        uniqueMods: [],
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

/**
 * Render a unique's synced mod lines to display text, substituting a stored rolled value
 * by key where one exists and falling back to the line's own template (a range placeholder,
 * or static flavour text) otherwise - so an item with nothing rolled in yet still shows
 * exactly what it did before per-mod values existed.
 */
function renderUniqueLines(
    lines: UniqueModLine[],
    uniqueMods: UniqueModStat[],
): string[] {
    return lines.map((line) => {
        const stat = uniqueMods.find((entry) => entry.key === line.key);

        return stat ? renderUniqueModLine(line, stat.values) : line.template;
    });
}

/**
 * Adapt a bare unique reference - one named inline in plan notes text, with no equipped-
 * item context (no props/sockets/corrupted/rolled values, since those only exist on an
 * `ItemPlan` slot) - to the same display `Item` shape the paper-doll renders. This is what
 * lets a unique's text reference and its equipped tile share exactly one tooltip component
 * ({@see ItemTooltip}) instead of two different ones drifting apart over time. A ranged mod
 * line just shows its range placeholder - there is no rolled value to substitute here.
 */
export function referenceToDisplayItem(reference: PlanReference): Item {
    return {
        slot: '',
        rarity: 'unique',
        name: reference.name,
        baseType: reference.baseType ?? reference.name,
        icon: reference.icon ?? null,
        twoHanded: reference.twoHanded ?? false,
        runes: [],
        category: reference.category?.replace(/^Unique\s+/, '') ?? null,
        implicitMods: renderUniqueLines(reference.implicitLines ?? [], []),
        explicitMods: renderUniqueLines(reference.modLines ?? [], []),
        flavour: reference.flavour ?? null,
    };
}

/** Adapt a planner item (plus live-resolved references) to the shared display Item shape. */
export function toDisplayItem(
    slot: SlotDef,
    item: ItemPlan,
    map: ReferenceMap,
): Item {
    const baseRef = item.base
        ? map[refKey(item.base.type, item.base.id)]
        : undefined;

    return {
        slot: slot.key,
        rarity: item.rarity,
        name: item.name || baseRef?.name || slot.label,
        // For a unique this is its own synced base type (e.g. "Viper Cap"), shown as the
        // tooltip's subtitle under its name - same as the game's own unique tooltip. Falls
        // back to the unique's own name (pre-sync) so the title/subtitle split just quietly
        // collapses to "no subtitle" instead of showing a wrong or missing base.
        baseType:
            item.base?.type === 'unique'
                ? (baseRef?.baseType ?? baseRef?.name ?? slot.label)
                : (baseRef?.name ?? slot.label),
        icon: baseRef?.icon ?? null,
        twoHanded: baseRef?.twoHanded ?? false,
        corrupted: item.corrupted,
        itemLevel: item.itemLevel,
        // The GGPK item class (e.g. "Sceptre") - the game's own first tooltip line,
        // shown regardless of rarity. A unique reference's category carries a "Unique "
        // prefix (for its use elsewhere, e.g. RefChip text), stripped here to match.
        category: baseRef?.category?.replace(/^Unique\s+/, '') ?? null,
        // The item's authored defensive/quality properties (0 = hidden in the tooltip).
        quality: item.props.quality || null,
        armour: item.props.armour || null,
        evasion: item.props.evasion || null,
        energyShield: item.props.energyShield || null,
        block: item.props.block || null,
        // Derived weapon-stat lines (base row + local mods + quality) - same computation
        // the editor's "Weapon" section uses, so the read-only tooltip matches it exactly.
        weaponStats: weaponStatLines(baseRef, item),
        runes: resolveRunes(item.sockets, map),
        emptySockets: item.sockets.filter((socket) => socket === null).length,
        // A base's own fixed implicit lines (read-only), from the resolved base ref. For a
        // unique, its own synced implicit mods instead, with any stored rolled value
        // substituted in (see IconResolver::uniqueReference / UniqueModRow).
        implicitMods:
            item.base?.type === 'unique'
                ? renderUniqueLines(
                      baseRef?.implicitLines ?? [],
                      item.uniqueMods,
                  )
                : (baseRef?.implicits ?? []),
        // Unique flavour/lore, shown italic at the foot of the tooltip.
        flavour: baseRef?.flavour ?? null,
        // A unique's mods are fixed, not author-picked - rendered from its resolved
        // reference's synced mod lines (Path of Building), substituting a stored rolled
        // value where one exists. Same-stat affixes on a rare/magic item are summed into
        // one line, as the game shows them by default. A non-unique's mods are a frozen
        // snapshot taken at write time (see PlanItemSchema::canonicalMod) - `text` is
        // always present and is the sole source of truth for display, matched or not.
        explicitMods:
            item.base?.type === 'unique'
                ? renderUniqueLines(baseRef?.modLines ?? [], item.uniqueMods)
                : aggregateModLines(
                      item.stats.flatMap((stat) =>
                          (stat.text ?? '').split('\n'),
                      ),
                  ),
    };
}
