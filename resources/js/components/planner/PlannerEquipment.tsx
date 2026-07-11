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
import { useMods } from '@/components/planner/ModsContext';
import { useReferences } from '@/components/planner/ReferencesContext';
import ScaleToFit from '@/components/planner/ScaleToFit';
import { refKey } from '@/lib/planReferences';
import { EQUIPMENT_SLOTS } from '@/types/planner';
import type { ItemPlan } from '@/types/planner';

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
    const { map: modMap } = useMods();
    const [openSlot, setOpenSlot] = useState<string | null>(null);
    // The slot whose priority-strip miniature is hovered - its paper-doll tile lights up.
    const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

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
    // dimmed ghost of the weapon when empty (as the game does).
    const mainWeapon = slots.weapon1;
    const mainWeaponRef = mainWeapon?.base
        ? map[refKey(mainWeapon.base.type, mainWeapon.base.id)]
        : undefined;
    const offhandBlocked = mainWeaponRef?.twoHanded ?? false;

    /** One paper-doll cell: its item, editor and priority controls. */
    function renderSlot(slot: SlotDef): React.ReactNode {
        const item = slots[slot.key];
        const blocked = slot.key === 'weapon2' && offhandBlocked;
        const ghostItem =
            blocked && mainWeapon && (!item || isEmptyItem(item))
                ? toDisplayItem(slot, mainWeapon, map, modMap)
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
                <SlotTile
                    slot={slot.label}
                    item={
                        item && !blocked
                            ? toDisplayItem(slot, item, map, modMap)
                            : null
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

    // Only slots with a priority set, in that order, for the strip under the doll -
    // an item with no priority has no place in it. A two-hander's blocked off-hand is
    // excluded.
    const orderedItems = EQUIPMENT_SLOTS.map((slot) => ({
        slot,
        item: slots[slot.key],
    }))
        .filter(
            (entry): entry is { slot: SlotDef; item: ItemPlan } =>
                !!entry.item &&
                !!entry.item.base &&
                entry.item.priority !== null &&
                !isEmptyItem(entry.item) &&
                !(entry.slot.key === 'weapon2' && offhandBlocked),
        )
        .sort((a, b) => (a.item.priority ?? 0) - (b.item.priority ?? 0));

    return (
        <div className="flex flex-col items-center gap-4">
            {/* The doll is a rigid 10-column grid, wider than a phone - scale it down to
                fit rather than overflow. Its geometry is untouched. z-10 lifts the whole
                doll (ScaleToFit's transform traps the tooltip's own z-index in a stacking
                context) above the later priority strip, so a hovered item's tooltip is
                never painted under the strip's miniatures. */}
            <ScaleToFit className="z-10">
                <div
                    className="grid w-fit gap-1.5"
                    style={{
                        gridTemplateColumns: 'repeat(10, 3.5rem)',
                        gridAutoRows: '3.5rem',
                    }}
                >
                    {EQUIPMENT_SLOTS.filter((slot) => !slot.trinket).map(
                        renderSlot,
                    )}

                    {/* Charms: three squares centred on the bottom row, between the flasks. */}
                    <div
                        className="flex items-center justify-center gap-1.5"
                        style={{
                            gridColumn: '4 / span 4',
                            gridRow: '7 / span 2',
                        }}
                    >
                        {EQUIPMENT_SLOTS.filter((slot) => slot.trinket).map(
                            renderSlot,
                        )}
                    </div>
                </div>
            </ScaleToFit>

            {orderedItems.length > 0 && (
                <PriorityStrip
                    items={orderedItems}
                    map={map}
                    modMap={modMap}
                    onHover={setHoveredSlot}
                />
            )}
        </div>
    );
}
