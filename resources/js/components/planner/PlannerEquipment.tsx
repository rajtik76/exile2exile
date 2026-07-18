import { useState } from 'react';
import { dismissPinnedTooltip, SlotTile } from '@/components/build/ItemDisplay';
import {
    emptyItem,
    isEmptyItem,
    toDisplayItem,
} from '@/components/planner/equipment/displayItem';
import type { SlotDef } from '@/components/planner/equipment/displayItem';
import PrioritySelector from '@/components/planner/equipment/PrioritySelector';
import PriorityStrip from '@/components/planner/equipment/PriorityStrip';
import SlotEditor from '@/components/planner/equipment/SlotEditor';
import { useReferences } from '@/components/planner/ReferencesContext';
import ScaleToFit from '@/components/planner/ScaleToFit';
import { refKey } from '@/lib/planReferences';
import { cn } from '@/lib/utils';
import { EQUIPMENT_SLOTS, WEAPON_SWAP_SLOTS } from '@/types/planner';
import type { ItemPlan } from '@/types/planner';

/**
 * A pill sitting just above a weapon/off-hand tile that swaps the whole doll between
 * its main and swap weapon pairs. Rendered twice - once per column - so either hand
 * can trigger the switch without reaching across the doll.
 */
function WeaponSetToggle({
    active,
    onChange,
}: {
    active: boolean;
    onChange: (active: boolean) => void;
}) {
    return (
        <div className="absolute -top-2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-full overflow-hidden rounded-full bg-[var(--pl-panel)] shadow-[inset_0_0_0_1.5px_var(--pl-panel-border),0_1px_4px_rgba(0,0,0,0.5)]">
            {(['main', 'swap'] as const).map((value) => (
                <button
                    key={value}
                    type="button"
                    title={
                        value === 'main' ? 'Main weapon set' : 'Swap weapon set'
                    }
                    onClick={() => onChange(value === 'swap')}
                    className={cn(
                        'pl-text-xs flex size-5 items-center justify-center font-bold transition-colors',
                        (active ? 'swap' : 'main') === value
                            ? 'bg-[var(--pl-accent-lit)] text-[var(--pl-panel)]'
                            : 'text-[var(--pl-muted)] hover:text-[var(--pl-accent-lit)]',
                    )}
                >
                    {value === 'main' ? 'I' : 'II'}
                </button>
            ))}
        </div>
    );
}

/**
 * The items paper-doll: a grid of equipment slots the author
 * fills. Each slot holds a full PoB-style item - a rarity, a GGPK base/unique (its
 * icon + implicits), attribute requirements, real GGPK affixes rolled to a value, and
 * rune sockets - edited in a modal. Only the base/unique ref, rune refs and mod ids are
 * stored; icons, wording and ranges all resolve live.
 */
export default function PlannerEquipment({
    slots,
    editable,
    onChange,
}: {
    slots: Record<string, ItemPlan>;
    editable: boolean;
    onChange?: (slots: Record<string, ItemPlan>) => void;
}) {
    const { map } = useReferences();
    const [openSlot, setOpenSlot] = useState<string | null>(null);
    // The slot whose priority-strip miniature is hovered - its paper-doll tile lights up.
    const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
    // Which weapon pair the doll shows/edits right now - the swap set is stored under
    // its own slot keys (weapon1swap/weapon2swap) but never rendered alongside the
    // primary pair, so a toggle switches the same two grid cells between them.
    const [swapActive, setSwapActive] = useState(false);

    const [weapon1Slot, weapon2Slot] = swapActive
        ? WEAPON_SWAP_SLOTS
        : EQUIPMENT_SLOTS.filter(
              (slot): boolean =>
                  slot.key === 'weapon1' || slot.key === 'weapon2',
          );

    // Switching weapon sets swaps which slot key the same grid cell renders
    // (weapon1 <-> weapon1swap) - an editor left open on one of THOSE two cells would
    // either vanish (its cell no longer matches `openSlot`) or, worse, silently
    // reappear if the author toggles back, so it closes with the switch. An editor
    // open on an unrelated slot (e.g. helmet) is untouched.
    function setSwapActiveAndCloseEditor(active: boolean): void {
        setSwapActive(active);
        setOpenSlot((open) =>
            open === weapon1Slot.key || open === weapon2Slot.key ? null : open,
        );
    }

    function setItem(slotKey: string, item: ItemPlan): void {
        onChange?.({ ...slots, [slotKey]: item });
    }

    function clearSlot(slotKey: string): void {
        const next = { ...slots };
        delete next[slotKey];
        onChange?.(next);
        setOpenSlot(null);
    }

    // A two-handed main weapon claims the off-hand: it can't be edited, and shows a
    // dimmed ghost of the weapon when empty (as the game does). Checked per weapon set -
    // the primary and swap pairs are independent, so a two-hander in one doesn't block
    // the other's off-hand.
    function isTwoHanded(item?: ItemPlan): boolean {
        const ref = item?.base
            ? map[refKey(item.base.type, item.base.id)]
            : undefined;

        return ref?.twoHanded ?? false;
    }

    const mainWeapon = slots[weapon1Slot.key];
    const offhandBlocked = isTwoHanded(mainWeapon);
    const primaryOffhandBlocked = isTwoHanded(slots.weapon1);
    const swapOffhandBlocked = isTwoHanded(slots.weapon1swap);

    /** One paper-doll cell: its item, editor and priority controls. */
    function renderSlot(slot: SlotDef): React.ReactNode {
        const item = slots[slot.key];
        const blocked = slot.key === weapon2Slot.key && offhandBlocked;
        const ghostItem =
            blocked && mainWeapon && (!item || isEmptyItem(item))
                ? toDisplayItem(slot, mainWeapon, map)
                : null;

        return (
            <div
                key={slot.key}
                // Charms sit inside the shared flex wrapper below; every other slot
                // is placed directly on the grid.
                style={
                    slot.trinket
                        ? undefined
                        : { gridColumn: slot.column, gridRow: slot.row }
                }
                className="relative"
            >
                {(slot.key === weapon1Slot.key ||
                    slot.key === weapon2Slot.key) && (
                    <WeaponSetToggle
                        active={swapActive}
                        onChange={setSwapActiveAndCloseEditor}
                    />
                )}

                <SlotTile
                    slot={slot.label}
                    item={
                        item && !blocked ? toDisplayItem(slot, item, map) : null
                    }
                    ghostItem={ghostItem}
                    flask={slot.flask}
                    trinket={slot.trinket}
                    trinketSize="3.5rem"
                    align={slot.align}
                    highlighted={hoveredSlot === slot.key}
                    overlay={
                        item && !isEmptyItem(item) && !blocked ? (
                            <PrioritySelector
                                editable={editable}
                                rarity={item.rarity}
                                priority={item.priority}
                                slots={slots}
                                slotKey={slot.key}
                                onSet={(priority) =>
                                    setItem(slot.key, { ...item, priority })
                                }
                            />
                        ) : undefined
                    }
                    onEdit={
                        editable && !blocked
                            ? () => {
                                  // Drop the hover/focus tooltip so it never shows
                                  // above the open modal.
                                  dismissPinnedTooltip();
                                  setOpenSlot((open) =>
                                      open === slot.key ? null : slot.key,
                                  );
                              }
                            : undefined
                    }
                    onClear={
                        editable && item && !blocked
                            ? () => clearSlot(slot.key)
                            : undefined
                    }
                />

                {editable && !blocked && openSlot === slot.key && (
                    <SlotEditor
                        slot={slot}
                        item={item ?? emptyItem()}
                        onChange={(next) => setItem(slot.key, next)}
                        onClear={() => clearSlot(slot.key)}
                        onClose={() => {
                            if (item && isEmptyItem(item)) {
                                clearSlot(slot.key);
                            }

                            setOpenSlot(null);
                        }}
                    />
                )}
            </div>
        );
    }

    // Only slots with a priority set, in that order, for the strip under the doll - an
    // item with no priority has no place in it. Both weapon pairs count, even the one
    // not currently shown on the doll: the strip is a gearing shopping list, not a view
    // of the visible tiles. A two-hander's blocked off-hand is excluded from its own pair.
    const orderedItems = [...EQUIPMENT_SLOTS, ...WEAPON_SWAP_SLOTS]
        .map((slot) => ({
            slot,
            item: slots[slot.key],
        }))
        .filter(
            (entry): entry is { slot: SlotDef; item: ItemPlan } =>
                !!entry.item &&
                !!entry.item.base &&
                entry.item.priority !== null &&
                !isEmptyItem(entry.item) &&
                !(entry.slot.key === 'weapon2' && primaryOffhandBlocked) &&
                !(entry.slot.key === 'weapon2swap' && swapOffhandBlocked),
        )
        .sort((a, b) => (a.item.priority ?? 0) - (b.item.priority ?? 0));

    // The doll's fixed 15-cell layout with the active weapon pair substituted in - the
    // swap pair occupies the exact same two grid cells, never rendered alongside the
    // primary pair.
    const dollSlots = EQUIPMENT_SLOTS.map((slot) => {
        if (slot.key === 'weapon1') {
            return weapon1Slot;
        }

        if (slot.key === 'weapon2') {
            return weapon2Slot;
        }

        return slot;
    });

    return (
        <div className="flex flex-col items-center gap-4">
            {/* The doll is a rigid 10-column grid, wider than a phone - scale it down to
                fit rather than overflow. Its geometry is untouched. z-10 lifts the whole
                doll (ScaleToFit's transform traps the tooltip's own z-index in a stacking
                context) above the later priority strip, so a hovered item's tooltip is
                never painted under the strip's miniatures. mt-5 clears room above row 1
                for the weapon-set toggles, which sit just above their own tile. */}
            <ScaleToFit className="z-10 mt-5">
                <div
                    className="grid w-fit gap-1.5 sm:gap-3"
                    style={{
                        gridTemplateColumns: 'repeat(10, 3.5rem)',
                        gridAutoRows: '3.5rem',
                    }}
                >
                    {dollSlots.filter((slot) => !slot.trinket).map(renderSlot)}

                    {/* Charms: three squares centred on the bottom row, between the flasks. */}
                    <div
                        className="flex items-center justify-center gap-1.5 sm:gap-3"
                        style={{
                            gridColumn: '4 / span 4',
                            gridRow: '7 / span 2',
                        }}
                    >
                        {dollSlots
                            .filter((slot) => slot.trinket)
                            .map(renderSlot)}
                    </div>
                </div>
            </ScaleToFit>

            {orderedItems.length > 0 && (
                <PriorityStrip
                    items={orderedItems}
                    map={map}
                    onHover={setHoveredSlot}
                />
            )}
        </div>
    );
}
