/**
 * The gems panel offers two layouts: the compact icon grid and a roomier list with
 * visible gem names. The choice is a display preference (not plan data), remembered in
 * localStorage so it carries across builds and reloads.
 */
export type GemsView = 'grid' | 'list';

export const DEFAULT_GEMS_VIEW: GemsView = 'grid';

const STORAGE_KEY = 'planner-gems-view';

/** The remembered gems layout, or the default when unset/unavailable (SSR, private mode). */
export function loadGemsView(): GemsView {
    if (typeof window === 'undefined') {
        return DEFAULT_GEMS_VIEW;
    }

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);

        return stored === 'list' || stored === 'grid'
            ? stored
            : DEFAULT_GEMS_VIEW;
    } catch {
        return DEFAULT_GEMS_VIEW;
    }
}

/** Remember the chosen gems layout; a storage failure is non-fatal (preference is lost). */
export function saveGemsView(view: GemsView): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, view);
    } catch {
        // Storage unavailable (private mode / quota) - the preference just won't persist.
    }
}
