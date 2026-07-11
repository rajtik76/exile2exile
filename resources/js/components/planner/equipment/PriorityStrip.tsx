import { useState } from 'react';
import { ItemCard } from '@/components/build/ItemDisplay';
import { CursorTooltip, rarityTone } from '@/components/build/tooltip';
import { toDisplayItem } from '@/components/planner/equipment/displayItem';
import type { SlotDef } from '@/components/planner/equipment/displayItem';
import type { ModMap } from '@/lib/modLines';
import { refKey } from '@/lib/planReferences';
import type { ReferenceMap } from '@/lib/planReferences';
import type { ItemPlan } from '@/types/planner';

/**
 * A strip under the paper-doll listing every filled item in gearing-priority order:
 * a miniature rarity-framed icon with its priority number, so the "get this first"
 * order reads at a glance without hovering each slot.
 */
export default function PriorityStrip({
    items,
    map,
    modMap,
    onHover,
}: {
    items: Array<{ slot: SlotDef; item: ItemPlan }>;
    map: ReferenceMap;
    modMap: ModMap;
    /** Report which slot is hovered so its paper-doll tile can highlight (null = none). */
    onHover: (slotKey: string | null) => void;
}) {
    // The hovered miniature and the cursor, driving a portalled tooltip that can't be
    // clipped by the panel's overflow (unlike the tile's in-flow hover tooltip).
    const [active, setActive] = useState<{
        slotKey: string;
        x: number;
        y: number;
    } | null>(null);

    const activeEntry = active
        ? items.find((entry) => entry.slot.key === active.slotKey)
        : undefined;

    return (
        <div
            className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[var(--pl-radius-lg)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] px-3 py-2"
            style={{ boxShadow: 'var(--pl-shadow)' }}
        >
            <span className="pl-text-2xs mr-1 tracking-[var(--pl-label-tracking)] text-[var(--pl-faint)] uppercase">
                Priority
            </span>
            {items.map(({ slot, item }) => {
                const reference = item.base
                    ? map[refKey(item.base.type, item.base.id)]
                    : undefined;
                const tone = rarityTone(item.rarity);
                const label = reference?.name ?? item.base?.id ?? slot.label;

                return (
                    <div
                        key={slot.key}
                        onMouseEnter={() => onHover(slot.key)}
                        onMouseMove={(event) =>
                            setActive({
                                slotKey: slot.key,
                                x: event.clientX,
                                y: event.clientY,
                            })
                        }
                        onMouseLeave={() => {
                            onHover(null);
                            setActive(null);
                        }}
                        className="relative flex size-9 shrink-0 items-center justify-center rounded-[2px] border bg-[#08080b]"
                        style={{
                            borderColor: tone.edge,
                            boxShadow: `0 0 6px ${tone.glow}`,
                        }}
                    >
                        {reference?.icon ? (
                            <img
                                src={reference.icon}
                                alt={label}
                                loading="lazy"
                                className="max-h-[82%] max-w-[82%] object-contain"
                            />
                        ) : (
                            <span
                                className="line-clamp-2 px-0.5 text-center text-[7px] leading-tight font-medium"
                                style={{ color: tone.text }}
                            >
                                {label}
                            </span>
                        )}

                        {item.priority !== null && (
                            <span
                                className="pl-text-2xs absolute right-0 bottom-0 flex size-4 items-center justify-center rounded-tl-[3px] rounded-br-[1px] border font-semibold tabular-nums"
                                style={{
                                    borderColor: tone.edge,
                                    backgroundColor: '#0b0a08',
                                    color: tone.text,
                                }}
                            >
                                {item.priority}
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Portalled cursor tooltip - same card as the paper-doll, never clipped. */}
            {active && activeEntry && (
                <CursorTooltip x={active.x} y={active.y}>
                    <ItemCard
                        item={toDisplayItem(
                            activeEntry.slot,
                            activeEntry.item,
                            map,
                            modMap,
                        )}
                    />
                </CursorTooltip>
            )}
        </div>
    );
}
