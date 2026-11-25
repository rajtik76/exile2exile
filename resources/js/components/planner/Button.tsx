import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'danger' | 'done';
type Size = 'sm' | 'md';

/**
 * Copper is the one main action of a screen, iron every ordinary button, danger
 * the destructive one; `done` is iron confirming a finished action (copied).
 */
const VARIANTS: Record<Variant, string> = {
    primary: 'btn-copper',
    ghost: 'btn-iron',
    danger: 'btn-danger',
    done: 'btn-iron border-verdigris text-verdigris',
};

/**
 * The single button used across the build planner, so Save, "Add entry", delete
 * and every toggle share one look - the shared `.btn` classes of the working
 * tier. `active` applies the pressed state (for toggles); `icon` makes a square
 * icon button.
 */
export default function Button({
    variant = 'ghost',
    size = 'md',
    active = false,
    icon = false,
    leadingPlus = false,
    type = 'button',
    className,
    children,
    ...props
}: React.ComponentProps<'button'> & {
    variant?: Variant;
    size?: Size;
    active?: boolean;
    icon?: boolean;
    /** Prefix an optically-centred "+" glyph (for the "add" buttons). */
    leadingPlus?: boolean;
}) {
    return (
        <button
            type={type}
            aria-pressed={active || undefined}
            className={cn(
                'btn',
                VARIANTS[variant],
                active && 'btn-on',
                size === 'sm' && 'btn-sm',
                icon && 'size-7 p-0',
                className,
            )}
            {...props}
        >
            {leadingPlus && (
                <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    className="size-[1.1em] shrink-0"
                >
                    <path d="M8 3.5 V12.5 M3.5 8 H12.5" />
                </svg>
            )}
            {children}
        </button>
    );
}

/**
 * A segmented control (Phases/No tabs, Edit/Preview, Skill/Support, type filter):
 * one sunken group, the active option lifted with an ember underline.
 */
export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    className,
}: {
    options: Array<{
        value: T;
        label: React.ReactNode;
        title?: string;
        ariaLabel?: string;
    }>;
    value: T;
    onChange: (value: T) => void;
    className?: string;
}) {
    return (
        <div className={cn('seg', className)}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    title={option.title}
                    aria-label={option.ariaLabel}
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className="capitalize"
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
