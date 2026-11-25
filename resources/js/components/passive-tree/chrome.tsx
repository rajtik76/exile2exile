import { X } from 'lucide-react';
import { ClassPortrait, classPortrait } from '@/components/build/classPortrait';

/**
 * Shared working-tier chrome for the passive-tree controls. Both the on-canvas
 * controls inside {@link PassiveTreeView} (search, budgets, zoom) and the
 * planner bar on the /tree page ({@link PlannerControls}) are built from the
 * same shells and hairlines, so they read as one set even though they live in
 * two places.
 */

/** Stroke width of every line icon in the tools. */
export const ICON_STROKE = 1.6;

/** The ember focus ring every control in the tree chrome shares. */
export const FOCUS_RING =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-400';

/**
 * A control floating over the canvas: flat stone behind a strong line border,
 * with the shadow only floating layers carry.
 */
export const PLAQUE =
    'rounded-[2px] border border-line-strong bg-stone-900/95 p-1 shadow-lg shadow-black/45 backdrop-blur-sm';

/** Colour treatment of a quiet control inside a plaque or a field. */
const SEGMENT_TONE = `text-slate transition-colors duration-[120ms] hover:bg-stone-700 hover:text-paper ${FOCUS_RING}`;

/** An icon-button segment - zoom and fullscreen. */
export const ICON_SEGMENT = `grid size-8 place-items-center rounded-[2px] ${SEGMENT_TONE}`;

/** A small icon button sitting inside a text field (clear, hint). */
export const FIELD_ICON_BUTTON = `grid size-6 shrink-0 place-items-center rounded-[2px] text-mist transition-colors duration-[120ms] hover:text-paper ${FOCUS_RING}`;

/** A text field shell that holds an icon, the input and its inline buttons. */
export const FIELD_SHELL =
    'rounded-[2px] border border-line bg-void transition-[border-color,box-shadow] duration-[120ms] hover:border-line-strong focus-within:border-ember-400 focus-within:shadow-[0_0_0_3px_rgba(255,154,77,0.22)]';

/** The bare input inside a {@link FIELD_SHELL}. 16px on phones stops iOS zooming in on focus. */
export const FIELD_INPUT =
    'h-full min-w-0 flex-1 bg-transparent font-ui text-base text-paper outline-none placeholder:text-sm placeholder:text-mist md:text-[15px]';

/** Side padding of the bars above the canvas, matching the masthead's. */
export const BAR_GUTTER = 'px-[min(3.4%,76px)] max-[820px]:px-[6%]';

/** A small message pinned under a control: what went wrong with it. */
export const FIELD_ERROR =
    'notice notice-bad absolute top-full z-30 mt-1.5 px-3 py-1.5 text-[13px] text-blood-lit shadow-lg shadow-black/45';

/** Section label in the face's own small caps. */
export const LABEL = 'font-label text-[15px] tracking-[0.06em] text-pewter-300';

/** Hairline between segments - a thin seam dividing one kind from another. */
export function Divider({
    orientation = 'vertical',
}: {
    orientation?: 'vertical' | 'horizontal';
}) {
    return orientation === 'vertical' ? (
        <span className="mx-0.5 h-5 w-px bg-line-strong" aria-hidden="true" />
    ) : (
        <span className="my-0.5 h-px w-5 bg-line-strong" aria-hidden="true" />
    );
}

/** Small cross to wipe an input field or close a panel. */
export function ClearGlyph() {
    return <X size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />;
}

/**
 * The round holder of a class or ascendancy portrait, in a pewter ring. The
 * portraits are the game's own round art, so this is the one round shape in
 * the chrome.
 */
export const MEDALLION =
    'grid shrink-0 place-items-center overflow-hidden rounded-full border border-pewter-700 bg-[radial-gradient(circle_at_50%_30%,#1a2531,#05080c_80%)]';

/** A class or ascendancy portrait; the class initial where no art exists. */
export function Medallion({
    className,
    ascendancy = null,
    size,
}: {
    className: string;
    ascendancy?: string | null;
    size: number;
}) {
    return (
        <span className={MEDALLION} style={{ width: size, height: size }}>
            {classPortrait(className, ascendancy) !== null ? (
                <ClassPortrait
                    className={className}
                    ascendancy={ascendancy}
                    size={size}
                />
            ) : (
                <span
                    className="font-display text-paper"
                    style={{ fontSize: Math.round(size * 0.42) }}
                >
                    {className.charAt(0).toUpperCase()}
                </span>
            )}
        </span>
    );
}
