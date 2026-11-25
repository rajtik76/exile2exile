import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    FOCUS_RING,
    ICON_STROKE,
    PLAQUE,
} from '@/components/passive-tree/chrome';
import { useHydrated } from '@/hooks/use-hydrated';

/** How far down the page the reader must scroll before the button appears. */
const SHOW_AFTER_PX = 480;

/**
 * A button fixed at the bottom-right corner that carries the reader back to the top
 * of a long build guide - the site header does not stay pinned, so this is the only
 * quick way up short of the browser's own scrollbar. A floating plaque like the tree
 * controls. Rendered through a portal straight into `<body>` so its stacking order
 * never depends on a page ancestor (the site footer, painted later in the DOM, would
 * otherwise sit above it despite a higher z-index of its own).
 */
export default function ScrollToTop() {
    const hydrated = useHydrated();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);

        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    function activate(): void {
        const reduceMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;

        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    if (!hydrated) {
        return null;
    }

    return createPortal(
        <button
            type="button"
            onClick={activate}
            title="Back to top"
            aria-label="Back to top"
            aria-hidden={!visible}
            tabIndex={visible ? 0 : -1}
            className={`${PLAQUE} ${FOCUS_RING} fixed right-4 bottom-4 z-[9999] grid size-11 place-items-center text-slate transition-[opacity,color,border-color] duration-[120ms] hover:border-ember-400 hover:text-ember-300 sm:right-6 sm:bottom-6 ${
                visible ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
        >
            <ArrowUp size={18} strokeWidth={ICON_STROKE} aria-hidden />
        </button>,
        document.body,
    );
}
