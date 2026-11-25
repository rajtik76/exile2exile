import { useState } from 'react';
import AddButton from '@/components/planner/AddButton';
import { SegmentedControl } from '@/components/planner/Button';
import { nextPhaseTab } from '@/lib/planner';
import type { PlanMode, PlanTab } from '@/types/planner';

/**
 * The sticky phase switcher: the mode toggle (phases vs one shared set) and the tab
 * strip. The site header scrolls away with the page, so this pins to the very top
 * of the viewport, always in reach while the author scrolls a long guide.
 *
 * Phases are optional, freely orderable and renameable: the six base phases (Act I →
 * Early Endgame) are just prefilled defaults, not a requirement - the author picks
 * which ones to use, arranges tabs however they like, and can rename any of them.
 * "Add phase" prefills a new tab from the fixed act order (skipping whichever base
 * phases are already present) and copies the previous phase's plan; any phase can be
 * renamed, reordered or removed, as long as at least one remains.
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
    onMoveTab,
    onRemoveTab,
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
    onMoveTab?: (id: string, direction: 'left' | 'right') => void;
    onRemoveTab?: (id: string) => void;
}) {
    const activeLabel =
        tabs.find((tab) => tab.id === activeTabId)?.label || 'Untitled';
    const canAdd = nextPhaseTab(tabs) !== null;

    const [hidden, setHidden] = useState(!defaultOpen);

    return (
        <div className="sticky top-0 z-[90] -mt-8 mb-8">
            {/* Full-bleed bar spanning the viewport (like the top nav), broken out of
                the page's max-width; content re-centred inside. */}
            {!hidden && (
                <div className="relative left-1/2 w-screen -translate-x-1/2 bg-ink/95 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.9)] backdrop-blur">
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
                                                editable && tabs.length > 1
                                            }
                                            canMoveLeft={editable && index > 0}
                                            canMoveRight={
                                                editable &&
                                                index < tabs.length - 1
                                            }
                                            onSelect={() => onSelectTab(tab.id)}
                                            onRename={(label) =>
                                                onRenameTab?.(tab.id, label)
                                            }
                                            onMove={(direction) =>
                                                onMoveTab?.(tab.id, direction)
                                            }
                                            onRemove={() =>
                                                onRemoveTab?.(tab.id)
                                            }
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

                    {/* The same pewter rule that closes the masthead. */}
                    <div
                        aria-hidden
                        className="absolute inset-x-[1.5%] bottom-0 h-0.5 rule-pewter"
                    />

                    {/* Collapse handle hanging below the bar's centre, arrow-up. */}
                    <button
                        type="button"
                        onClick={() => setHidden(true)}
                        title="Hide phases"
                        aria-label="Hide phases"
                        className="absolute top-full left-1/2 inline-flex -translate-x-1/2 items-center justify-center rounded-b-[2px] border border-t-0 border-pewter-700 bg-stone-800 px-5 py-1 text-slate transition-colors duration-[120ms] outline-none hover:border-ember-400 hover:text-ember-300 focus-visible:ring-2 focus-visible:ring-[var(--pl-ring)]"
                    >
                        <svg
                            viewBox="0 0 16 16"
                            aria-hidden
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
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
                        className="inline-flex h-[30px] items-center gap-2 rounded-[2px] border border-pewter-700 bg-stone-800 px-3.5 font-label text-[15px] tracking-[0.06em] text-paper shadow-[0_8px_20px_-8px_rgba(0,0,0,0.85)] transition-colors duration-[120ms] outline-none hover:border-ember-400 focus-visible:ring-2 focus-visible:ring-[var(--pl-ring)]"
                    >
                        <svg
                            viewBox="0 0 16 16"
                            aria-hidden
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-4 text-ember-400"
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
 * One phase tab - a bordered box whose active state matches the segmented controls
 * (lifted stone, ember underline). While
 * editing, any phase (base or custom) takes an inline name input, so "Act I" etc. are
 * just prefilled defaults the author can rename. Small ‹/› arrows reorder the phase
 * and a ✕ removes it (as long as at least one phase remains).
 */
function PhaseChip({
    tab,
    active,
    editable,
    removable,
    canMoveLeft,
    canMoveRight,
    onSelect,
    onRename,
    onMove,
    onRemove,
}: {
    tab: PlanTab;
    active: boolean;
    editable: boolean;
    removable: boolean;
    canMoveLeft: boolean;
    canMoveRight: boolean;
    onSelect: () => void;
    onRename: (label: string) => void;
    onMove: (direction: 'left' | 'right') => void;
    onRemove: () => void;
}) {
    const frame = active
        ? 'border-line-strong bg-stone-700 shadow-[inset_0_-2px_0_var(--color-ember-500)]'
        : 'border-line hover:border-line-strong';
    const text = active ? 'text-paper' : 'text-slate hover:text-paper';

    return (
        <div
            className={`relative inline-flex items-center rounded-[2px] border transition-colors duration-[120ms] ${frame} ${removable ? 'pr-6' : ''}`}
        >
            {editable && (canMoveLeft || canMoveRight) && (
                <span className="flex items-center pl-1">
                    <button
                        type="button"
                        title="Move phase left"
                        aria-label="Move phase left"
                        disabled={!canMoveLeft}
                        onClick={(event) => {
                            event.stopPropagation();
                            onMove('left');
                        }}
                        className="pl-text-2xs inline-flex size-4 items-center justify-center leading-none text-mist transition-colors hover:text-paper disabled:opacity-20"
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        title="Move phase right"
                        aria-label="Move phase right"
                        disabled={!canMoveRight}
                        onClick={(event) => {
                            event.stopPropagation();
                            onMove('right');
                        }}
                        className="pl-text-2xs inline-flex size-4 items-center justify-center leading-none text-mist transition-colors hover:text-paper disabled:opacity-20"
                    >
                        ›
                    </button>
                </span>
            )}

            {editable ? (
                <input
                    value={tab.label}
                    onChange={(event) => onRename(event.target.value)}
                    onFocus={onSelect}
                    placeholder="Phase name"
                    maxLength={60}
                    style={{ width: `${Math.max(tab.label.length, 4)}ch` }}
                    className={`pl-text-sm box-content bg-transparent px-[0.75em] py-[0.25em] font-medium outline-none ${text}`}
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
                    className="pl-text-2xs absolute top-1/2 right-1 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-[2px] leading-none text-mist transition-colors hover:bg-[var(--pl-danger-soft)] hover:text-blood-lit"
                >
                    ✕
                </button>
            )}
        </div>
    );
}
