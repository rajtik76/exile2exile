import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shrinks a fixed-size child to fit the available width, centred, without reflowing it.
 * The paper-doll (and any other rigid grid) keeps its exact geometry; on a narrow screen
 * it scales down instead of overflowing. A CSS transform is used, so the scaled box - not
 * the natural one - drives layout overflow, and the page never gains a horizontal scroll.
 * Never scales up past 1.
 */
export default function ScaleToFit({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const outerRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [height, setHeight] = useState<number | undefined>(undefined);

    useLayoutEffect(() => {
        const outer = outerRef.current;
        const inner = innerRef.current;

        if (!outer || !inner) {
            return;
        }

        // offsetWidth/Height are the pre-transform layout sizes, so they stay the child's
        // natural dimensions no matter the current scale - no measurement feedback loop.
        const measure = (): void => {
            const available = outer.clientWidth;
            const natural = inner.offsetWidth;
            const next = natural > 0 ? Math.min(1, available / natural) : 1;

            setScale(next);
            setHeight(inner.offsetHeight * next);
        };

        measure();

        // ResizeObserver is absent in the test (jsdom) environment; a one-off measure is
        // enough there.
        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(measure);
        observer.observe(outer);
        observer.observe(inner);

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={outerRef}
            className={cn('relative w-full', className)}
            style={{ height }}
        >
            <div
                ref={innerRef}
                className="absolute top-0 left-1/2 w-max"
                style={{
                    transform: `translateX(-50%) scale(${scale})`,
                    transformOrigin: 'top center',
                }}
            >
                {children}
            </div>
        </div>
    );
}
