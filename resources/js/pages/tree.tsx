import { Head } from '@inertiajs/react';
import { useState } from 'react';
import PassiveTreeView from '@/components/passive-tree/PassiveTreeView';
import { PlannerControls } from '@/components/passive-tree/PlannerControls';
import { usePlannerState } from '@/lib/usePlannerState';
import { useTreeData } from '@/lib/useTreeData';
import type { TreeSnapshot } from '@/types/tree';

/**
 * The passive-tree planner. The page owns the build (class, ascendancy,
 * allocation) via {@link usePlannerState}, driving it with the
 * {@link PlannerControls} bar above the tree; the {@link PassiveTreeView} canvas
 * below is a controlled view that draws it and reports node edits back.
 *
 * The same component serves two routes: /tree authors a new build (`create`),
 * and /t/{slug}/edit - reached through the unlock gate - edits a saved one
 * (`edit`), with the link panel and delete flow in the bar.
 *
 * The control bar is hidden in fullscreen - the canvas keeps its own zoom,
 * search and point gauge, so the pickers, importer and save are windowed-only.
 */
export default function Tree({
    mode = 'create',
    slug = null,
    editToken = null,
    initialBuild = null,
}: {
    /** `create` for /tree, `edit` for the unlocked /t/{slug}/edit editor. */
    mode?: 'create' | 'edit';
    /** Public slug of the saved build being edited, in `edit` mode. */
    slug?: string | null;
    /** Secret edit token of the saved build, present only in `edit` mode. */
    editToken?: string | null;
    /** Allocation to seed from: /tree?from={slug} or the saved build's own tree. */
    initialBuild?: TreeSnapshot | null;
}) {
    const { data } = useTreeData();
    const planner = usePlannerState(data, initialBuild, { mode, slug });
    const [fullscreen, setFullscreen] = useState(false);

    // The link panel opens by itself when the editor is entered - right after a
    // first save this is what surfaces the fresh public link and edit token.
    // Render-phase adjustment (not an effect): the panel must open exactly once
    // per build, the moment the page flips into edit mode. Leaving the editor
    // (a delete redirects to the blank /tree on this same component) forgets it.
    const [panelOpen, setPanelOpen] = useState(mode === 'edit');
    const [openedFor, setOpenedFor] = useState<string | null>(
        mode === 'edit' ? slug : null,
    );

    if (mode === 'edit' && slug !== null && openedFor !== slug) {
        setOpenedFor(slug);
        setPanelOpen(true);
    }

    if (mode === 'create' && openedFor !== null) {
        setOpenedFor(null);
        setPanelOpen(false);
    }

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
                        mode={mode}
                        code={planner.code}
                        onCode={planner.setCode}
                        onLoad={planner.loadBuild}
                        loading={planner.loading}
                        error={planner.buildError}
                        canSave={planner.canSave}
                        dirty={planner.dirty}
                        onSave={planner.save}
                        saving={planner.saving}
                        saved={planner.saved}
                        saveError={planner.saveError}
                        slug={slug}
                        editToken={editToken}
                        panelOpen={panelOpen}
                        onTogglePanel={() => setPanelOpen((open) => !open)}
                        onClosePanel={() => setPanelOpen(false)}
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
