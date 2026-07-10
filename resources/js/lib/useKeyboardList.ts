import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

/**
 * Arrow-key navigation for a picker's result list: ArrowDown/Up move a highlight
 * (starting from the search input), Enter picks the highlighted item, Escape closes.
 * The highlighted row is scrolled into view. Reset whenever the items change.
 */
export function useKeyboardList<T>(
    items: T[],
    onSelect: (item: T) => void,
    onClose: () => void,
) {
    const [highlight, setHighlight] = useState(-1);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset the highlight whenever the result set changes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHighlight(-1);
    }, [items]);

    useEffect(() => {
        if (highlight >= 0) {
            listRef.current
                ?.querySelector(`[data-idx="${highlight}"]`)
                ?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlight]);

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((current) => Math.min(items.length - 1, current + 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((current) => Math.max(0, current - 1));
        } else if (event.key === 'Enter') {
            const item = items[highlight];

            if (item !== undefined) {
                event.preventDefault();
                onSelect(item);
            }
        } else if (event.key === 'Escape') {
            onClose();
        }
    }

    return { highlight, setHighlight, onKeyDown, listRef };
}
