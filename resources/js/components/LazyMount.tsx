import { useEffect, useRef, useState } from 'react';

/**
 * Delays mounting `children` until the wrapper is about to enter the viewport
 * (an `IntersectionObserver`, `rootMargin` ahead so it is ready before the user
 * actually scrolls it into view), showing `fallback` until then. For content
 * expensive to mount - a WebGL canvas, a heavy chart - that a page renders
 * below the fold and a chunk of visitors never scroll to.
 *
 * Mounts once and never unmounts again on scrolling away: this is a load-time
 * defer, not a virtualization/visibility toggle.
 *
 * Always starts on `fallback`, on the server and the client alike - this page
 * is server-rendered (Inertia SSR), and Node has no `IntersectionObserver`, so
 * deciding the initial state from it during render (or a lazy `useState`
 * initializer, which also runs during SSR) would make the server and the
 * client's first render disagree and React would discard the SSR markup on
 * hydration - the exact cost this component exists to avoid. Every
 * environment check and the observer itself only ever run from the effect
 * below, which SSR never executes.
 */
export default function LazyMount({
    children,
    fallback,
    rootMargin = '300px',
    className = '',
}: {
    /** Mounted once the wrapper nears the viewport. */
    children: React.ReactNode;
    /** Shown in place of `children` until the wrapper nears the viewport. */
    fallback: React.ReactNode;
    /** How far ahead of the viewport to start mounting. */
    rootMargin?: string;
    /** Applied to the wrapper `<div>` at all times, mounted or not. */
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;

        if (!node || visible) {
            return;
        }

        // No IntersectionObserver (very old browsers, some test environments):
        // mount right away rather than never. Only reached client-side, so this
        // is not a render-time decision - the lint rule's usual objection to
        // setState-in-effect doesn't apply.
        if (typeof IntersectionObserver === 'undefined') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setVisible(true);

            return;
        }

        // Disconnecting is left to the cleanup below, run by React itself once
        // `visible` flips true and this effect re-runs - not done here too, or
        // it would be disconnected twice for no reason.
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    setVisible(true);
                }
            },
            { rootMargin },
        );

        observer.observe(node);

        return () => observer.disconnect();
    }, [rootMargin, visible]);

    return (
        <div ref={ref} className={className}>
            {visible ? children : fallback}
        </div>
    );
}
