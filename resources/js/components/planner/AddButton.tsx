import { cn } from '@/lib/utils';

type Shape = 'pill' | 'circle' | 'block';

/**
 * Shape only - the dashed border, accent colour and text size are fixed so every
 * "add" affordance reads the same. `pill` carries its own padding (labelled
 * buttons); `circle`/`block` are sized by the caller's className (icon slots).
 */
const SHAPES: Record<Shape, string> = {
    pill: 'rounded-[var(--pl-radius)] px-[0.75em] py-[0.375em]',
    circle: 'rounded-full',
    block: 'rounded-[var(--pl-radius)]',
};

/** The shared frame: 2px border, text size, focus ring - colour/style is layered on. */
const FRAME =
    'pl-text-sm inline-flex items-center justify-center gap-1.5 border-2 font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-ring)] disabled:cursor-not-allowed disabled:opacity-50';

/** The empty "add" look - dashed accent outline that lights on hover. */
const DASHED =
    'border-dashed border-[var(--pl-accent)] text-[var(--pl-accent)] hover:enabled:bg-[var(--pl-accent-soft)]';

/** The shared "+" glyph - a label prefix (leadingPlus) or the whole icon (icon). */
function PlusGlyph({ className }: { className?: string }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={cn('size-[1.1em] shrink-0', className)}
        >
            <path d="M8 3.5 V12.5 M3.5 8 H12.5" />
        </svg>
    );
}

/**
 * The single "add" button across the planner - "Reference", "Gem group", the
 * empty Skill/support gem slots, "Add entry", "Add phase", "Add modifier",
 * "Add socket". They share one 2px dashed frame and one text size; only the shape
 * (and, for icon slots, the size via className) differs per call site.
 */
export default function AddButton({
    shape = 'pill',
    leadingPlus = false,
    icon = false,
    solid = false,
    type = 'button',
    className,
    children,
    ...props
}: React.ComponentProps<'button'> & {
    shape?: Shape;
    /** Prefix an optically-centred "+" glyph (for the labelled add buttons). */
    leadingPlus?: boolean;
    /** Render a lone, centred "+" glyph - the icon-only add slots. */
    icon?: boolean;
    /** A solid (not dashed) frame - the filled state; colour/bg come from className/style. */
    solid?: boolean;
}) {
    return (
        <button
            type={type}
            className={cn(
                FRAME,
                solid ? 'border-solid' : DASHED,
                SHAPES[shape],
                className,
            )}
            {...props}
        >
            {leadingPlus && <PlusGlyph className="mr-0.5" />}
            {icon ? <PlusGlyph className="size-[1.4em]" /> : children}
        </button>
    );
}
