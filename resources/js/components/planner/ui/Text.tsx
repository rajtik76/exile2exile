import { cn } from '@/lib/utils';

/**
 * Shared planner typography primitives - the eyebrow, field label, headings and
 * hairline divider. All read the --pl-* tokens so weight, tracking, colour and the
 * heading face swap with the design. Use these instead of ad-hoc text-[#..] spans
 * so every surface reads identically.
 */

/** Small accent-coloured uppercase kicker above a title (e.g. "Build planner"). */
export function Eyebrow({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <p
            className={cn('pl-text-xs uppercase', className)}
            style={{
                color: 'var(--pl-accent)',
                fontFamily: 'var(--pl-font-head)',
                fontWeight: 'var(--pl-label-weight)',
                letterSpacing: 'var(--pl-label-tracking)',
            }}
        >
            {children}
        </p>
    );
}

/** Muted uppercase label above a form field or group. */
export function FieldLabel({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <p
            className={cn('pl-text-2xs uppercase', className)}
            style={{
                color: 'var(--pl-faint)',
                fontWeight: 'var(--pl-label-weight)',
                letterSpacing: 'var(--pl-label-tracking)',
            }}
        >
            {children}
        </p>
    );
}

/** Page or section heading in the design's heading face. */
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
                level === 1 ? 'pl-text-2xl' : 'pl-text-lg',
                className,
            )}
            style={{
                color: 'var(--pl-heading)',
                fontFamily: 'var(--pl-font-head)',
                fontWeight: 'var(--pl-heading-weight)',
            }}
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
