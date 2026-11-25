import { cn } from '@/lib/utils';

type Shape = 'pill' | 'circle' | 'block';

/**
 * Shape only - the dashed pewter outline and text size are fixed so every "add"
 * affordance reads the same. `pill` carries its own size (labelled buttons);
 * `circle`/`block` are sized by the caller's className (icon slots). The circle
 * exists because gems are round game art.
 */
const SHAPES: Record<Shape, string> = {
    pill: 'h-[30px] px-3',
    circle: 'rounded-full',
    block: '',
};

/** The shared "+" glyph - a label prefix (leadingPlus) or the whole icon (icon). */
function PlusGlyph({ className }: { className?: string }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
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
 * "Add socket". They share the `.chip-add` dashed frame; only the shape (and,
 * for icon slots, the size via className) differs per call site.
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
                'chip-add',
                solid && 'border-solid',
                SHAPES[shape],
                className,
            )}
            {...props}
        >
            {leadingPlus && <PlusGlyph />}
            {icon ? <PlusGlyph className="size-[1.4em]" /> : children}
        </button>
    );
}
