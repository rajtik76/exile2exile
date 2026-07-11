import { useState } from 'react';
import Button from '@/components/planner/Button';
import {
    MOD_COLOR,
    MOD_TYPE_STYLE,
} from '@/components/planner/equipment/style';
import ModPicker from '@/components/planner/ModPicker';
import { modDisplayLines } from '@/lib/modLines';
import type { ModInfo } from '@/lib/modLines';
import type { ItemStat } from '@/types/planner';

/** A bounded digit input for one rolled mod value, clamped to its tier's range. */
function ModValueInput({
    value,
    min,
    max,
    onChange,
}: {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}) {
    return (
        <input
            type="text"
            inputMode="numeric"
            value={String(value)}
            title={`${min}-${max}`}
            onChange={(event) => {
                const raw = event.target.value.replace(/[^0-9-]/g, '');
                const parsed = raw === '' || raw === '-' ? min : Number(raw);
                const clamped = Math.max(
                    min,
                    Math.min(max, Number.isNaN(parsed) ? min : parsed),
                );
                onChange(clamped);
            }}
            className="pl-text-sm w-12 rounded-[var(--pl-radius)] border border-[var(--pl-input-border)] bg-[var(--pl-input-bg)] px-1 py-0.5 text-center text-[#a9c0ec] outline-none focus-visible:border-[var(--pl-focus)]"
        />
    );
}

export default function ModRow({
    stat,
    mod,
    base,
    categories,
    excludeGroups,
    fullTypes,
    onChange,
    onReplace,
    onRemove,
}: {
    stat: ItemStat;
    mod: ModInfo | undefined;
    /** The picked base (for the change picker's roll filtering), or null. */
    base: string | null;
    categories: string[];
    /** Affix groups already on the item (this row excluded) - hidden in the picker. */
    excludeGroups: string[];
    /** Generation types at their cap (this row excluded) - hidden in the picker. */
    fullTypes: Array<'prefix' | 'suffix'>;
    onChange: (stat: ItemStat) => void;
    onReplace: (mod: ModInfo) => void;
    onRemove: () => void;
}) {
    const [changing, setChanging] = useState(false);

    function setValue(rollIndex: number, value: number): void {
        const values = [...stat.values];
        values[rollIndex] = value;
        onChange({ ...stat, values });
    }

    return (
        <div className="relative">
            <div className="flex items-start gap-2 rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] px-2 py-1.5">
                <span
                    className="pl-text-2xs mt-1 rounded-xs px-1 py-px font-semibold uppercase tabular-nums"
                    style={mod ? MOD_TYPE_STYLE[mod.type] : undefined}
                >
                    {mod
                        ? `${mod.type === 'prefix' ? 'P' : 'S'}${mod.tier ?? ''}`
                        : '?'}
                </span>

                <div className="min-w-0 flex-1">
                    {mod ? (
                        modDisplayLines(mod).map((tokens, lineIndex) => (
                            <div
                                key={lineIndex}
                                className="flex flex-wrap items-center gap-x-1 gap-y-1"
                            >
                                {tokens.map((token, tokenIndex) =>
                                    token.kind === 'text' ? (
                                        <span
                                            key={tokenIndex}
                                            className="pl-text-sm"
                                            style={{ color: MOD_COLOR }}
                                        >
                                            {token.text}
                                        </span>
                                    ) : (
                                        <ModValueInput
                                            key={tokenIndex}
                                            value={
                                                stat.values[token.rollIndex] ??
                                                token.min
                                            }
                                            min={token.min}
                                            max={token.max}
                                            onChange={(next) =>
                                                setValue(token.rollIndex, next)
                                            }
                                        />
                                    ),
                                )}
                            </div>
                        ))
                    ) : (
                        <span className="pl-text-xs text-[var(--pl-faint)]">
                            Resolving modifier…
                        </span>
                    )}
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
                    excludeGroups={excludeGroups}
                    fullTypes={fullTypes}
                    initialGroup={mod?.group ?? undefined}
                    onPick={(picked) => {
                        onReplace(picked);
                        setChanging(false);
                    }}
                    onClose={() => setChanging(false)}
                />
            )}
        </div>
    );
}
