/**
 * Shared jsdom shims. jsdom implements no matchMedia; the components that ask
 * (e.g. the slot editor's collapsed-sections-on-mobile default) treat a missing
 * implementation as "narrow viewport", which would put every component test in
 * mobile layout. Tests exercise the desktop defaults, so the shim matches
 * min-width queries the way a desktop viewport would.
 */
window.matchMedia = (query: string): MediaQueryList =>
    ({
        matches: query.includes('min-width'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    }) as MediaQueryList;
