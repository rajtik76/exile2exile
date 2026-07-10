import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The one panel used across the build planner - build description, every section,
 * the share bar. All colour, radius, shadow and the optional left accent bar come
 * from --pl-* design tokens, so it re-skins with the active design. A section title
 * renders a themed header bar; `collapsible` adds a chevron toggle.
 */
export function Panel({
    title,
    action,
    children,
    className,
    bodyClassName,
    collapsible = false,
    defaultCollapsed = false,
    overflowVisible = false,
}: {
    title?: React.ReactNode;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    /**
     * Let content spill past the panel edges instead of clipping it. Needed where a
     * child renders a hover tooltip that must stay visible above the panel (the
     * paper-doll, gems, tree); the header's top corners are rounded to match so the
     * unclipped panel keeps its shape.
     */
    overflowVisible?: boolean;
}) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    return (
        <section
            className={cn(
                'relative flex flex-col border border-[var(--pl-panel-border)] bg-[var(--pl-panel)]',
                overflowVisible ? 'overflow-visible' : 'overflow-hidden',
                className,
            )}
            style={{
                borderRadius: 'var(--pl-radius-lg)',
                boxShadow:
                    'inset var(--pl-accent-bar) 0 0 0 var(--pl-accent), var(--pl-shadow)',
            }}
        >
            {title && (
                <div
                    className="flex items-center gap-2.5 border-b px-5 py-3.5 sm:px-6"
                    style={{
                        borderColor: 'var(--pl-header-border)',
                        background: 'var(--pl-header-bg)',
                        // Without the section's overflow clip, round the header's own top
                        // corners so its square background doesn't poke past the rounding.
                        ...(overflowVisible
                            ? {
                                  borderTopLeftRadius: 'var(--pl-radius-lg)',
                                  borderTopRightRadius: 'var(--pl-radius-lg)',
                              }
                            : {}),
                    }}
                >
                    <span
                        aria-hidden
                        className="size-2 shrink-0 rotate-45 rounded-[1px]"
                        style={{ background: 'var(--pl-accent)' }}
                    />
                    <h2
                        className="pl-text-xs uppercase"
                        style={{
                            color: 'var(--pl-accent-lit)',
                            fontFamily: 'var(--pl-font-head)',
                            fontWeight: 'var(--pl-label-weight)',
                            letterSpacing: 'var(--pl-label-tracking)',
                        }}
                    >
                        {title}
                    </h2>
                    {action && <div className="ml-auto">{action}</div>}
                    {collapsible && (
                        <button
                            type="button"
                            onClick={() => setCollapsed((value) => !value)}
                            aria-label={collapsed ? 'Expand' : 'Collapse'}
                            className={cn(
                                'inline-flex size-6 items-center justify-center rounded-[var(--pl-radius)] text-[var(--pl-muted)] transition outline-none hover:text-[var(--pl-accent-lit)] focus-visible:text-[var(--pl-accent-lit)]',
                                action ? 'ml-1.5' : 'ml-auto',
                            )}
                        >
                            <svg
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={cn(
                                    'size-4 transition-transform',
                                    collapsed && '-rotate-90',
                                )}
                            >
                                <path d="M4 6.5 8 10.5 12 6.5" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

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
