import { useEffect, useState } from 'react';
import type { FocusEvent } from 'react';
import { MOD_COLOR } from '@/components/planner/equipment/style';
import type { UniqueModLine } from '@/lib/planReferences';
import { uniqueModTokens } from '@/lib/uniqueModLines';

/**
 * A bounded value input for one rolled unique-mod value. Decimal-capable (unlike the
 * authored-affix {@link ModValueInput} in `ModRow.tsx`, kept integer-only there by design -
 * GGPK affix rolls always are, but PoB's own unique data carries genuinely fractional rolls,
 * e.g. "11.9 Life Regeneration per second").
 *
 * Free-typed via local state, not clamped as the author types - the field never rewrites
 * what was typed, it only judges it: out of range (or not a number at all) turns the field
 * red and shows the allowed range, both live as they type and once they try to leave. A bad
 * value never leaves this field at all: Tab is intercepted outright (its default action -
 * moving focus - is prevented before it happens, so there is no flicker to another field),
 * and a blur from anywhere else (a mouse click elsewhere) is refocused synchronously, inside
 * the same blur handler, before the browser paints the change - not deferred to a timeout,
 * which visibly flickers focus away and back. The author must fix it before doing anything
 * else - it can never reach the item's stored `uniqueMods`, let alone get saved. Only a
 * value that is actually in range is ever committed via `onChange`.
 */
function UniqueModValueInput({
    value,
    min,
    max,
    onChange,
    onValidityChange,
}: {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    /** Reported on every change, live - lets the editor lock every other control (Done,
     *  sockets, Corrupted, the base picker's Change) while this field holds a value that
     *  was typed but never actually committed. */
    onValidityChange: (invalid: boolean) => void;
}) {
    const [text, setText] = useState(String(value));
    const [prevValue, setPrevValue] = useState(value);

    // Stay in sync when the value changes from outside this input (e.g. a fresh import, or
    // switching to a different unique) - but never while the field itself is being typed in.
    // A render-phase adjustment, not an effect: React re-renders immediately with the new
    // text, without first painting the stale one.
    if (value !== prevValue) {
        setPrevValue(value);
        setText(String(value));
    }

    const parsed = text.trim() === '' ? NaN : Number(text);
    const invalid = Number.isNaN(parsed) || parsed < min || parsed > max;

    // Live, not just on blur - the lock (Done disabled, sockets/Corrupted/Change frozen)
    // must engage the instant the field goes bad, not only once the author tries to leave.
    // Deliberately keyed on `invalid` alone: `onValidityChange` is a fresh closure every
    // parent render, and including it would re-fire this on every keystroke elsewhere.
    useEffect(() => {
        onValidityChange(invalid);

        return () => onValidityChange(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invalid]);

    function commit(event: FocusEvent<HTMLInputElement>): void {
        if (invalid) {
            // Synchronous, inside the blur handler itself - the DOM allows refocusing
            // here before the browser commits the focus change, so it never paints the
            // intermediate "focus moved away" frame a deferred refocus would flicker.
            event.target.focus();

            return;
        }

        if (parsed !== value) {
            onChange(parsed);
        }
    }

    return (
        <span className="inline-flex items-center gap-1">
            <input
                type="text"
                inputMode="decimal"
                value={text}
                aria-invalid={invalid}
                title={`Valid range: ${min}-${max}`}
                onChange={(event) =>
                    setText(event.target.value.replace(/[^0-9.-]/g, ''))
                }
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    } else if (event.key === 'Tab' && invalid) {
                        // Stop focus from ever leaving in the first place - no blur/flicker
                        // at all for the most common way to move on (keyboard navigation).
                        event.preventDefault();
                    }
                }}
                className={`pl-text-sm w-14 rounded-[var(--pl-radius)] border px-1 py-0.5 text-center outline-none focus-visible:border-[var(--pl-focus)] ${
                    invalid
                        ? 'border-[var(--pl-danger)] bg-[var(--pl-danger-soft)] text-[var(--pl-danger-lit)]'
                        : 'border-[var(--pl-input-border)] bg-[var(--pl-input-bg)] text-[#a9c0ec]'
                }`}
            />
            <span
                className="pl-text-2xs"
                style={{
                    color: invalid ? 'var(--pl-danger-lit)' : 'var(--pl-faint)',
                }}
            >
                {min}–{max}
            </span>
        </span>
    );
}

/**
 * One of a unique's own (fixed) mod lines: plain text if it has no ranges, else the
 * template plus a value input per roll. Unlike {@link ModRow}, there is no way to change
 * or remove *which* mod this is - a unique's mods are fixed by the unique itself, only
 * their rolled values are ever author-editable.
 */
export default function UniqueModRow({
    line,
    values,
    onChange,
    onValidityChange,
}: {
    line: UniqueModLine;
    values: number[];
    onChange: (values: number[]) => void;
    /** Reported per roll (`${line.key}#${rollIndex}`), live - see UniqueModValueInput. */
    onValidityChange: (id: string, invalid: boolean) => void;
}) {
    function setValue(rollIndex: number, value: number): void {
        const next = [...values];
        next[rollIndex] = value;
        onChange(next);
    }

    return (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] px-2 py-1.5">
            {uniqueModTokens(line).map((token, tokenIndex) =>
                token.kind === 'text' ? (
                    <span
                        key={tokenIndex}
                        className="pl-text-sm"
                        style={{ color: MOD_COLOR }}
                    >
                        {token.text}
                    </span>
                ) : (
                    <UniqueModValueInput
                        key={tokenIndex}
                        value={values[token.rollIndex] ?? token.min}
                        min={token.min}
                        max={token.max}
                        onChange={(next) => setValue(token.rollIndex, next)}
                        onValidityChange={(invalid) =>
                            onValidityChange(
                                `${line.key}#${token.rollIndex}`,
                                invalid,
                            )
                        }
                    />
                ),
            )}
        </div>
    );
}
