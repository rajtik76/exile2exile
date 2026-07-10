import { useState } from 'react';
import { TEAL } from '@/components/brand';
import { cn } from '@/lib/utils';

/**
 * Build chrome: the framed section panel and its ornaments, used by the build
 * planner. Purely presentational.
 */

/** Curled quatrefoil filigree, four-fold symmetric. Purely decorative framing. */
export function Filigree() {
    const curl = 'M20 9 C 12 9 10 16 15.5 18 C 19 19.2 18 13.5 15.5 13.5';
    const arc = 'M20 11.5 C 16.5 14.5 16.5 17 20 18.5';

    return (
        <svg
            viewBox="0 0 40 40"
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
        >
            <g
                fill="none"
                stroke="#46454d"
                strokeWidth="1.4"
                strokeLinecap="round"
            >
                <circle cx="20" cy="20" r="3" />
                {[0, 90, 180, 270].map((deg) => (
                    <path
                        key={`c${deg}`}
                        d={curl}
                        transform={`rotate(${deg} 20 20)`}
                    />
                ))}
                {[45, 135, 225, 315].map((deg) => (
                    <path
                        key={`a${deg}`}
                        d={arc}
                        transform={`rotate(${deg} 20 20)`}
                        opacity="0.65"
                    />
                ))}
            </g>
        </svg>
    );
}

/**
 * Small arcane four-point star sigil. The recurring gold glyph that marks every
 * section title and the ascendancy line - a faint glow keeps it luminous without
 * competing with the text beside it.
 */
export function SigilGlyph({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            aria-hidden
            preserveAspectRatio="xMidYMid meet"
            style={{ filter: 'drop-shadow(0 0 4px rgba(201,162,74,0.55))' }}
        >
            <path
                d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
                fill={`${TEAL}33`}
                stroke={TEAL}
                strokeWidth="1.2"
                strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="1.3" fill="#e6ecf6" />
        </svg>
    );
}

/**
 * A larger arcane seal that sits on each corner of a dossier - concentric rings
 * around the four-point star, glowing gold. Purely decorative framing.
 */
export function SigilCorner({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 40 40"
            className={className}
            fill="none"
            aria-hidden
            preserveAspectRatio="xMidYMid meet"
            style={{ filter: 'drop-shadow(0 0 6px rgba(201,162,74,0.45))' }}
        >
            <g stroke={TEAL} strokeLinecap="round">
                <circle
                    cx="20"
                    cy="20"
                    r="9"
                    strokeWidth="1"
                    strokeOpacity="0.28"
                />
                <circle
                    cx="20"
                    cy="20"
                    r="5"
                    strokeWidth="1"
                    strokeOpacity="0.5"
                />
                <path
                    d="M20 2 L20 11 M20 29 L20 38 M2 20 L11 20 M29 20 L38 20"
                    strokeWidth="1.1"
                    strokeOpacity="0.65"
                />
            </g>
            <path
                d="M20 6 L22 18 L34 20 L22 22 L20 34 L18 22 L6 20 L18 18 Z"
                fill={`${TEAL}22`}
                stroke={TEAL}
                strokeWidth="1.1"
                strokeLinejoin="round"
                strokeOpacity="0.85"
            />
            <circle cx="20" cy="20" r="1.7" fill="#e6ecf6" />
        </svg>
    );
}

/**
 * Section header: a gold sigil and an engraved-but-legible title. Sans (not
 * Cinzel) at this size - chiselled serifs lose their edges below ~14px, and
 * readability wins over flavour here.
 */
export function PanelTitle({
    children,
    action,
}: {
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 border-b border-[#23222a] bg-gradient-to-r from-[#0c0c12] to-transparent px-5 py-3.5 sm:px-6">
            <SigilGlyph className="size-4 shrink-0" />
            <h2 className="text-[13px] font-semibold tracking-[0.26em] text-[#ecd49a] uppercase">
                {children}
            </h2>
            {action && <div className="ml-auto">{action}</div>}
        </div>
    );
}

/**
 * A round collapse toggle for a panel header: a gold chevron that points down when
 * the body is open and rotates to point right when it's hidden.
 */
function CollapseToggle({
    collapsed,
    onToggle,
}: {
    collapsed: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            title={collapsed ? 'Show panel' : 'Hide panel'}
            className="inline-flex size-6 items-center justify-center rounded-sm text-[#9aa0ac] transition outline-none hover:text-[#ecd49a] focus-visible:text-[#ecd49a]"
        >
            <svg
                viewBox="0 0 16 16"
                aria-hidden
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                    'size-3.5 transition-transform',
                    collapsed && '-rotate-90',
                )}
            >
                <path d="M4 6 L8 10 L12 6" />
            </svg>
        </button>
    );
}

/**
 * A framed section: gold-edged panel with an ornamented title and body. When
 * `collapsible`, the header gains a toggle on its right that hides/shows the body
 * (its state is local - the panel simply stops rendering its children).
 */
export function Panel({
    title,
    action,
    children,
    className = '',
    bodyClassName = '',
    collapsible = false,
    defaultCollapsed = false,
}: {
    title: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
}) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    const toggle = collapsible ? (
        <CollapseToggle
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
        />
    ) : null;

    return (
        <section
            className={cn(
                'relative flex flex-col border border-[#2a2833] bg-[#0c0c12]/85',
                className,
            )}
            style={{
                boxShadow:
                    '0 0 30px -20px rgba(201,162,74,0.4), inset 0 1px 0 rgba(201,162,74,0.1)',
            }}
        >
            <PanelTitle
                action={
                    action || toggle ? (
                        <div className="flex items-center gap-2">
                            {action}
                            {toggle}
                        </div>
                    ) : undefined
                }
            >
                {title}
            </PanelTitle>
            {!collapsed && (
                <div
                    className={cn(
                        'flex flex-1 flex-col p-5 sm:p-6',
                        bodyClassName,
                    )}
                >
                    {children}
                </div>
            )}
        </section>
    );
}
