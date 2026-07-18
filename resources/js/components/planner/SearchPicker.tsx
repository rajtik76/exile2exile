import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/planner/Button';
import { TextInput } from '@/components/planner/ui/Field';
import { PopoverCard } from '@/components/planner/ui/Overlay';
import { useKeyboardList } from '@/lib/useKeyboardList';
import { cn } from '@/lib/utils';

/** Popover width in px (Tailwind w-80) and the gap kept from the viewport edges. */
const POPOVER_WIDTH = 320;
const VIEWPORT_MARGIN = 8;
/** Rough popover height used only to keep it on-screen near the viewport bottom. */
const POPOVER_ESTIMATED_HEIGHT = 380;

/**
 * The one search dropdown used by every planner picker (item/gem/rune references and
 * item modifiers). It owns the popover shell, the debounced search box, the result
 * list and the arrow-key navigation (Down/Up move the highlight, Enter picks, Escape
 * closes) - so all pickers look and behave identically. Each caller only supplies how
 * to fetch its options and how to render one row.
 */
export default function SearchPicker<T>({
    search,
    keyOf,
    renderOption,
    onSelect,
    onClose,
    placeholder,
    header,
    emptyText = 'No matches.',
    loadingText = 'Searching…',
    deps = [],
    debounceMs = 250,
    className,
    anchorEl,
    width = POPOVER_WIDTH,
    highlightKey,
    initialQuery = '',
}: {
    /** Fetch the options for a query; resolve to [] for a blank query if none apply. */
    search: (query: string) => Promise<T[]>;
    keyOf: (item: T, index: number) => string;
    /** The inner content of an option's button. */
    renderOption: (item: T, highlighted: boolean) => React.ReactNode;
    onSelect: (item: T) => void;
    onClose: () => void;
    placeholder?: string;
    /** Optional controls between the search box and the list (e.g. a type filter). */
    header?: React.ReactNode;
    emptyText?: string;
    loadingText?: string;
    /** Refetch whenever one of these changes (besides the query). List every fetch input. */
    deps?: React.DependencyList;
    debounceMs?: number;
    className?: string;
    /** The element to anchor the popover under (the button/thumb that opened it). When
     * omitted it falls back to the picker's positioned-ancestor box. */
    anchorEl?: HTMLElement | null;
    /** Popover width in px; defaults to the standard 320. Widen it when the header
     * controls (e.g. a multi-option type filter) need more room than the list. */
    width?: number;
    /** Pre-highlight the row whose `keyOf` equals this, once results load (e.g. the
     * currently-set mod when re-opening its picker). Others stay fully selectable. */
    highlightKey?: string;
    /** The search box's starting value - every other picker opens blank; the item
     *  modifier picker seeds it with the row's current text when changing one. */
    initialQuery?: string;
}) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const requestId = useRef(0);
    const { highlight, setHighlight, onKeyDown, listRef } = useKeyboardList(
        results,
        onSelect,
        onClose,
    );

    // The card is portalled to <body> so it can spill past the panel's overflow-hidden
    // clip (and layer above a slot-editor modal). It's positioned `absolute` in page
    // coordinates (viewport rect + scroll offset), so it scrolls with the page instead
    // of staying pinned to the viewport like a `fixed` element would.
    const anchorRef = useRef<HTMLSpanElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{
        left: number;
        top: number;
        above: boolean;
        width: number;
    } | null>(null);

    // The trigger that opened the popover - whatever held focus when it first
    // rendered (the just-clicked button), captured once before the search box
    // autofocuses. Exempting it from the outside-close lets a toggle trigger still close
    // via its own handler; otherwise the close and the re-toggle would fight and it'd
    // never shut. Lazy initialiser so it reads activeElement exactly once, on mount.
    const [opener] = useState<Element | null>(() =>
        typeof document !== 'undefined' ? document.activeElement : null,
    );

    // Close on a click anywhere outside the popover (and outside the opening trigger).
    useEffect(() => {
        function onPointerDown(event: PointerEvent): void {
            const target = event.target as Node;

            if (
                cardRef.current?.contains(target) ||
                anchorEl?.contains(target) ||
                opener?.contains(target)
            ) {
                return;
            }

            onClose();
        }

        document.addEventListener('pointerdown', onPointerDown, true);

        return () =>
            document.removeEventListener('pointerdown', onPointerDown, true);
    }, [anchorEl, onClose, opener]);

    useLayoutEffect(() => {
        function place(): void {
            const anchor = anchorRef.current;

            if (!anchor) {
                return;
            }

            // Anchor to the exact trigger (the clicked button/thumb) when given, so the
            // popover opens right by it; otherwise fall back to the picker's
            // positioned-ancestor box rather than wherever an empty span flows to.
            const host =
                anchorEl ??
                (anchor.offsetParent as HTMLElement | null) ??
                anchor;
            const rect = host.getBoundingClientRect();

            // The desired width, capped so the card never spills past the viewport on
            // narrow screens - it grows up to `width` only when there's room for it.
            const effectiveWidth = Math.min(
                width,
                window.innerWidth - 2 * VIEWPORT_MARGIN,
            );

            const leftInViewport = Math.max(
                VIEWPORT_MARGIN,
                Math.min(
                    rect.left,
                    window.innerWidth - effectiveWidth - VIEWPORT_MARGIN,
                ),
            );

            // Open above the trigger by default; flip below only when there isn't room
            // for the popover between the trigger and the top of the viewport.
            const above =
                rect.top >= POPOVER_ESTIMATED_HEIGHT + VIEWPORT_MARGIN;
            const topInViewport = above ? rect.top - 4 : rect.bottom + 4;

            setPosition({
                left: leftInViewport + window.scrollX,
                top: topInViewport + window.scrollY,
                above,
                width: effectiveWidth,
            });
        }

        place();
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);

        return () => {
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [anchorEl, width]);

    useEffect(() => {
        const id = ++requestId.current;
        const trimmed = query.trim();
        const delay = trimmed === '' ? 0 : debounceMs;

        const timer = window.setTimeout(() => {
            setLoading(true);

            Promise.resolve(search(query))
                .then((items) => {
                    if (id === requestId.current) {
                        setResults(items);
                        setLoading(false);
                    }
                })
                .catch(() => {
                    if (id === requestId.current) {
                        setResults([]);
                        setLoading(false);
                    }
                });
        }, delay);

        return () => window.clearTimeout(timer);
        // `search` is a fresh closure each render; the caller lists its real inputs in deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, ...deps]);

    // Pre-highlight the requested row once results arrive. Runs after useKeyboardList's
    // reset-to-(-1)-on-items-change effect (declared earlier), so it wins.
    useEffect(() => {
        if (!highlightKey) {
            return;
        }

        const index = results.findIndex(
            (item, position) => keyOf(item, position) === highlightKey,
        );

        if (index >= 0) {
            setHighlight(index);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [results, highlightKey]);

    const card = (
        <PopoverCard className={cn('w-full p-2', className)}>
            <div className="mb-2 flex items-center gap-1.5">
                <TextInput
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    className="flex-1"
                />
                <Button icon onClick={onClose} title="Close">
                    ✕
                </Button>
            </div>

            {header}

            <div ref={listRef} className="max-h-64 overflow-y-auto">
                {loading && results.length === 0 && (
                    <p className="pl-text-xs px-1 py-2 text-[var(--pl-muted)]">
                        {loadingText}
                    </p>
                )}

                {!loading && results.length === 0 && query.trim() !== '' && (
                    <p className="pl-text-xs px-1 py-2 text-[var(--pl-muted)]">
                        {emptyText}
                    </p>
                )}

                <ul className="flex flex-col">
                    {results.map((item, index) => (
                        <li key={keyOf(item, index)}>
                            <button
                                type="button"
                                data-idx={index}
                                onClick={() => onSelect(item)}
                                onMouseEnter={() => setHighlight(index)}
                                className={cn(
                                    'flex w-full items-start gap-2 rounded-[var(--pl-radius)] px-1.5 py-1.5 text-left transition',
                                    index === highlight &&
                                        'bg-[var(--pl-accent-soft)]',
                                )}
                            >
                                {renderOption(item, index === highlight)}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </PopoverCard>
    );

    return (
        // Zero-size anchor pinned to the nearest positioned ancestor's top-left (where
        // the old in-panel popover sat) - an in-flow span would be shoved to the row's
        // far right by the card's `ml-auto` remove button. We measure it, then portal.
        <span ref={anchorRef} className="absolute top-0 left-0 h-0 w-0">
            {typeof document !== 'undefined' &&
                position !== null &&
                createPortal(
                    <div
                        ref={cardRef}
                        className="planner-reading absolute z-[210]"
                        style={{
                            left: position.left,
                            top: position.top,
                            width: position.width,
                            transform: position.above
                                ? 'translateY(-100%)'
                                : undefined,
                        }}
                    >
                        {card}
                    </div>,
                    document.body,
                )}
        </span>
    );
}
