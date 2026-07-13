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
            className="flex max-w-full flex-wrap items-center justify-center gap-y-2 rounded-[var(--pl-radius-lg)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] px-4 py-2.5"
            style={{ boxShadow: 'var(--pl-shadow)' }}
        >
            <span className="pl-text-2xs mr-1 shrink-0 tracking-[var(--pl-label-tracking)] text-[var(--pl-faint)] uppercase">
                Chase order
            </span>
            {items.map(({ slot, item }, index) => {
                const reference = item.base
                    ? map[refKey(item.base.type, item.base.id)]
                    : undefined;
                const tone = rarityTone(item.rarity);
                const label = reference?.name ?? item.base?.id ?? slot.label;
                // The very first pick in the chase order gets a quiet gold ring - the
                // one piece of emphasis in an otherwise even-handed row.
                const isTop = index === 0;

                return (
                    <div key={slot.key} className="flex items-center">
                        {index > 0 && (
                            // A hairline, not an arrow: it reads as a divider at any
                            // width and never forces an awkward gap once the row wraps.
                            <span
                                aria-hidden
                                className="mx-2 h-6 w-px shrink-0 bg-[var(--pl-panel-border)]"
                            />
                        )}

                        <div
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
                            className={`relative flex size-10 shrink-0 items-center justify-center rounded-[8px] border bg-[#0a0a10] transition ${isTop ? 'ring-1 ring-[#c9a24a]/70' : ''}`}
                            style={{
                                borderColor: tone.edge,
                                boxShadow: `inset 0 0 14px -7px ${tone.glow}, 0 0 5px -2px ${tone.glow}`,
                            }}
                        >
                            {reference?.icon ? (
                                <img
                                    src={reference.icon}
                                    alt={label}
                                    loading="lazy"
                                    className="max-h-[80%] max-w-[80%] object-contain"
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
                                    className="pl-text-2xs absolute right-[-4px] bottom-[-4px] flex size-4 items-center justify-center rounded-[5px] border leading-none font-semibold tabular-nums"
                                    style={{
                                        borderColor: tone.edge,
                                        // Opaque, not a colour-wash: this badge sits over the
                                        // item's own art, so a translucent tint (fine for the
                                        // paper-doll badge, which floats on plain bg) loses
                                        // contrast against busy icon art underneath.
                                        backgroundColor: '#0a0a10',
                                        color: tone.text,
                                        fontFamily: "'Lexend', sans-serif",
                                    }}
                                >
                                    {item.priority}
                                </span>
                            )}
                        </div>
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
