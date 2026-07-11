import { useState } from 'react';
import { rarityTone } from '@/components/build/tooltip';
import { priorityOptions } from '@/lib/priority';
import type { ItemPlan, ItemRarity } from '@/types/planner';

/**
 * The priority control built into a filled item's bottom-right corner, styled as part of
 * the rarity frame: a square tinted the frame's own border colour showing the priority
 * number, or `#` when unset. Clicking opens a picker offering only the numbers no other
 * slot has taken (the rest greyed) - the editor's answer to the game's "which piece to
 * chase first" order. Read-only shows the number square (no `#` prompt, nothing to pick).
 */
export default function PrioritySelector({
    editable,
    rarity,
    priority,
    slots,
    slotKey,
    onSet,
}: {
    editable: boolean;
    rarity: ItemRarity;
    priority: number | null;
    slots: Record<string, ItemPlan>;
    slotKey: string;
    onSet: (priority: number | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const tone = rarityTone(rarity);

    // The corner square, flush with the frame and edged in the frame's border colour.
    // `data-priority` hides the item tooltip on hover via CSS `:has` (see ItemTooltip).
    const cornerStyle: React.CSSProperties = {
        borderColor: tone.edge,
        backgroundColor: 'var(--pl-panel)',
        color: tone.text,
    };
    const cornerClass =
        // Below the item tooltip (z-60) so a hover never shows the corner poking through.
        // Border weight matches the item frame (1px); only the bottom-right corner is
        // rounded, to sit flush inside the frame's own rounded-[2px] corner.
        'group/prio pl-text-xs absolute right-0 bottom-0 z-[50] flex size-5 items-center justify-center rounded-br-[2px] border font-semibold tabular-nums shadow-[0_0_4px_rgba(0,0,0,0.7)]';

    // The small hint shown while the pointer is over the square (the item card is hidden).
    const hint = (
        <span className="pl-text-sm pointer-events-none absolute right-0 bottom-full z-[65] mb-1.5 hidden rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel)] px-2.5 py-1 font-normal whitespace-nowrap text-[var(--pl-text-strong)] shadow-xl group-focus-within/prio:block group-hover/prio:block">
            {priority !== null ? `Priority #${priority}` : 'Set priority'}
        </span>
    );

    if (!editable) {
        return priority !== null ? (
            <span className={cornerClass} style={cornerStyle} data-priority>
                {priority}
                {hint}
            </span>
        ) : null;
    }

    function toggle(event: React.MouseEvent): void {
        event.stopPropagation();
        setOpen((current) => !current);
    }

    return (
        <>
            <button
                type="button"
                data-priority
                onClick={toggle}
                className={`${cornerClass} transition hover:brightness-125`}
                style={cornerStyle}
            >
                {priority !== null ? priority : '#'}
                {hint}
            </button>

            {open && (
                <PriorityMenu
                    options={priorityOptions(slots, slotKey)}
                    current={priority}
                    onPick={(value) => {
                        onSet(value);
                        setOpen(false);
                    }}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

/** The number grid a priority is picked from: taken numbers greyed, current highlighted. */
function PriorityMenu({
    options,
    current,
    onPick,
    onClose,
}: {
    options: Array<{ value: number; taken: boolean }>;
    current: number | null;
    onPick: (priority: number | null) => void;
    onClose: () => void;
}) {
    return (
        <>
            <div
                className="fixed inset-0 z-[75]"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
            />
            <div
                className="absolute top-full right-0 z-[80] mt-1 w-max rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel)] p-1.5 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <p className="pl-text-2xs mb-1 px-0.5 tracking-[var(--pl-label-tracking)] text-[var(--pl-faint)] uppercase">
                    Priority
                </p>
                <div className="grid grid-cols-5 gap-1">
                    {options.map(({ value, taken }) => {
                        const isCurrent = value === current;
                        const disabled = taken && !isCurrent;

                        return (
                            <button
                                key={value}
                                type="button"
                                disabled={disabled}
                                onClick={() => onPick(value)}
                                className={`pl-text-2xs flex size-6 items-center justify-center rounded-[var(--pl-radius)] tabular-nums transition ${
                                    isCurrent
                                        ? 'bg-[var(--pl-accent)] font-semibold text-[#15120b]'
                                        : disabled
                                          ? 'cursor-not-allowed text-[var(--pl-faint)] opacity-50'
                                          : 'text-[var(--pl-text)] hover:bg-[var(--pl-accent-soft)]'
                                }`}
                            >
                                {value}
                            </button>
                        );
                    })}
                </div>
                {current !== null && (
                    <button
                        type="button"
                        onClick={() => onPick(null)}
                        className="pl-text-2xs mt-1.5 w-full rounded-[var(--pl-radius)] px-1 py-1 text-center text-[var(--pl-muted)] transition hover:bg-white/5"
                    >
                        Clear priority
                    </button>
                )}
            </div>
        </>
    );
}
