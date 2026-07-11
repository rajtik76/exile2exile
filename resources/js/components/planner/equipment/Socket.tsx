import { SocketIcon } from '@/components/build/ItemDisplay';
import Button from '@/components/planner/Button';
import ReferencePicker from '@/components/planner/ReferencePicker';
import { useReferences } from '@/components/planner/ReferencesContext';
import { refKey } from '@/lib/planReferences';
import type { RuneRef } from '@/types/planner';

export default function Socket({
    rune,
    pickerOpen,
    onOpen,
    onPick,
    onClosePicker,
    onRemove,
}: {
    rune: RuneRef | null;
    pickerOpen: boolean;
    onOpen: () => void;
    onPick: (rune: RuneRef) => void;
    onClosePicker: () => void;
    onRemove: () => void;
}) {
    const { map, addReference } = useReferences();
    const reference = rune ? map[refKey('rune', rune.id)] : undefined;

    // One socket per row: its rune's icon + name (so the choice is visible without
    // hovering the item), a button to pick/change it, and a remove. The picker opens
    // right beside the row.
    return (
        <div className="relative">
            <div className="flex items-center gap-2 rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] p-1.5">
                {/* The rune's own art (soul-core icon); an empty ring for a blank socket. */}
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--pl-radius)] bg-[var(--pl-input-bg)]">
                    {reference?.icon ? (
                        <img
                            src={reference.icon}
                            alt=""
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                        />
                    ) : (
                        <SocketIcon name={null} />
                    )}
                </span>

                <span className="pl-text-sm min-w-0 flex-1 truncate">
                    {reference?.name ?? (
                        <span className="text-[var(--pl-muted)]">
                            Empty socket
                        </span>
                    )}
                </span>

                <Button variant="ghost" size="sm" onClick={onOpen}>
                    {rune ? 'Change' : 'Pick rune'}
                </Button>
                <Button
                    icon
                    variant="danger"
                    title="Remove socket"
                    onClick={onRemove}
                >
                    ✕
                </Button>
            </div>

            {pickerOpen && (
                <ReferencePicker
                    lockType="rune"
                    placeholder="Find a rune…"
                    onPick={(picked) => {
                        addReference(picked);
                        onPick({ type: 'rune', id: picked.id });
                    }}
                    onClose={onClosePicker}
                />
            )}
        </div>
    );
}
