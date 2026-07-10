import { useMemo } from 'react';
import { SpriteIcon } from '@/components/build/tooltip';
import ReferenceTooltip from '@/components/planner/ReferenceTooltip';
import type { PlanReference } from '@/lib/planReferences';
import { moveById } from '@/lib/reorder';
import { notableReference, reconcileNotablePriority } from '@/lib/treeNotables';
import { useDragReorder } from '@/lib/useDragReorder';
import { useNotableReferences } from '@/lib/useNotableReferences';
import { useTreeData } from '@/lib/useTreeData';

/** Notable art is teal, keystone art gold - matching the tree's own landmark tints. */
const NOTABLE_BORDER = '#7fd4c9';
const KEYSTONE_BORDER = '#e7a23a';

/**
 * The passive-tree priority list, built from the tree itself: every notable/keystone the
 * author has allocated, shown as its round GGPK icon in take order. Priority is set by
 * dragging the icons (the author sculpts it by clicking the tree in any phase, windowed or
 * fullscreen, then orders here). Each icon hovers with the same reference tooltip +
 * tree-location mini-map as an inline notable reference.
 */
export default function TreeNotablePriority({
    priority,
    allocated,
    editable,
    onChange,
}: {
    priority: number[];
    allocated: number[];
    editable: boolean;
    /** Persist a reordered priority (editable only). */
    onChange?: (priority: number[]) => void;
}) {
    const { data } = useTreeData();

    // Always display the allocation reconciled against the stored order, so newly
    // allocated notables show at once and de-allocated ones drop - even for a legacy
    // plan whose stored priority is empty.
    const ordered = useMemo(
        () => (data ? reconcileNotablePriority(priority, allocated, data) : []),
        [priority, allocated, data],
    );

    const names = useMemo(
        () =>
            data ? ordered.map((skill) => data.nodes[skill]?.name ?? '') : [],
        [ordered, data],
    );
    const resolved = useNotableReferences(names);

    const drag = useDragReorder((fromKey, toKey) =>
        onChange?.(moveById(ordered, String, fromKey, toKey)),
    );

    if (!data || ordered.length === 0) {
        return (
            <p className="pl-text-sm text-[var(--pl-muted)]">
                {editable
                    ? 'Allocate notables and keystones in the tree above - they build your priority order here.'
                    : 'No notables prioritised.'}
            </p>
        );
    }

    return (
        <ol className="flex flex-wrap gap-2">
            {ordered.map((skill, index) => {
                const node = data.nodes[skill];
                const name = node?.name ?? `Node ${skill}`;
                const isKeystone = node?.isKeystone === true;
                const border = isKeystone ? KEYSTONE_BORDER : NOTABLE_BORDER;
                // Prefer the GGPK-resolved reference (sprite + full tooltip); fall back to
                // the tree-derived stats card while the icon is still loading.
                const reference: PlanReference | undefined =
                    resolved[name] ??
                    notableReference(data, skill) ??
                    undefined;
                const key = String(skill);

                return (
                    <li
                        key={key}
                        {...(editable ? drag.source(key) : {})}
                        {...(editable ? drag.target(key) : {})}
                        className={`relative ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${
                            drag.isDragging(key) ? 'opacity-40' : ''
                        }`}
                    >
                        <ReferenceTooltip
                            reference={reference}
                            disabled={drag.dragKey !== null}
                            className="block"
                        >
                            <span
                                title={name}
                                style={{ borderColor: border }}
                                className={`flex size-12 items-center justify-center overflow-hidden rounded-full border-2 bg-[var(--pl-input-bg)] transition ${
                                    drag.isOver(key)
                                        ? 'ring-2 ring-[var(--pl-accent-lit)]'
                                        : ''
                                }`}
                            >
                                {reference?.sprite ? (
                                    <SpriteIcon
                                        sprite={reference.sprite}
                                        size="2.25rem"
                                        className="shrink-0"
                                    />
                                ) : (
                                    <span
                                        className="pl-text-2xs px-0.5 text-center leading-tight"
                                        style={{ color: border }}
                                    >
                                        {name.slice(0, 3)}
                                    </span>
                                )}
                            </span>
                        </ReferenceTooltip>

                        <span
                            aria-hidden
                            className="pl-text-2xs absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full bg-[var(--pl-accent)] font-semibold text-[#15120b]"
                        >
                            {index + 1}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
