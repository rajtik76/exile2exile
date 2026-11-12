/**
 * Shared slate chrome for the passive-tree controls. Both the
 * on-canvas controls inside {@link PassiveTreeView} (search, zoom) and the
 * planner bar on the /tree page ({@link PlannerControls}) are built from the
 * same plaque shell and hairline seams, so they read as one set even though they
 * now live in two places.
 */

/**
 * Every floating control - the search/zoom rail and the planner's sigil-bar - is
 * the same slate panel: a rounded shell holding segments
 * split by hairlines.
 */
export const PLAQUE =
    'rounded-xl border border-[#343a4a] bg-[#1b1e28]/95 p-1 shadow-lg shadow-black/45 backdrop-blur-sm';

/**
 * The build planner's reading face for tree control labels and buttons.
 */
export const PANEL_FONT = {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};

/**
 * The existing reading face for shared game text and links.
 */
export const INPUT_FONT = { fontFamily: "'Fontin', serif" };

/** An icon-button segment - zoom and fullscreen share it with the pickers. */
export const ICON_SEGMENT =
    'grid size-8 place-items-center rounded-lg text-[#e8ebf4] transition-colors hover:bg-[#8098ff]/10 focus-visible:bg-[#8098ff]/12 focus-visible:outline-none';

/** Hairline between segments - a thin seam dividing one kind from another. */
export function Divider({
    orientation = 'vertical',
}: {
    orientation?: 'vertical' | 'horizontal';
}) {
    return orientation === 'vertical' ? (
        <span className="mx-0.5 h-5 w-px bg-[#343a4a]" aria-hidden="true" />
    ) : (
        <span className="my-0.5 h-px w-5 bg-[#343a4a]" aria-hidden="true" />
    );
}

/** Small cross to wipe an input field, shown while it holds text. */
export function ClearGlyph() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M6 6l12 12M18 6L6 18" />
        </svg>
    );
}
