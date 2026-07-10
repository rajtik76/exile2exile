import { Head } from '@inertiajs/react';
import { useState } from 'react';
import PassiveTreeView from '@/components/passive-tree/PassiveTreeView';
import { PlannerControls } from '@/components/passive-tree/PlannerControls';
import { usePlannerState } from '@/lib/usePlannerState';
import type { SharedTreeBuild } from '@/lib/usePlannerState';
import { useTreeData } from '@/lib/useTreeData';

/**
 * The passive-tree planner. The page owns the build (class, ascendancy,
 * allocation) via {@link usePlannerState}, driving it with the
 * {@link PlannerControls} bar above the tree; the {@link PassiveTreeView} canvas
 * below is a controlled view that draws it and reports node edits back.
 *
 * The control bar is hidden in fullscreen - the canvas keeps its own zoom,
 * search and point gauge, so the pickers and importer are windowed-only.
 */
export default function Tree({
    initialBuild = null,
}: {
    /** Allocation to seed an editable snapshot from, via /tree?from={slug}. */
    initialBuild?: SharedTreeBuild | null;
}) {
    const { data } = useTreeData();
    const planner = usePlannerState(data, initialBuild);
    const [fullscreen, setFullscreen] = useState(false);

    return (
        <>
            <Head title="Passive tree" />

            <div className="flex h-[calc(100dvh-69px)] w-full flex-col">
                {!fullscreen && data && (
                    <PlannerControls
                        classes={planner.classes}
                        activeClassId={planner.classId}
                        onSelectClass={planner.selectClass}
                        ascendancies={planner.ascendancies}
                        activeAscendancy={planner.ascendancy}
                        onSelectAscendancy={planner.selectAscendancy}
                        locked={planner.imported}
                        code={planner.code}
                        onCode={planner.setCode}
                        onLoad={planner.loadBuild}
                        loading={planner.loading}
                        error={planner.buildError}
                        canShare={planner.canShare}
                        onShare={planner.share}
                        onCloseShare={planner.clearShare}
                        sharing={planner.sharing}
                        shareUrl={planner.shareUrl}
                        shareError={planner.shareError}
                    />
                )}

                <div className="min-h-0 flex-1">
                    <PassiveTreeView
                        editable
                        classId={planner.classId}
                        ascendancy={planner.ascendancy}
                        allocation={planner.allocation}
                        showSearch
                        showPointsCounter
                        onAllocationChange={planner.applyAllocation}
                        onClearBuild={planner.clearBuild}
                        onFullscreenChange={setFullscreen}
                        frameToken={planner.frameToken}
                        className="h-full"
                    />
                </div>
            </div>
        </>
    );
}
