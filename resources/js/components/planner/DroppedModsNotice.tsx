import { EQUIPMENT_SLOTS } from '@/types/planner';

/** Planner slot key → its paper-doll label ("gloves" → "Gloves"). */
const SLOT_LABEL: Record<string, string> = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot.key, slot.label]),
);

/**
 * A dismissible notice listing the author-mod lines a PoB import could not map to a game
 * affix, grouped by the item they came from and shown verbatim, line by line. The import
 * leaves these off rather than inventing a roll (PoB folds item quality into a defence
 * line, and a few wordings have no GGPK affix to reverse-match), so this is how the author
 * sees exactly what - and on which item - was not carried over. It stays until dismissed.
 */
export default function DroppedModsNotice({
    dropped,
    onDismiss,
}: {
    dropped: Record<string, string[]>;
    onDismiss: () => void;
}) {
    const groups = Object.entries(dropped).filter(
        ([, lines]) => lines.length > 0,
    );

    if (groups.length === 0) {
        return null;
    }

    const total = groups.reduce((sum, [, lines]) => sum + lines.length, 0);

    return (
        <div
            role="status"
            className="mb-8 rounded-[var(--pl-radius)] border border-[#c99a3a]/45 bg-[#c99a3a]/10 p-4"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="pl-text-sm font-medium text-[var(--pl-text-strong)]">
                        {total} modifier{total === 1 ? '' : 's'} couldn't be
                        imported
                    </p>
                    <p className="pl-text-xs mt-0.5 text-[var(--pl-muted)]">
                        PoB shows composite values (item quality folded into a
                        roll) and some wordings that don't map to a game affix.
                        These lines were left off - everything else imported.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-[var(--pl-radius)] text-[var(--pl-muted)] transition outline-none hover:text-[var(--pl-accent-lit)] focus-visible:text-[var(--pl-accent-lit)]"
                >
                    <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        className="size-4"
                    >
                        <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                </button>
            </div>

            <ul className="mt-3 flex flex-col gap-3">
                {groups.map(([slot, lines]) => (
                    <li key={slot}>
                        <p className="pl-text-xs font-medium tracking-wide text-[var(--pl-faint)] uppercase">
                            {SLOT_LABEL[slot] ?? slot}
                        </p>
                        <ul className="mt-1 flex flex-col gap-0.5">
                            {lines.map((line, index) => (
                                <li
                                    key={index}
                                    className="pl-text-sm text-[var(--pl-muted)]"
                                >
                                    {line}
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </div>
    );
}
