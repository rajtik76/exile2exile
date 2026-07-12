import type { BuildAllocation } from '@poe2-toolkit/tree-core';
import { memo, useMemo } from 'react';
import PassiveTreeView from '@/components/passive-tree/PassiveTreeView';
import { resolveAscendancyName, resolveClassId } from '@/lib/classCatalog';
import { useTreeData } from '@/lib/useTreeData';
import type { PlanBuild } from '@/types/planner';
import type { TreeAllocation } from '@/types/tree';

/**
 * The planner's visual passive tree: a bounded, controlled {@link PassiveTreeView}
 * for the active phase. Class/ascendancy live on the plan build and are picked at the
 * top of the page (see {@link BuildClassGallery}); this only draws the allocation and
 * reports node edits back through {@link onAllocationChange}.
 */
function PlannerTree({
    build,
    allocation,
    editable,
    onAllocationChange,
}: {
    build: PlanBuild;
    allocation: TreeAllocation;
    editable: boolean;
    onAllocationChange?: (allocation: TreeAllocation) => void;
}) {
    const { data } = useTreeData();

    const classId = useMemo(
        () =>
            data && build.className
                ? resolveClassId(data, build.className)
                : null,
        [data, build.className],
    );

    // The renderer keys ascendancy nodes by display name; the build may store the
    // GGG internal id instead (PoB imports), so resolve before handing it over.
    const ascendancy = useMemo(
        () =>
            data
                ? resolveAscendancyName(data, build.className, build.ascendId)
                : null,
        [data, build.className, build.ascendId],
    );

    // Memoised for a stable reference across unrelated edits (typing the title or a
    // notes field re-renders this component). PassiveTreeView rebuilds the whole tree
    // scene whenever this object's identity changes, so a fresh object per render would
    // run buildScene on every keystroke - the source of the typing stutter.
    const buildAllocation = useMemo<BuildAllocation>(
        () => ({
            classId: classId ?? 0,
            ascendId: ascendancy ?? undefined,
            allocated: allocation.allocated,
            attributeChoices: allocation.attributeChoices,
            weaponSets: allocation.weaponSets,
            jewels: allocation.jewels as BuildAllocation['jewels'],
            treeVersion: allocation.treeVersion ?? undefined,
        }),
        [classId, ascendancy, allocation],
    );

    if (!data) {
        return (
            <div className="pl-text-sm flex h-40 items-center justify-center text-[#787d8a]">
                Loading passive tree…
            </div>
        );
    }

    if (classId === null) {
        return (
            <div className="pl-text-sm flex h-40 items-center justify-center rounded-sm border border-[#2a2833] bg-[#08080b]/50 text-[#787d8a]">
                {editable
                    ? 'Pick a class at the top to start the tree.'
                    : 'No tree for this build.'}
            </div>
        );
    }

    function handleAllocationChange(next: BuildAllocation): void {
        onAllocationChange?.({
            allocated: next.allocated,
            attributeChoices: next.attributeChoices ?? {},
            weaponSets: next.weaponSets ?? {},
            jewels: (next.jewels ?? {}) as TreeAllocation['jewels'],
            treeVersion: next.treeVersion ?? null,
        });
    }

    return (
        <div className="planner-tree-frame h-[560px] overflow-hidden rounded-sm border border-[#2a2833]">
            <PassiveTreeView
                editable={editable}
                classId={classId}
                ascendancy={ascendancy}
                allocation={buildAllocation}
                showSearch
                showPointsCounter
                onAllocationChange={handleAllocationChange}
                className="h-full"
            />
        </div>
    );
}

/**
 * Memoised: while the author types a title or notes field the whole page re-renders,
 * but this tree's props (build, allocation, the stable handler) don't change - so it
 * skips rendering entirely and the PIXI canvas stays untouched.
 */
export default memo(PlannerTree);
