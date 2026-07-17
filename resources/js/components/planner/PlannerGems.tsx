import { useEffect, useRef, useState } from 'react';
import AddButton from '@/components/planner/AddButton';
import Button, { SegmentedControl } from '@/components/planner/Button';
import ReferencePicker from '@/components/planner/ReferencePicker';
import { useReferences } from '@/components/planner/ReferencesContext';
import ReferenceTooltip, {
    accentColor,
} from '@/components/planner/ReferenceTooltip';
import {
    excludedGemIds,
    gemsByPriority as flattenGemsByPriority,
    withGemRemoved,
    withGemSet,
    withSupportMoved,
} from '@/lib/gemGroups';
import type { GemsView } from '@/lib/gemsView';
import { refKey } from '@/lib/planReferences';
import type { PlanReference } from '@/lib/planReferences';
import { moveById } from '@/lib/reorder';
import { useDragReorder } from '@/lib/useDragReorder';
import { MAX_GEM_GROUPS, MAX_GEMS_PER_GROUP } from '@/types/planner';
import type { GemGroup, ItemSlot } from '@/types/planner';

/** A short client-only id for a new gem group. */
function uid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `gg-${crypto.randomUUID().slice(0, 8)}`
        : `gg-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The visual gems panel: each group is one active
 * skill gem and its support gems, picked from the GGPK catalogue. Only the {type, id}
 * references are stored; icons/tooltips resolve live. The first gem in a group is the
 * active skill (shown larger), the rest are its supports.
 */
export default function PlannerGems({
    groups,
    editable,
    view = 'grid',
    onChange,
}: {
    groups: GemGroup[];
    editable: boolean;
    /** Layout: the compact icon grid, or a roomier list with visible gem names. */
    view?: GemsView;
    onChange?: (groups: GemGroup[]) => void;
}) {
    const { addReference, map } = useReferences();
    const [picker, setPicker] = useState<{ group: number; gem: number } | null>(
        null,
    );
    // The trigger the open picker anchors under, so the dropdown appears by the exact
    // button/thumb clicked rather than at the group card's corner.
    const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);

    // A freshly-added group whose empty skill frame the picker should open over. The
    // frame doesn't exist yet when "+ Gem group" is clicked, so we remember the new
    // index and anchor the picker to its skill thumb once it has mounted (below).
    const [pendingGroup, setPendingGroup] = useState<number | null>(null);
    const skillRefs = useRef(new Map<number, HTMLElement>());
    const setSkillRef =
        (groupIndex: number) =>
        (element: HTMLElement | null): void => {
            if (element) {
                skillRefs.current.set(groupIndex, element);
            } else {
                skillRefs.current.delete(groupIndex);
            }
        };

    useEffect(() => {
        if (pendingGroup === null) {
            return;
        }

        const anchor = skillRefs.current.get(pendingGroup);

        if (anchor) {
            setPickerAnchor(anchor);
            setPicker({ group: pendingGroup, gem: 0 });
        }

        setPendingGroup(null);
    }, [pendingGroup]);

    function openPicker(
        event: React.MouseEvent,
        group: number,
        gem: number,
    ): void {
        setPickerAnchor(event.currentTarget as HTMLElement);
        setPicker({ group, gem });
    }

    function setGem(
        groupIndex: number,
        gemIndex: number,
        reference: PlanReference,
    ): void {
        addReference(reference);
        const slot: ItemSlot = { type: 'gem', id: reference.id };

        onChange?.(withGemSet(groups, groupIndex, gemIndex, slot));
        setPicker(null);
    }

    function removeGem(groupIndex: number, gemIndex: number): void {
        onChange?.(withGemRemoved(groups, groupIndex, gemIndex));
    }

    function removeGroup(groupIndex: number): void {
        onChange?.(groups.filter((_, index) => index !== groupIndex));
    }

    function addGroup(): void {
        onChange?.([...groups, { id: uid(), gems: [] }]);
        // Defer opening the picker until the new group's empty skill frame mounts, so it
        // anchors over that frame rather than the "+ Gem group" button (which would cover
        // the frame). See the effect above.
        setPendingGroup(groups.length);
    }

    // Reorder whole groups by their stable id.
    const groupDnd = useDragReorder((fromId, toId) =>
        onChange?.(moveById(groups, (group) => group.id, fromId, toId)),
    );

    // Reorder support gems within a group. Keys are "<groupIndex>:<gemIndex>"; a drag is
    // confined to one group, and the active skill (index 0) never moves.
    const supportDnd = useDragReorder((fromKey, toKey) =>
        onChange?.(withSupportMoved(groups, fromKey, toKey)),
    );

    // A tooltip left open during a drag sits over the drop target and blocks it, so
    // hide every gem tooltip while any drag is in progress.
    const dragActive = groupDnd.dragKey !== null || supportDnd.dragKey !== null;

    /** Reference ids to hide from a slot's picker so a gem is never slotted twice. */
    function excludedIds(target: { group: number; gem: number }): string[] {
        return excludedGemIds(groups, target);
    }

    // One skill + its supports laid out on a fixed column grid so the row-number
    // (skill priority) and column-number (support priority) headers line up across
    // every group. Columns: [drag][#][skill][support ×5][actions] when editable.
    const supportColumns = MAX_GEMS_PER_GROUP - 1;
    const gridColumns = editable
        ? `1.25rem 1.5rem 3.5rem repeat(${supportColumns}, 2.5rem) minmax(1.75rem, 1fr)`
        : `1.5rem 3.5rem repeat(${supportColumns}, 2.5rem)`;

    // Every gem flattened in priority order (each group top-to-bottom, skill then its
    // supports left-to-right) for the read-only summary row under the editor.
    const gemsByPriority = flattenGemsByPriority(groups);

    /** Display name + accent colour for a gem slot, resolved from the live reference. */
    function gemInfo(slot?: ItemSlot): { name: string; color: string } {
        const reference = slot ? map[refKey('gem', slot.id)] : undefined;

        return {
            name: reference?.name ?? slot?.id ?? '',
            color: accentColor('gem', reference?.color),
        };
    }

    return (
        <div className="flex flex-col gap-2">
            {/* The gem rows are a fixed-column grid (skill + five support columns) at
                sm and up, wider than a phone - scroll it horizontally there rather than
                letting the row spill out of the panel. Below sm there's no room for
                columns at all, so each row switches to a plain stack instead: the
                header/skill line, then supports wrapping onto as many lines as they
                need. Each grouping `<div>` uses `sm:contents` to unbox itself at the
                grid breakpoint - its children rejoin the row as direct grid items,
                landing in the exact same columns as before, so the sm+ layout is
                byte-for-byte what it always was. */}
            {view === 'grid' && (
                <div className="sm:overflow-x-auto">
                    <div className="flex flex-col gap-2 sm:min-w-max">
                        {groups.length > 0 && (
                            <div
                                className="hidden items-center justify-items-center gap-3 px-2 sm:grid"
                                style={{ gridTemplateColumns: gridColumns }}
                            >
                                {editable && <span />}
                                <span className="pl-text-2xs text-[var(--pl-faint)]">
                                    #
                                </span>
                                <span className="pl-text-2xs font-semibold tracking-wide text-[var(--pl-faint)] uppercase">
                                    Skill
                                </span>
                                {Array.from(
                                    { length: supportColumns },
                                    (_, col) => (
                                        <span
                                            key={col}
                                            className="pl-text-2xs text-[var(--pl-faint)]"
                                        >
                                            {col + 1}
                                        </span>
                                    ),
                                )}
                                {editable && <span />}
                            </div>
                        )}

                        {groups.map((group, groupIndex) => (
                            <div
                                key={group.id}
                                data-gem-group
                                {...(editable ? groupDnd.target(group.id) : {})}
                                className={`group/row relative flex flex-col gap-2 rounded-[var(--pl-radius)] border bg-[var(--pl-panel-2)] p-2 transition sm:grid sm:items-center sm:justify-items-center sm:gap-3 ${
                                    editable && groupDnd.isOver(group.id)
                                        ? 'border-[var(--pl-accent-lit)] ring-2 ring-[var(--pl-accent-lit)]'
                                        : 'border-[var(--pl-panel-border)]'
                                } ${
                                    editable && groupDnd.isDragging(group.id)
                                        ? 'opacity-40'
                                        : ''
                                }`}
                                style={{ gridTemplateColumns: gridColumns }}
                            >
                                <div className="flex items-center gap-2 sm:contents">
                                    {editable && (
                                        <span
                                            {...groupDnd.source(group.id, {
                                                dragImageSelector:
                                                    '[data-gem-group]',
                                            })}
                                            title="Drag to reorder group"
                                            className="cursor-grab text-sm leading-none text-[var(--pl-faint)] transition select-none hover:text-[var(--pl-accent-lit)] active:cursor-grabbing"
                                        >
                                            ⠿
                                        </span>
                                    )}

                                    <span
                                        className="pl-text-xs flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--pl-accent-soft)] font-semibold text-[var(--pl-accent-lit)]"
                                        title={`Skill priority ${groupIndex + 1}`}
                                    >
                                        {groupIndex + 1}
                                    </span>

                                    <span
                                        ref={setSkillRef(groupIndex)}
                                        className="inline-flex"
                                    >
                                        <GemThumb
                                            slot={group.gems[0]}
                                            big
                                            editable={editable}
                                            placeholder="Skill"
                                            tooltipDisabled={dragActive}
                                            onClick={(event) =>
                                                editable &&
                                                openPicker(event, groupIndex, 0)
                                            }
                                            onRemove={
                                                editable && group.gems[0]
                                                    ? () =>
                                                          removeGem(
                                                              groupIndex,
                                                              0,
                                                          )
                                                    : undefined
                                            }
                                        />
                                    </span>

                                    {/* Mobile-only remove button, inline with the skill row -
                                        the sm+ one below sits in the grid's own last column. */}
                                    {editable && (
                                        <Button
                                            icon
                                            variant="danger"
                                            title="Remove group"
                                            className="ml-auto border-2 sm:hidden"
                                            onClick={() =>
                                                removeGroup(groupIndex)
                                            }
                                        >
                                            ✕
                                        </Button>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 sm:contents">
                                    {Array.from(
                                        { length: supportColumns },
                                        (_, col) => {
                                            const gemIndex = col + 1;
                                            const gem = group.gems[gemIndex];
                                            const key = `${groupIndex}:${gemIndex}`;

                                            if (gem) {
                                                return (
                                                    <span
                                                        key={key}
                                                        {...(editable
                                                            ? supportDnd.source(
                                                                  key,
                                                              )
                                                            : {})}
                                                        {...(editable
                                                            ? supportDnd.target(
                                                                  key,
                                                              )
                                                            : {})}
                                                        className={`inline-flex rounded-full transition ${
                                                            editable
                                                                ? 'cursor-grab active:cursor-grabbing'
                                                                : ''
                                                        } ${supportDnd.isDragging(key) ? 'opacity-40' : ''} ${
                                                            supportDnd.isOver(
                                                                key,
                                                            )
                                                                ? 'ring-2 ring-[var(--pl-accent-lit)]'
                                                                : ''
                                                        }`}
                                                    >
                                                        <GemThumb
                                                            slot={gem}
                                                            editable={editable}
                                                            round
                                                            tooltipDisabled={
                                                                dragActive
                                                            }
                                                            onClick={(event) =>
                                                                editable &&
                                                                openPicker(
                                                                    event,
                                                                    groupIndex,
                                                                    gemIndex,
                                                                )
                                                            }
                                                            onRemove={
                                                                editable
                                                                    ? () =>
                                                                          removeGem(
                                                                              groupIndex,
                                                                              gemIndex,
                                                                          )
                                                                    : undefined
                                                            }
                                                        />
                                                    </span>
                                                );
                                            }

                                            // The first empty support column carries the "add support"
                                            // button (only once a skill leads the group).
                                            if (
                                                editable &&
                                                col === group.gems.length - 1 &&
                                                group.gems.length >= 1
                                            ) {
                                                return (
                                                    <AddButton
                                                        key={key}
                                                        shape="circle"
                                                        icon
                                                        title="Add support gem"
                                                        className="size-9 sm:size-10"
                                                        onClick={(event) =>
                                                            openPicker(
                                                                event,
                                                                groupIndex,
                                                                group.gems
                                                                    .length,
                                                            )
                                                        }
                                                    />
                                                );
                                            }

                                            return (
                                                <span
                                                    key={key}
                                                    className="hidden sm:inline"
                                                />
                                            );
                                        },
                                    )}
                                </div>

                                {editable && (
                                    <span className="hidden w-full items-center justify-end sm:flex">
                                        <Button
                                            icon
                                            variant="danger"
                                            title="Remove group"
                                            className="border-2"
                                            onClick={() =>
                                                removeGroup(groupIndex)
                                            }
                                        >
                                            ✕
                                        </Button>
                                    </span>
                                )}

                                {editable && picker?.group === groupIndex && (
                                    <ReferencePicker
                                        lockType="gem"
                                        gemKind={
                                            picker.gem === 0
                                                ? 'skill'
                                                : 'support'
                                        }
                                        excludeIds={excludedIds(picker)}
                                        anchorEl={pickerAnchor}
                                        placeholder="Find a gem…"
                                        onPick={(reference) =>
                                            setGem(
                                                groupIndex,
                                                picker.gem,
                                                reference,
                                            )
                                        }
                                        onClose={() => setPicker(null)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* List view: one card per group, the group's gems stacked as a vertical
                list (active skill on top, its supports beneath). Whole cards reorder by
                dragging the handle; supports reorder within their group. */}
            {view === 'list' && (
                <div className="flex flex-col gap-3">
                    {groups.map((group, groupIndex) => {
                        const canAddSupport =
                            editable &&
                            group.gems.length >= 1 &&
                            group.gems.length < MAX_GEMS_PER_GROUP;

                        return (
                            <div
                                key={group.id}
                                data-gem-group
                                {...(editable ? groupDnd.target(group.id) : {})}
                                className={`relative rounded-[var(--pl-radius-lg)] border bg-[var(--pl-panel-2)] p-3 transition ${
                                    editable && groupDnd.isOver(group.id)
                                        ? 'border-[var(--pl-accent-lit)] ring-2 ring-[var(--pl-accent-lit)]'
                                        : 'border-[var(--pl-panel-border)]'
                                } ${
                                    editable && groupDnd.isDragging(group.id)
                                        ? 'opacity-40'
                                        : ''
                                }`}
                            >
                                {/* Card header: drag handle · priority · remove. */}
                                <div className="mb-2 flex items-center gap-2.5">
                                    {editable && (
                                        <span
                                            {...groupDnd.source(group.id, {
                                                dragImageSelector:
                                                    '[data-gem-group]',
                                            })}
                                            title="Drag to reorder group"
                                            className="cursor-grab text-sm leading-none text-[var(--pl-faint)] transition select-none hover:text-[var(--pl-accent-lit)] active:cursor-grabbing"
                                        >
                                            ⠿
                                        </span>
                                    )}

                                    <span
                                        className="pl-text-xs flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--pl-accent-soft)] font-semibold text-[var(--pl-accent-lit)]"
                                        title={`Skill priority ${groupIndex + 1}`}
                                    >
                                        {groupIndex + 1}
                                    </span>

                                    <span className="pl-text-2xs tracking-wide text-[var(--pl-faint)] uppercase">
                                        Skill group
                                    </span>

                                    {editable && (
                                        <Button
                                            icon
                                            variant="danger"
                                            title="Remove group"
                                            className="ml-auto border-2"
                                            onClick={() =>
                                                removeGroup(groupIndex)
                                            }
                                        >
                                            ✕
                                        </Button>
                                    )}
                                </div>

                                {/* The gems, one per row, top-to-bottom. */}
                                <div className="flex flex-col gap-1.5">
                                    {/* Active skill. */}
                                    {(() => {
                                        const skill = gemInfo(group.gems[0]);

                                        return (
                                            <div
                                                className="flex items-center gap-3 rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-input-bg)] p-1.5"
                                                style={{
                                                    borderLeftWidth: '3px',
                                                    borderLeftColor: group
                                                        .gems[0]
                                                        ? skill.color
                                                        : 'var(--pl-panel-border)',
                                                }}
                                            >
                                                <span
                                                    ref={setSkillRef(
                                                        groupIndex,
                                                    )}
                                                    className="inline-flex"
                                                >
                                                    <GemThumb
                                                        slot={group.gems[0]}
                                                        editable={editable}
                                                        placeholder="Skill"
                                                        tooltipDisabled={
                                                            dragActive
                                                        }
                                                        onClick={(event) =>
                                                            editable &&
                                                            openPicker(
                                                                event,
                                                                groupIndex,
                                                                0,
                                                            )
                                                        }
                                                        onRemove={
                                                            editable &&
                                                            group.gems[0]
                                                                ? () =>
                                                                      removeGem(
                                                                          groupIndex,
                                                                          0,
                                                                      )
                                                                : undefined
                                                        }
                                                    />
                                                </span>
                                                <p className="pl-text-sm min-w-0 flex-1 truncate font-semibold text-[var(--pl-text-strong)]">
                                                    {group.gems[0]
                                                        ? skill.name
                                                        : 'Choose a skill'}
                                                </p>
                                                <span className="pl-text-2xs shrink-0 tracking-wide text-[var(--pl-faint)] uppercase">
                                                    Skill
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    {/* Supports, indented under the skill, drag-reordered. */}
                                    {group.gems
                                        .slice(1)
                                        .map((gem, position) => {
                                            const gemIndex = position + 1;
                                            const key = `${groupIndex}:${gemIndex}`;
                                            const support = gemInfo(gem);

                                            return (
                                                <div
                                                    key={key}
                                                    {...(editable
                                                        ? supportDnd.source(key)
                                                        : {})}
                                                    {...(editable
                                                        ? supportDnd.target(key)
                                                        : {})}
                                                    className={`flex items-center gap-3 rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-input-bg)] p-1.5 transition sm:ml-6 ${
                                                        editable
                                                            ? 'cursor-grab active:cursor-grabbing'
                                                            : ''
                                                    } ${supportDnd.isDragging(key) ? 'opacity-40' : ''} ${
                                                        supportDnd.isOver(key)
                                                            ? 'ring-2 ring-[var(--pl-accent-lit)]'
                                                            : ''
                                                    }`}
                                                    style={{
                                                        borderLeftWidth: '3px',
                                                        borderLeftColor:
                                                            support.color,
                                                    }}
                                                >
                                                    {editable && (
                                                        <span className="text-sm leading-none text-[var(--pl-faint)] select-none">
                                                            ⠿
                                                        </span>
                                                    )}
                                                    <GemThumb
                                                        slot={gem}
                                                        editable={editable}
                                                        round
                                                        small
                                                        tooltipDisabled={
                                                            dragActive
                                                        }
                                                        onClick={(event) =>
                                                            editable &&
                                                            openPicker(
                                                                event,
                                                                groupIndex,
                                                                gemIndex,
                                                            )
                                                        }
                                                        onRemove={
                                                            editable
                                                                ? () =>
                                                                      removeGem(
                                                                          groupIndex,
                                                                          gemIndex,
                                                                      )
                                                                : undefined
                                                        }
                                                    />
                                                    <p className="pl-text-sm min-w-0 flex-1 truncate font-medium text-[var(--pl-text)]">
                                                        {support.name}
                                                    </p>
                                                    <span className="pl-text-2xs shrink-0 tracking-wide text-[var(--pl-faint)] uppercase">
                                                        Support
                                                    </span>
                                                </div>
                                            );
                                        })}

                                    {canAddSupport && (
                                        <div className="sm:ml-6">
                                            <AddButton
                                                leadingPlus
                                                title="Add support gem"
                                                onClick={(event) =>
                                                    openPicker(
                                                        event,
                                                        groupIndex,
                                                        group.gems.length,
                                                    )
                                                }
                                            >
                                                Support
                                            </AddButton>
                                        </div>
                                    )}

                                    {group.gems.length <= 1 &&
                                        !canAddSupport && (
                                            <p className="pl-text-xs text-[var(--pl-faint)] sm:ml-6">
                                                No support gems
                                            </p>
                                        )}
                                </div>

                                {editable && picker?.group === groupIndex && (
                                    <ReferencePicker
                                        lockType="gem"
                                        gemKind={
                                            picker.gem === 0
                                                ? 'skill'
                                                : 'support'
                                        }
                                        excludeIds={excludedIds(picker)}
                                        anchorEl={pickerAnchor}
                                        placeholder="Find a gem…"
                                        onPick={(reference) =>
                                            setGem(
                                                groupIndex,
                                                picker.gem,
                                                reference,
                                            )
                                        }
                                        onClose={() => setPicker(null)}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {editable && groups.length < MAX_GEM_GROUPS && (
                <div>
                    <AddButton leadingPlus onClick={addGroup}>
                        Gem group
                    </AddButton>
                </div>
            )}

            {gemsByPriority.length > 0 && (
                <div className="mt-2 border-t border-[var(--pl-divider)] pt-3">
                    <p className="pl-text-2xs mb-2 font-semibold tracking-wide text-[var(--pl-faint)] uppercase">
                        All gems by priority
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {gemsByPriority.map(({ gem, support, key }) => (
                            <GemThumb
                                key={key}
                                slot={gem}
                                editable={false}
                                round={support}
                                small
                                onClick={() => {}}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * The layout switch for the gems panel header: the compact icon grid, or the list with
 * visible gem names. A display preference only - it changes nothing in the plan.
 */
export function GemsViewToggle({
    value,
    onChange,
}: {
    value: GemsView;
    onChange: (view: GemsView) => void;
}) {
    return (
        <SegmentedControl<GemsView>
            value={value}
            onChange={onChange}
            options={[
                { value: 'grid', label: <GridGlyph />, title: 'Icon grid' },
                {
                    value: 'list',
                    label: <ListGlyph />,
                    title: 'List with names',
                },
            ]}
        />
    );
}

function GridGlyph() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
        >
            <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
            <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
            <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
            <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
        </svg>
    );
}

function ListGlyph() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
        >
            <circle cx="3" cy="4" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="3" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <path d="M7 4h7M7 12h7" />
        </svg>
    );
}

function GemThumb({
    slot,
    big = false,
    small = false,
    editable,
    placeholder,
    round = false,
    tooltipDisabled = false,
    onClick,
    onRemove,
}: {
    slot?: ItemSlot;
    big?: boolean;
    /** A 25%-smaller thumb for the compact priority summary row. */
    small?: boolean;
    editable: boolean;
    placeholder?: string;
    /** Render a circular frame - support gems, matching their in-game round socket. */
    round?: boolean;
    tooltipDisabled?: boolean;
    onClick: (event: React.MouseEvent) => void;
    onRemove?: () => void;
}) {
    const { map } = useReferences();
    const reference = slot ? map[refKey('gem', slot.id)] : undefined;
    const size = big
        ? 'size-11 sm:size-14'
        : small
          ? 'size-[1.875rem]'
          : 'size-9 sm:size-10';

    if (!slot) {
        return (
            <AddButton
                shape={round ? 'circle' : 'block'}
                icon={placeholder === undefined}
                onClick={onClick}
                className={`${size} shrink-0`}
            >
                {placeholder}
            </AddButton>
        );
    }

    const color = accentColor('gem', reference?.color);

    return (
        <ReferenceTooltip
            reference={reference}
            disabled={tooltipDisabled}
            className="group/gem relative inline-flex"
        >
            <AddButton
                solid
                shape={round ? 'circle' : 'block'}
                onClick={editable ? onClick : undefined}
                style={{ borderColor: `${color}99` }}
                className={`${size} shrink-0 overflow-hidden bg-[var(--pl-input-bg)] ${
                    editable ? 'cursor-pointer' : 'cursor-default'
                }`}
            >
                {reference?.icon ? (
                    <img
                        src={reference.icon}
                        alt={reference.name}
                        loading="lazy"
                        draggable={false}
                        className="max-h-[86%] max-w-[86%] object-contain"
                    />
                ) : (
                    <span
                        className="pl-text-2xs px-0.5 text-center leading-tight"
                        style={{ color }}
                    >
                        {reference?.name ?? slot.id}
                    </span>
                )}
            </AddButton>

            {onRemove && (
                <button
                    type="button"
                    title="Remove gem"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemove();
                    }}
                    className="pl-text-2xs absolute -top-1 -right-1 hidden size-4 items-center justify-center rounded-full bg-[var(--pl-danger)] text-white group-hover/gem:flex"
                >
                    ✕
                </button>
            )}
        </ReferenceTooltip>
    );
}
