import { cn } from '@/lib/utils';

/**
 * Shared planner typography primitives - the eyebrow, field label, headings and
 * hairline divider. Fontin carries headings and section labels (its own small
 * caps, never letter-spaced capitals); anything small is the UI face. Use these
 * instead of ad-hoc spans so every surface reads identically.
 */

/** Small label over a form field or a group: UI face, never capitals. */
export const LABEL_CLASS = 'pl-text-xs font-medium text-[var(--pl-muted)]';

/** Section label in the face's own small caps (e.g. "Build planner"). */
export function Eyebrow({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <p
            className={cn(
                'font-label text-[15px] tracking-[0.06em] text-pewter-300',
                className,
            )}
        >
            {children}
        </p>
    );
}

/** Small label above a form field or group. */
export function FieldLabel({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return <p className={cn(LABEL_CLASS, className)}>{children}</p>;
}

/** Page or section heading in the display face. */
export function Heading({
    level = 2,
    children,
    className,
}: {
    level?: 1 | 2;
    children: React.ReactNode;
    className?: string;
}) {
    const Tag = level === 1 ? 'h1' : 'h2';

    return (
        <Tag
            className={cn(
                'font-display font-normal text-[var(--pl-heading)]',
                level === 1
                    ? 'pl-text-3xl leading-[1.1] [word-spacing:-0.1em]'
                    : 'pl-text-lg leading-[1.2]',
                className,
            )}
        >
            {children}
        </Tag>
    );
}

/** Faint hairline rule separating stacked content. */
export function Divider({ className }: { className?: string }) {
    return (
        <div
            className={cn('h-px w-full', className)}
            style={{ background: 'var(--pl-divider)' }}
        />
    );
}
