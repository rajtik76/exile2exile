import type { AllocMode, WeaponSet } from '@poe2-toolkit/tree-core';
import { DEFAULT_TREE_COLORS } from '@poe2-toolkit/tree-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import {
    ClearGlyph,
    Divider,
    ICON_SEGMENT,
    INPUT_FONT,
    PLAQUE,
} from './chrome';
import { hexColor } from './treeBudgets';

/**
 * Weapon-set accent colours, derived from the renderer's default set tints (set
 * I red, set II green, the in-game colours) so the counters and paint toggle
 * always read as the same sets drawn on the tree. The basic tree keeps the gold
 * chrome.
 */
export const WEAPON_SET_HEX: Record<WeaponSet, string> = {
    1: hexColor(DEFAULT_TREE_COLORS.weaponSet[1]),
    2: hexColor(DEFAULT_TREE_COLORS.weaponSet[2]),
};

/**
 * Gauge tint for the ascendancy budget - a violet, distinct from the gold basic
 * gauge and the weapon-set red/green, so the four budgets read as one family.
 */
const ASCENDANCY_HEX = '#b48ce0';

/**
 * Node search over names and stat lines, in the same bronze {@link PLAQUE}
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
                className={`flex h-10 items-center gap-1 pr-1 pl-3.5 transition-colors focus-within:border-[#a9842f] ${PLAQUE}`}
            >
                <SearchGlyph />
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
                    // Same split as the PoB import field: typed text in plain Fontin
                    // at a larger size, the placeholder in the bar's SmallCaps face.
                    style={INPUT_FONT}
                    className="h-full min-w-0 flex-1 bg-transparent text-base font-medium tracking-wide text-[#f5ecd8] outline-none placeholder:[font-family:'Fontin_SmallCaps',_'Cinzel',_serif] placeholder:text-sm placeholder:text-[#8a7850]"
                />
                {value !== '' && (
                    <button
                        type="button"
                        onClick={() => onValue('')}
                        title="Clear search"
                        aria-label="Clear search"
                        className="grid size-5 shrink-0 place-items-center rounded-full text-[#8a7850] transition-colors hover:bg-[#f0c869]/10 hover:text-[#ecc878] focus-visible:text-[#ecc878] focus-visible:outline-none"
                    >
                        <ClearGlyph />
                    </button>
                )}
                <SearchHint />
                <Divider />
                <span className="shrink-0 px-2 text-base font-medium tracking-wide text-[#f5ecd8] tabular-nums">
                    {matchCount}
                    <span className="text-[#ecc878]">
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
 * Regex support is invisible without this. Only the trigger wears the rail's
 * bronze; the panel is plain white on near-black, because a pattern has to be
 * legible character by character. Radix runs through its primitives to set
 * those colours directly, and the panel outranks the fullscreen canvas
 * (`z-[120]`).
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
                        className="grid size-5 shrink-0 place-items-center rounded-full text-[#8a7850] transition-colors hover:bg-[#f0c869]/10 hover:text-[#ecc878] focus-visible:text-[#ecc878] focus-visible:outline-none data-[state=delayed-open]:text-[#ecc878] data-[state=instant-open]:text-[#ecc878]"
                    >
                        <HintGlyph />
                    </button>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        side="bottom"
                        align="end"
                        sideOffset={16}
                        collisionPadding={12}
                        className="z-[200] max-w-[min(27rem,calc(100vw-1.5rem))] rounded-lg border border-white/15 bg-[#101215] px-4 py-3.5 font-sans text-[13px]/[1.5] text-white shadow-xl shadow-black/60"
                    >
                        <p>
                            Matches a node name or a stat line. Add regex
                            punctuation to search several at once.
                        </p>
                        <table className="mt-3 w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-white/30">
                                    <th className="border-r border-white/15 py-1.5 pr-3 font-semibold">
                                        Example
                                    </th>
                                    <th className="py-1.5 pl-3 font-semibold">
                                        Matches
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {SEARCH_EXAMPLES.map(({ query, effect }) => (
                                    <tr
                                        key={query}
                                        className="border-b border-white/15 last:border-b-0"
                                    >
                                        <td className="border-r border-white/15 py-1.5 pr-3 font-mono whitespace-nowrap text-[#4ade80]">
                                            {query}
                                        </td>
                                        <td className="py-1.5 pl-3">
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

/** Opens the search syntax hint. */
function HintGlyph() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9.25" />
            <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.9" />
            <path d="M12 17.4h.01" />
        </svg>
    );
}

/**
 * The point budgets in one compact plaque, doubling as the paint toggle: each
 * segment is a budget (Basic, Weapon set I/II) showing its `used/limit`, coloured
 * in its mode tint. While editing the segments are radio buttons picking the
 * paint target (the active one glows filled); read-only they just read out.
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
            color: '#ecc878',
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
        active: boolean,
    ): React.JSX.Element => (
        <span className="flex items-center gap-1.5">
            <span>{label}</span>
            <span
                className="text-[13px] tabular-nums"
                style={{
                    color: active
                        ? '#0b0805'
                        : used > limit
                          ? '#e0a04f'
                          : '#f5ecd8',
                }}
            >
                {used}/{limit}
            </span>
        </span>
    );

    return (
        <div
            className={`flex h-10 items-center gap-2 ${PLAQUE}`}
            role={onMode ? 'radiogroup' : undefined}
            aria-label="Point budgets"
        >
            <span className="pl-2 text-[11px] font-semibold tracking-[0.14em] text-[#8a7850] uppercase">
                Points
            </span>
            <Divider />
            <div className="flex items-center gap-0.5">
                {segments.map((segment) => {
                    const active = mode === segment.value;
                    const className =
                        'flex h-7 items-center rounded-full px-2.5 text-sm font-semibold tracking-wide transition-colors';
                    const style: CSSProperties = active
                        ? { color: '#0b0805', background: segment.color }
                        : { color: segment.color };

                    return onMode ? (
                        <button
                            key={segment.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onMode(segment.value)}
                            className={className}
                            style={style}
                        >
                            {segmentLabel(
                                segment.label,
                                segment.used,
                                segment.limit,
                                active,
                            )}
                        </button>
                    ) : (
                        <span
                            key={segment.value}
                            className={className}
                            style={style}
                        >
                            {segmentLabel(
                                segment.label,
                                segment.used,
                                segment.limit,
                                active,
                            )}
                        </span>
                    );
                })}

                {ascendancy && (
                    <>
                        <Divider />
                        <span
                            className="flex h-7 items-center rounded-full px-2.5 text-sm font-semibold tracking-wide"
                            style={{ color: ASCENDANCY_HEX }}
                            aria-label="Ascendancy points"
                        >
                            {segmentLabel(
                                'Asc',
                                ascendancy.used,
                                ascendancy.limit,
                                false,
                            )}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Wipe-the-whole-build button, in the same bronze plaque as the rest of the
 * canvas chrome. Clears every allocated node - basic, both weapon sets and the
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
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-[0.14em] text-[#b39a64] uppercase transition-colors hover:bg-[#eb6060]/15 hover:text-[#eb6060] focus-visible:bg-[#eb6060]/15 focus-visible:text-[#eb6060] focus-visible:outline-none"
            >
                <ClearGlyph />
                Clear
            </button>
        </div>
    );
}

/**
 * Zoom + fullscreen as one engraved bar. View-only, both modes. Renders just the
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
                className={`${ICON_SEGMENT} text-lg leading-none`}
            >
                +
            </button>
            <button
                type="button"
                onClick={onZoomOut}
                title="Zoom out"
                aria-label="Zoom out"
                className={`${ICON_SEGMENT} text-lg leading-none`}
            >
                −
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

/** Magnifier glyph for the node search. */
function SearchGlyph() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-[#8a7850]"
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
        </svg>
    );
}

/** Sliders glyph for the mobile "Tools" toggle. */
export function ToolsGlyph() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
            aria-hidden="true"
        >
            <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="8" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
        </svg>
    );
}

function FullscreenIcon({ active }: { active: boolean }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {active ? (
                <path d="M9 3v3a3 3 0 0 1-3 3H3m18 0h-3a3 3 0 0 1-3-3V3M3 15h3a3 3 0 0 1 3 3v3m6 0v-3a3 3 0 0 1 3-3h3" />
            ) : (
                <path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4m12-6v4a2 2 0 0 1-2 2h-4" />
            )}
        </svg>
    );
}
