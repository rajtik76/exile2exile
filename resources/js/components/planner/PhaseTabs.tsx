import { useEffect, useState } from 'react';
import AddButton from '@/components/planner/AddButton';
import { SegmentedControl } from '@/components/planner/Button';
import { nextPhaseTab } from '@/lib/planner';
import type { PlanMode, PlanTab } from '@/types/planner';

/**
 * The site header is sticky at top:0 with a height that changes by breakpoint (the
 * CTA shows only from lg up), so a fixed offset would let the header cover the tab
 * strip. Measure the live header and pin just below it, re-measuring on resize.
 */
function useHeaderHeight(): number {
    const [height, setHeight] = useState(68);

    useEffect(() => {
        const header = document.querySelector('header');

        if (!header) {
            return;
        }

        const measure = () => setHeight(header.getBoundingClientRect().height);

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(header);
        window.addEventListener('resize', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    return height;
}

/**
 * The sticky phase switcher: the mode toggle (phases vs one shared set) and the tab
 * strip. It pins just under the site header so it's always in reach while the author
 * scrolls a long guide.
 *
 * Phases are a fixed sequence (Act I → Early Endgame, then optional custom phases). A
 * new build opens with only "Act I"; "Add phase" reveals the next one and copies the
 * previous phase's plan. Only the last phase can be removed, so the sequence stays a
 * gap-free prefix. Custom phases (beyond the acts) can be renamed inline.
 */
export default function PhaseTabs({
    mode,
    tabs,
    activeTabId,
    editable = false,
    defaultOpen = false,
    onSelectTab,
    onSetMode,
    onAddTab,
    onRenameTab,
    onRemoveLast,
}: {
    mode: PlanMode;
    tabs: PlanTab[];
    activeTabId: string;
    editable?: boolean;
    /** Start with the bar revealed (the public guide) instead of the collapsed pill. */
    defaultOpen?: boolean;
    onSelectTab: (id: string) => void;
    onSetMode?: (mode: PlanMode) => void;
    onAddTab?: () => void;
    onRenameTab?: (id: string, label: string) => void;
    onRemoveLast?: () => void;
}) {
    const headerHeight = useHeaderHeight();
    const activeLabel =
        tabs.find((tab) => tab.id === activeTabId)?.label || 'Untitled';
    const canAdd = nextPhaseTab(tabs) !== null;

    const [hidden, setHidden] = useState(!defaultOpen);

    return (
        <div style={{ top: headerHeight }} className="sticky z-[90] -mt-8 mb-8">
            {/* Full-bleed bar spanning the viewport (like the top nav), broken out of
                the page's max-width; content re-centred inside. */}
            {!hidden && (
                <div
                    style={{
                        background: 'rgba(9,11,16,0.92)',
                        borderColor: 'var(--pl-accent)',
                    }}
                    className="relative left-1/2 w-screen -translate-x-1/2 border-b-2 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.9)] backdrop-blur"
                >
                    <div className="relative mx-auto max-w-5xl px-3 py-2 sm:px-4 sm:py-3">
                        <div className="flex flex-col gap-2 sm:gap-3">
                            {editable && onSetMode && (
                                <div className="flex items-center gap-2">
                                    <SegmentedControl
                                        value={mode}
                                        onChange={onSetMode}
                                        options={[
                                            {
                                                value: 'phases',
                                                label: 'Phases',
                                            },
                                            {
                                                value: 'single',
                                                label: 'No tabs',
                                            },
                                        ]}
                                    />
                                    <span className="pl-text-sm hidden text-[var(--pl-muted)] sm:inline">
                                        {mode === 'phases'
                                            ? 'Each phase holds its own items, gems and tree.'
                                            : 'One shared set of items, gems and tree.'}
                                    </span>
                                </div>
                            )}

                            {mode === 'phases' && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {tabs.map((tab, index) => (
                                        <PhaseChip
                                            key={tab.id}
                                            tab={tab}
                                            active={tab.id === activeTabId}
                                            editable={editable}
                                            removable={
                                                editable &&
                                                tabs.length > 1 &&
                                                index === tabs.length - 1
                                            }
                                            onSelect={() => onSelectTab(tab.id)}
                                            onRename={(label) =>
                                                onRenameTab?.(tab.id, label)
                                            }
                                            onRemove={() => onRemoveLast?.()}
                                        />
                                    ))}

                                    {editable &&
                                        onAddTab &&
                                        (canAdd ? (
                                            <AddButton
                                                leadingPlus
                                                onClick={onAddTab}
                                            >
                                                Add phase
                                            </AddButton>
                                        ) : (
                                            <span className="pl-text-sm px-2 py-1 text-[var(--pl-muted)]">
                                                All phases added
                                            </span>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Collapse handle hanging below the bar's centre, arrow-up. */}
                    <button
                        type="button"
                        onClick={() => setHidden(true)}
                        title="Hide phases"
                        aria-label="Hide phases"
                        style={{
                            background: 'var(--pl-accent)',
                            borderColor: 'var(--pl-accent)',
                        }}
                        className="absolute top-full left-1/2 inline-flex -translate-x-1/2 items-center justify-center rounded-b-[var(--pl-radius)] border border-t-0 border-b-2 px-5 py-1 text-[#15120b] transition outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--pl-ring)]"
                    >
                        <svg
                            viewBox="0 0 16 16"
                            aria-hidden
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-3.5"
                        >
                            <path d="M4 10 L8 6 L12 10" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Reveal handle: a small pill that drops back once the bar is hidden. */}
            {hidden && (
                <div className="flex justify-center pt-3">
                    <button
                        type="button"
                        onClick={() => setHidden(false)}
                        title="Show phases"
                        style={{
                            borderColor: 'var(--pl-accent)',
                            background: 'var(--pl-accent)',
                            borderRadius: 'var(--pl-radius)',
                            boxShadow: '0 8px 20px -8px rgba(0,0,0,0.85)',
                            letterSpacing: 'var(--pl-label-tracking)',
                        }}
                        className="pl-text-xs inline-flex items-center gap-1.5 border px-[0.75em] py-[0.375em] font-semibold text-[#15120b] uppercase transition outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--pl-ring)] sm:px-[1em] sm:py-[0.5em]"
                    >
                        <svg
                            viewBox="0 0 16 16"
                            aria-hidden
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-[1.15em]"
                        >
                            <path d="M4 6 L8 10 L12 6" />
                        </svg>
                        {/* Full label on desktop; a compact "Phases · Act I" chip on phones. */}
                        <span className="hidden sm:inline">
                            Show phases
                            {mode === 'phases' ? ` · ${activeLabel}` : ''}
                        </span>
                        <span className="sm:hidden">
                            {mode === 'phases' ? activeLabel : 'Phases'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * One phase pill - a 2px-bordered, text-sm tab matching the segmented controls. Base
 * phases show a static label; custom phases (editable) take an inline name input. The
 * last phase carries a small ✕ to remove it (the only phase that can go).
 */
function PhaseChip({
    tab,
    active,
    editable,
    removable,
    onSelect,
    onRename,
    onRemove,
}: {
    tab: PlanTab;
    active: boolean;
    editable: boolean;
    removable: boolean;
    onSelect: () => void;
    onRename: (label: string) => void;
    onRemove: () => void;
}) {
    const isCustom = tab.kind === 'custom';
    const frame = active
        ? 'border-[var(--pl-accent)] bg-[var(--pl-accent-soft)]'
        : 'border-[var(--pl-panel-border)] hover:border-[var(--pl-accent)]';
    const text = active
        ? 'text-[var(--pl-accent-lit)]'
        : 'text-[var(--pl-text)]';

    return (
        <div
            className={`relative inline-flex items-center rounded-[var(--pl-radius)] border-2 transition ${frame} ${removable ? 'pr-6' : ''}`}
        >
            {editable && isCustom ? (
                <input
                    value={tab.label}
                    onChange={(event) => onRename(event.target.value)}
                    onFocus={onSelect}
                    placeholder="Phase name"
                    maxLength={60}
                    style={{ width: `${Math.max(tab.label.length, 4)}ch` }}
                    className={`pl-text-sm bg-transparent px-[0.75em] py-[0.25em] font-medium outline-none ${text}`}
                />
            ) : (
                <button
                    type="button"
                    onClick={onSelect}
                    className={`pl-text-sm px-[0.75em] py-[0.25em] font-medium transition ${text}`}
                >
                    {tab.label || 'Untitled'}
                </button>
            )}

            {removable && (
                <button
                    type="button"
                    title="Remove phase"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemove();
                    }}
                    className="pl-text-2xs absolute top-1/2 right-1 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-full leading-none text-[var(--pl-danger)] transition hover:bg-[var(--pl-danger)] hover:text-white"
                >
                    ✕
                </button>
            )}
        </div>
    );
}
