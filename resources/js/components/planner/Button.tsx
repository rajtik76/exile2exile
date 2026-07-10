import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const BASE =
    'inline-flex items-center justify-center gap-1.5 rounded-[var(--pl-radius)] border-2 font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-ring)] disabled:cursor-not-allowed disabled:opacity-50';

/** The recurring active/selected state (tabs, segmented controls). */
const ACTIVE =
    'border-[var(--pl-accent)] bg-[var(--pl-accent-soft)] text-[var(--pl-accent-lit)]';

const VARIANTS: Record<Variant, string> = {
    primary:
        'border-[var(--pl-accent)] bg-[var(--pl-accent)] text-[#15120b] hover:enabled:bg-[var(--pl-accent-lit)] hover:enabled:border-[var(--pl-accent-lit)]',
    ghost: 'border-[var(--pl-panel-border)] text-[var(--pl-text)] hover:enabled:border-[var(--pl-accent)] hover:enabled:text-[var(--pl-accent-lit)]',
    danger: 'border-[var(--pl-danger)] bg-[var(--pl-danger-soft)] text-[var(--pl-danger-lit)] hover:enabled:brightness-125',
};

// Paddings are em-based (matched to the desktop px at the 16px base) so they scale
// with --pl-font-size, shrinking the whole control on phones without touching desktop.
const SIZES: Record<Size, string> = {
    sm: 'px-[0.625em] py-[0.25em] pl-text-xs',
    md: 'px-[1em] py-[0.5em] pl-text-sm',
};

/**
 * The single button used across the build planner, so Save, tabs, "+ Reference",
 * "Add entry", delete and every toggle share one look. `active` applies the
 * selected state (for tabs/segments); `icon` makes a square icon button. Styling
 * is driven entirely by the --pl-* design tokens, so it re-skins with the design.
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
            className={cn(
                BASE,
                active ? ACTIVE : VARIANTS[variant],
                icon ? 'pl-text-sm size-[1.75em] p-0' : SIZES[size],
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
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="mr-0.5 size-[1.1em] shrink-0"
                >
                    <path d="M8 3.5 V12.5 M3.5 8 H12.5" />
                </svg>
            )}
            {children}
        </button>
    );
}

/**
 * A segmented control (Phases/No tabs, Edit/Preview, Skill/Support, type filter)
 * built from the shared button look - one bordered group, the active option lit.
 */
export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    className,
}: {
    options: Array<{ value: T; label: React.ReactNode; title?: string }>;
    value: T;
    onChange: (value: T) => void;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'inline-flex overflow-hidden rounded-[var(--pl-radius)] border-2 border-[var(--pl-panel-border)]',
                className,
            )}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    title={option.title}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'pl-text-sm px-[0.75em] py-[0.25em] font-medium capitalize transition',
                        value === option.value
                            ? 'bg-[var(--pl-accent-soft)] text-[var(--pl-accent-lit)]'
                            : 'text-[var(--pl-muted)] hover:text-[var(--pl-accent-lit)]',
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
