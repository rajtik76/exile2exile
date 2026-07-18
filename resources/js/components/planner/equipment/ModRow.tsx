import { useState } from 'react';
import Button from '@/components/planner/Button';
import {
    MOD_COLOR,
    MOD_TYPE_STYLE,
} from '@/components/planner/equipment/style';
import ModPicker from '@/components/planner/ModPicker';
import type { ItemMod } from '@/types/planner';

/** A muted colour for a stat the catalogue couldn't match - a plain-text line, not a
 *  known GGPK affix (a typo, a dead affix, or something custom the author typed). */
const UNMATCHED_COLOR = '#9a8f78';

/**
 * One authored modifier line: its `text` shown verbatim (the frozen snapshot is the
 * sole source of truth for display, matched or not - see {@link ItemMod}), a P/S-tier
 * badge when matched or a muted "?" when not, and a Change picker that replaces the
 * whole stat (text and every frozen field together) rather than editing pieces of it.
 */
export default function ModRow({
    stat,
    base,
    categories,
    excludeFamilies,
    fullTypes,
    onChange,
    onRemove,
}: {
    stat: ItemMod;
    /** The picked base (for the picker's roll filtering), or null. */
    base: string | null;
    categories: string[];
    /** Mutual-exclusion families already on the item (this row excluded) - hidden in
     *  the picker. */
    excludeFamilies: string[];
    /** Generation types at their cap (this row excluded) - hidden in the picker. */
    fullTypes: Array<'prefix' | 'suffix'>;
    onChange: (stat: ItemMod) => void;
    onRemove: () => void;
}) {
    const [changing, setChanging] = useState(false);
    const matched = stat.modId !== null;

    return (
        <div className="relative">
            <div className="flex items-start gap-2 rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] px-2 py-1.5">
                <span
                    className="pl-text-2xs mt-1 rounded-xs px-1 py-px font-semibold uppercase tabular-nums"
                    style={
                        matched && stat.type
                            ? MOD_TYPE_STYLE[stat.type]
                            : {
                                  color: UNMATCHED_COLOR,
                                  backgroundColor: `${UNMATCHED_COLOR}20`,
                              }
                    }
                    title={matched ? undefined : 'Not a known GGPK modifier'}
                >
                    {matched
                        ? `${stat.type === 'prefix' ? 'P' : 'S'}${stat.tier ?? ''}`
                        : '?'}
                </span>

                <div className="min-w-0 flex-1">
                    {(stat.text ?? '').split('\n').map((line, index) => (
                        <p
                            key={index}
                            className="pl-text-sm"
                            style={{
                                color: matched ? MOD_COLOR : UNMATCHED_COLOR,
                            }}
                        >
                            {line}
                        </p>
                    ))}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChanging((open) => !open)}
                    >
                        Change
                    </Button>
                    <Button
                        icon
                        variant="danger"
                        title="Remove modifier"
                        onClick={onRemove}
                    >
                        ✕
                    </Button>
                </div>
            </div>

            {changing && (
                <ModPicker
                    base={base}
                    categories={categories}
                    excludeFamilies={excludeFamilies}
                    fullTypes={fullTypes}
                    initialText={stat.text}
                    onSave={(next) => onChange(next)}
                    onClose={() => setChanging(false)}
                />
            )}
        </div>
    );
}
