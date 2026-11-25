import type { AllocMode, WeaponSet } from '@poe2-toolkit/tree-core';
import { DEFAULT_TREE_COLORS } from '@poe2-toolkit/tree-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {
    CircleHelp,
    Maximize,
    Minimize,
    Minus,
    Plus,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { COLOR } from '@/components/brand';
import {
    ClearGlyph,
    Divider,
    FIELD_ICON_BUTTON,
    FIELD_INPUT,
    FOCUS_RING,
    ICON_SEGMENT,
    ICON_STROKE,
    LABEL,
    PLAQUE,
} from './chrome';
import { hexColor } from './treeBudgets';

/**
 * Weapon-set accent colours, derived from the renderer's default set tints (set
 * I red, set II green, the in-game colours) so the counters and paint toggle
 * always read as the same sets drawn on the tree. The basic tree reads in the
 * plain text colour.
 */
export const WEAPON_SET_HEX: Record<WeaponSet, string> = {
    1: hexColor(DEFAULT_TREE_COLORS.weaponSet[1]),
    2: hexColor(DEFAULT_TREE_COLORS.weaponSet[2]),
};

/**
 * Tint for the ascendancy budget - a violet, distinct from the plain basic
 * count and the weapon-set red/green, so the four budgets read as one family.
 */
const ASCENDANCY_HEX = '#b48ce0';

/**
 * Node search over names and stat lines, in the same {@link PLAQUE}
 * shell as the rest of the rail. Typing highlights matches live on the tree;
 * Enter frames them. The match count reads out at the end.
 */
export function SearchBox({
    value,
    onValue,
    onSubmit,
    matchCount,
}: {
    value: string;
    onValue: (value: string) => void;
    onSubmit: () => void;
    matchCount: number;
}) {
    // Wider than the other plaques: the clear and hint glyphs sit inside the
    // field, next to its placeholder.
    return (
        <div className="relative min-w-[12rem] flex-1 md:w-80 md:flex-none">
            <div
                className={`flex h-10 items-center gap-1 pr-1 pl-3 transition-colors duration-[120ms] focus-within:border-ember-400 ${PLAQUE}`}
            >
                <Search
                    size={15}
                    strokeWidth={ICON_STROKE}
                    className="mr-1 shrink-0 text-mist"
                    aria-hidden="true"
                />
                <input
                    type="text"
                    name="node-search"
                    value={value}
                    onChange={(event) => onValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            onSubmit();
                        }
                    }}
                    placeholder="Search name or stat…"
                    aria-label="Search passive nodes by name or stat"
                    spellCheck={false}
                    className={FIELD_INPUT}
                />
                {value !== '' && (
                    <button
                        type="button"
                        onClick={() => onValue('')}
                        title="Clear search"
                        aria-label="Clear search"
                        className={FIELD_ICON_BUTTON}
                    >
                        <ClearGlyph />
                    </button>
                )}
                <SearchHint />
                <Divider />
                <span className="shrink-0 px-2 text-sm font-medium text-paper tabular-nums">
                    {matchCount}
                    <span className="text-mist">
                        {matchCount === 1 ? ' hit' : ' hits'}
                    </span>
                </span>
            </div>
        </div>
    );
}

/** Each runs as typed, and each needs the pattern half to work. */
const SEARCH_EXAMPLES: { query: string; effect: string }[] = [
    { query: 'ailment|channelling', effect: 'either word' },
    { query: 'minion.*(life|damage)', effect: 'both, in that order' },
    { query: '\\d+% increased Attack Speed', effect: 'any number' },
    { query: '^Life', effect: 'starts with' },
];

/**
 * Regex support is invisible without this. The panel keeps the lightest text
 * on a plain dark field, because a pattern has to be legible character by
 * character. Radix runs through its primitives to set those colours directly,
 * and the panel outranks the fullscreen canvas (`z-[120]`).
 */
function SearchHint() {
    const [open, setOpen] = useState(false);

    return (
        <TooltipPrimitive.Provider delayDuration={150}>
            <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
                <TooltipPrimitive.Trigger asChild>
                    <button
                        type="button"
                        // Touch never hovers, so a press toggles the panel.
                        // Radix closes on pointerdown and again on click, both
                        // against a stale `open` prop, so the toggle runs first
                        // and the click close is cancelled.
                        onPointerDown={(event) => {
                            if (event.button !== 0) {
                                return;
                            }

                            setOpen((shown) => !shown);
                        }}
                        onClick={(event) => {
                            // Keyboard activation reports no button press, and
                            // fires no pointerdown to have toggled on.
                            if (event.detail === 0) {
                                setOpen((shown) => !shown);

                                return;
                            }

                            event.preventDefault();
                        }}
                        aria-label="Search syntax"
                        className={`${FIELD_ICON_BUTTON} data-[state=delayed-open]:text-ember-400 data-[state=instant-open]:text-ember-400`}
                    >
                        <CircleHelp
                            size={15}
                            strokeWidth={ICON_STROKE}
                            aria-hidden="true"
                        />
                    </button>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        side="bottom"
                        align="end"
                        sideOffset={16}
                        collisionPadding={12}
                        className="z-[200] max-w-[min(27rem,calc(100vw-1.5rem))] rounded-[2px] border border-line-strong bg-stone-700 px-4 py-3.5 font-ui text-[13px]/[1.5] text-paper shadow-xl shadow-black/60"
                    >
                        <p>
                            Matches a node name or a stat line. Add regex
                            punctuation to search several at once.
                        </p>
                        <table className="mt-3 w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-pewter-700 text-slate">
                                    <th className="border-r border-line-strong py-1.5 pr-3 font-medium">
                                        Example
                                    </th>
                                    <th className="py-1.5 pl-3 font-medium">
                                        Matches
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {SEARCH_EXAMPLES.map(({ query, effect }) => (
                                    <tr
                                        key={query}
                                        className="border-b border-line-strong last:border-b-0"
                                    >
                                        <td className="border-r border-line-strong py-1.5 pr-3 font-mono whitespace-nowrap">
                                            {query}
                                        </td>
                                        <td className="py-1.5 pl-3 text-bone">
                                            {effect}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="mt-3">
                            A query without regex punctuation, or one that is
                            not a valid pattern, is searched as plain text.
                        </p>
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
}

/**
 * The point budgets in one compact plaque, doubling as the paint toggle: each
 * segment is a budget (Basic, Weapon set I/II) showing its `used/limit`, coloured
 * in its mode tint. While editing the segments are radio buttons picking the
 * paint target (the active one carries the ember underline); read-only they
 * just read out.
 * Ascendancy, which isn't a paint mode, is appended as a static count. No ring
 * gauges - the numbers carry the read-out, so the bar fits a phone.
 */
export function BudgetBar({
    mode,
    onMode,
    basic,
    basicLimit,
    weaponSets,
    ascendancy,
}: {
    mode: AllocMode;
    /** Paint-mode setter while editing; null read-only (segments aren't buttons). */
    onMode: ((mode: AllocMode) => void) | null;
    basic: number;
    basicLimit: number;
    /** Per-set usage + shared cap, or null to hide the weapon-set segments. */
    weaponSets: { setI: number; setII: number; limit: number } | null;
    /** Ascendancy usage + cap, or null to hide it. */
    ascendancy: { used: number; limit: number } | null;
}) {
    const segments: {
        value: AllocMode;
        label: string;
        color: string;
        used: number;
        limit: number;
    }[] = [
        {
            value: 0,
            label: 'Basic',
            color: COLOR.paper,
            used: basic,
            limit: basicLimit,
        },
    ];

    if (weaponSets) {
        segments.push(
            {
                value: 1,
                label: 'I',
                color: WEAPON_SET_HEX[1],
                used: weaponSets.setI,
                limit: weaponSets.limit,
            },
            {
                value: 2,
                label: 'II',
                color: WEAPON_SET_HEX[2],
                used: weaponSets.setII,
                limit: weaponSets.limit,
            },
        );
    }

    const segmentLabel = (
        label: string,
        used: number,
        limit: number,
    ): React.JSX.Element => (
        <span className="flex items-baseline gap-1.5">
            <span>{label}</span>
            <span
                className={`tabular-nums ${used > limit ? 'text-blood-lit' : 'text-paper'}`}
            >
                {used}/{limit}
            </span>
        </span>
    );

    const segmentShape =
        'flex h-8 items-center rounded-[2px] px-2.5 text-sm font-semibold';

    return (
        <div
            className={`flex h-10 items-center gap-2 ${PLAQUE}`}
            role={onMode ? 'radiogroup' : undefined}
            aria-label="Point budgets"
        >
            <span className={`pl-2 ${LABEL}`}>Points</span>
            <Divider />
            <div className="flex items-center gap-0.5">
                {segments.map((segment) => {
                    const label = segmentLabel(
                        segment.label,
                        segment.used,
                        segment.limit,
                    );

                    return onMode ? (
                        <button
                            key={segment.value}
                            type="button"
                            role="radio"
                            aria-checked={mode === segment.value}
                            onClick={() => onMode(segment.value)}
                            className={`${segmentShape} transition-colors duration-[120ms] hover:bg-stone-800 aria-checked:bg-stone-700 aria-checked:shadow-[inset_0_-2px_0_var(--color-ember-500)] ${FOCUS_RING}`}
                            style={{ color: segment.color }}
                        >
                            {label}
                        </button>
                    ) : (
                        <span
                            key={segment.value}
                            className={segmentShape}
                            style={{ color: segment.color }}
                        >
                            {label}
                        </span>
                    );
                })}

                {ascendancy && (
                    <>
                        <Divider />
                        <span
                            className={segmentShape}
                            style={{ color: ASCENDANCY_HEX }}
                            aria-label="Ascendancy points"
                        >
                            {segmentLabel(
                                'Asc',
                                ascendancy.used,
                                ascendancy.limit,
                            )}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Wipe-the-whole-build button, in the same plaque as the rest of the canvas
 * chrome. Clears every allocated node - basic, both weapon sets and the
 * ascendancy - in one click.
 */
export function ClearBuildButton({ onClear }: { onClear: () => void }) {
    return (
        <div className={`flex h-10 items-center ${PLAQUE}`}>
            <button
                type="button"
                onClick={onClear}
                title="Clear the whole build"
                aria-label="Clear the whole build"
                className={`flex h-8 items-center gap-1.5 rounded-[2px] px-3 text-[13px] font-semibold text-slate transition-colors duration-[120ms] hover:bg-blood/15 hover:text-blood-lit ${FOCUS_RING}`}
            >
                <ClearGlyph />
                Clear
            </button>
        </div>
    );
}

/**
 * Zoom + fullscreen as one bar. View-only, both modes. Renders just the
 * plaque; the caller positions it.
 */
export function ZoomBar({
    onZoomIn,
    onZoomOut,
    fullscreen,
    onToggleFullscreen,
}: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    fullscreen: boolean;
    onToggleFullscreen: () => void;
}) {
    return (
        <div className={`flex h-10 items-center gap-0.5 ${PLAQUE}`}>
            <button
                type="button"
                onClick={onZoomIn}
                title="Zoom in"
                aria-label="Zoom in"
                className={ICON_SEGMENT}
            >
                <Plus size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={onZoomOut}
                title="Zoom out"
                aria-label="Zoom out"
                className={ICON_SEGMENT}
            >
                <Minus size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </button>
            <Divider />
            <button
                type="button"
                onClick={onToggleFullscreen}
                title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                className={ICON_SEGMENT}
            >
                <FullscreenIcon active={fullscreen} />
            </button>
        </div>
    );
}

/** Sliders glyph for the mobile "Tools" toggle. */
export function ToolsGlyph() {
    return (
        <SlidersHorizontal
            size={15}
            strokeWidth={ICON_STROKE}
            className="shrink-0"
            aria-hidden="true"
        />
    );
}

function FullscreenIcon({ active }: { active: boolean }) {
    const Icon = active ? Minimize : Maximize;

    return <Icon size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />;
}
