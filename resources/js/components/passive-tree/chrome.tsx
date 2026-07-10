/**
 * Shared engraved-bronze chrome for the passive-tree controls. Both the
 * on-canvas controls inside {@link PassiveTreeView} (search, zoom) and the
 * planner bar on the /tree page ({@link PlannerControls}) are built from the
 * same plaque shell and hairline seams, so they read as one set even though they
 * now live in two places.
 */

/**
 * Every floating control - the search/zoom rail and the planner's sigil-bar - is
 * the same engraved bronze plaque: a single rounded shell holding pill segments
 * split by hairlines.
 */
export const PLAQUE =
    'rounded-full border border-[#6e5526] bg-gradient-to-b from-[#15100a] to-[#0b0805] p-1 opacity-95 shadow-lg shadow-black/45 backdrop-blur-sm';

/**
 * The passive-node tooltip's title face. Set on a chrome container so every label,
 * counter and button inherits it (Tailwind's preflight gives form controls
 * `font: inherit`), making the whole control set read in the in-game tooltip face.
 */
export const PANEL_FONT = { fontFamily: "'Fontin SmallCaps', 'Cinzel', serif" };

/**
 * The face for free-text fields (PoB import, node search, share URL). The SmallCaps
 * {@link PANEL_FONT} reads poorly white and small and shouldn't capitalise what the
 * user typed or pasted, so typed text falls back to plain Fontin.
 */
export const INPUT_FONT = { fontFamily: "'Fontin', serif" };

/** A round icon-button segment - zoom and fullscreen share it with the pickers. */
export const ICON_SEGMENT =
    'grid size-8 place-items-center rounded-full text-[#f5ecd8] transition-colors hover:bg-[#f0c869]/10 focus-visible:bg-[#f0c869]/12 focus-visible:outline-none';

/** Hairline between segments - a thin engraved seam dividing one kind from another. */
export function Divider({
    orientation = 'vertical',
}: {
    orientation?: 'vertical' | 'horizontal';
}) {
    return orientation === 'vertical' ? (
        <span className="mx-0.5 h-5 w-px bg-[#3a2f18]" aria-hidden="true" />
    ) : (
        <span className="my-0.5 h-px w-5 bg-[#3a2f18]" aria-hidden="true" />
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
