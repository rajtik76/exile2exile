import { Head } from '@inertiajs/react';
import type { TreeData } from '@poe2-toolkit/tree-core';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import LazyMount from '@/components/LazyMount';
import PassiveTreeView from '@/components/passive-tree/PassiveTreeView';
import { PlannerControls } from '@/components/passive-tree/PlannerControls';
import { TreeConversionReport } from '@/components/passive-tree/TreeConversionReport';
import type { ConversionSource } from '@/components/passive-tree/TreeConversionReport';
import { loadTreeData, patchTree } from '@/lib/tree-scene';
import { migrateTree } from '@/lib/treeMigration';
import type { TreeMigration } from '@/lib/treeMigration';
import type { TreeSnapshotRef } from '@/lib/treeSource';
import { usePlannerState } from '@/lib/usePlannerState';
import { useTreeData } from '@/lib/useTreeData';
import type { TreeSnapshot } from '@/types/tree';

export interface TreeConversion extends ConversionSource, TreeSnapshotRef {
    slug: string;
}

interface TreeProps {
    /** `create` for /tree, `edit` for the unlocked /t/{slug}/edit editor. */
    mode?: 'create' | 'edit';
    /** Public slug of the saved build being edited, in `edit` mode. */
    slug?: string | null;
    /** Secret edit token of the saved build, present only in `edit` mode. */
    editToken?: string | null;
    /** Allocation to seed from: /tree?from={slug} or the saved build's own tree. */
    initialBuild?: TreeSnapshot | null;
    conversion?: TreeConversion | null;
}

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
    conversion = null,
    initialBuild = null,
    ...props
}: TreeProps) {
    if (conversion !== null && initialBuild !== null) {
        return (
            <ConvertedTree conversion={conversion} original={initialBuild} />
        );
    }

    return <TreeEditor {...props} initialBuild={initialBuild} />;
}

// The editor only mounts once the migration is done, so the planner never seeds
// from the unconverted build.
function ConvertedTree({
    conversion,
    original,
}: {
    conversion: TreeConversion;
    original: TreeSnapshot;
}) {
    const { data: current, error: currentError } = useTreeData();
    const [previous, setPrevious] = useState<TreeData | null>(null);
    const [previousError, setPreviousError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        loadTreeData(patchTree(conversion.treePatch, conversion.treeVersion))
            .then((loaded) => {
                if (!cancelled) {
                    setPrevious(loaded);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setPreviousError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to load tree',
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [conversion.treePatch, conversion.treeVersion]);

    const migration = useMemo<TreeMigration | null>(
        () =>
            previous && current
                ? migrateTree(previous, current, original)
                : null,
        [previous, current, original],
    );

    const error = previousError ?? currentError;

    if (error !== null) {
        return (
            <div className="mx-auto max-w-lg px-4 pt-16 text-sm text-[#e0a58f]">
                The tree could not be converted: {error}. Reload the page to try
                again.
            </div>
        );
    }

    if (migration === null) {
        return (
            <div className="h-[calc(100dvh-69px)] w-full p-4">
                <div className="h-full w-full animate-pulse rounded-[var(--pl-radius)] bg-[var(--pl-panel-2)]" />
            </div>
        );
    }

    return (
        <TreeEditor
            initialBuild={migration.build}
            lockSeed={
                !migration.report.classMissing &&
                !migration.report.ascendancyMissing
            }
            notice={
                <TreeConversionReport
                    source={conversion}
                    className={original.className}
                    report={migration.report}
                />
            }
        />
    );
}

function TreeEditor({
    mode = 'create',
    slug = null,
    editToken = null,
    initialBuild = null,
    notice = null,
    lockSeed = true,
}: Omit<TreeProps, 'conversion'> & { notice?: ReactNode; lockSeed?: boolean }) {
    const { data } = useTreeData();
    const planner = usePlannerState(data, initialBuild, {
        mode,
        slug,
        lockSeed,
    });
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

                {!fullscreen ? notice : null}

                <LazyMount
                    className="min-h-0 flex-1"
                    fallback={
                        <div className="grid h-full place-items-center">
                            <div className="h-full w-full animate-pulse rounded-[var(--pl-radius)] bg-[var(--pl-panel-2)]" />
                        </div>
                    }
                >
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
                </LazyMount>
            </div>
        </>
    );
}
