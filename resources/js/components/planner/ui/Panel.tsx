import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The one panel used across the build planner - build description, every section,
 * the loot filter. It is the working-tier `.panel`: flat stone, a line border and
 * the pewter rule on top. A section title renders the `.panel-head` bar (pewter
 * diamond, small-caps label); `collapsible` adds a chevron toggle.
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
     * paper-doll, gems, tree).
     */
    overflowVisible?: boolean;
}) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    return (
        <section className={cn('panel flex flex-col', className)}>
            {title && (
                <div
                    className={cn(
                        'panel-head sm:px-5',
                        collapsed && 'border-b-0',
                    )}
                >
                    <h2 className="min-w-0">{title}</h2>
                    {action && <div className="ml-auto">{action}</div>}
                    {collapsible && (
                        <button
                            type="button"
                            onClick={() => setCollapsed((value) => !value)}
                            aria-label={collapsed ? 'Expand' : 'Collapse'}
                            aria-expanded={!collapsed}
                            className={cn(
                                'inline-flex size-6 items-center justify-center rounded-[2px] text-mist transition-colors duration-[120ms] hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-400',
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
                        'flex flex-1 flex-col p-4 sm:p-5',
                        !overflowVisible && 'overflow-hidden',
                        bodyClassName,
                    )}
                >
                    {children}
                </div>
            )}
        </section>
    );
}
