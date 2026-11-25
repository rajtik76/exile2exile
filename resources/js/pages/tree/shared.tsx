import { Head, Link } from '@inertiajs/react';
import type { BuildAllocation } from '@poe2-toolkit/tree-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    GameVersionBadge,
    gameVersionLabel,
} from '@/components/build/GameVersion';
import { BAR_GUTTER, LABEL, Medallion } from '@/components/passive-tree/chrome';
import PassiveTreeView from '@/components/passive-tree/PassiveTreeView';
import { resolveClassId } from '@/lib/classCatalog';
import { TreeSourceProvider } from '@/lib/treeSource';
import type { TreeSnapshotRef } from '@/lib/treeSource';
import { useTreeData } from '@/lib/useTreeData';
import { tree } from '@/routes';
import type { TreeSnapshot } from '@/types/tree';

export interface ArchivedTree extends TreeSnapshotRef {
    gameEra: string;
    eraName: string | null;
    /** Can differ from `treePatch`: an era without its exact snapshot uses its newest one. */
    gamePatch: string;
}

/**
 * The read-only viewer for a shared passive tree (/t/{slug}). It drops the
 * planner's class/ascendancy pickers and PoB importer entirely: a name plate
 * over a full-screen, non-editable tree. There is deliberately no way in: like
 * a build-planner guide, editing starts from the edit link the author saved,
 * never from the public page.
 */
export default function SharedTree({
    archive = null,
    ...props
}: {
    build: TreeSnapshot;
    slug: string;
    archive?: ArchivedTree | null;
    meta?: { title: string; description: string; alternateJson?: string };
}) {
    return (
        <TreeSourceProvider snapshot={archive}>
            <SharedTreeView archive={archive} {...props} />
        </TreeSourceProvider>
    );
}

function SharedTreeView({
    build,
    slug,
    archive,
    meta,
}: {
    build: TreeSnapshot;
    slug: string;
    archive: ArchivedTree | null;
    meta?: { title: string; description: string; alternateJson?: string };
}) {
    const { data } = useTreeData();

    const classId = useMemo(
        () => (data ? (resolveClassId(data, build.className) ?? null) : null),
        [data, build.className],
    );

    // The ascendancy's display name, resolved from its id against the drawn tree.
    const ascendancyName = useMemo(() => {
        if (!data || !build.ascendId) {
            return null;
        }

        const ascendancies =
            data.classes.find((cls) => cls.id === classId)?.ascendancies ?? [];

        return (
            ascendancies.find((asc) => asc.id === build.ascendId)?.name ??
            build.ascendId
        );
    }, [data, classId, build.ascendId]);

    const allocation: BuildAllocation = useMemo(
        () => ({
            classId: classId ?? undefined,
            ascendId: build.ascendId ?? undefined,
            allocated: build.allocated,
            attributeChoices: build.attributeChoices,
            weaponSets: build.weaponSets,
            jewels: build.jewels,
            treeVersion: build.treeVersion ?? undefined,
        }),
        [classId, build],
    );

    return (
        <>
            <Head
                title={
                    archive
                        ? `${build.className} build (PoE2 ${archive.gameEra})`
                        : `${build.className} build`
                }
            />

            <div className="flex h-[calc(100dvh-var(--masthead-h))] w-full flex-col">
                <div
                    className={`relative z-20 flex w-full flex-wrap items-center gap-4 border-b border-line bg-stone-900 py-3 font-ui sm:gap-5 ${BAR_GUTTER}`}
                >
                    <div className="flex min-w-0 items-center gap-4">
                        <Medallion
                            className={build.className}
                            ascendancy={ascendancyName}
                            size={56}
                        />
                        <span className="flex min-w-0 flex-col">
                            <span className="truncate font-display text-[22px] leading-[1.2] text-paper sm:text-[30px] sm:leading-[1.15] sm:[word-spacing:-0.1em]">
                                {ascendancyName ?? build.className}
                            </span>
                            {ascendancyName ? (
                                <span className={LABEL}>{build.className}</span>
                            ) : null}
                        </span>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-4">
                        <GameVersionBadge
                            version={
                                archive
                                    ? {
                                          era: archive.gameEra,
                                          name: archive.eraName,
                                      }
                                    : undefined
                            }
                        />
                        {meta?.alternateJson ? (
                            <JsonCopyButton url={meta.alternateJson} />
                        ) : null}
                    </div>
                </div>

                {archive ? (
                    <ArchiveNotice archive={archive} slug={slug} />
                ) : null}

                <div className="min-h-0 flex-1">
                    <PassiveTreeView
                        editable={false}
                        classId={classId}
                        ascendancy={build.ascendId ?? null}
                        allocation={allocation}
                        showSearch
                        showPointsCounter={false}
                        frameToken={data ? 1 : 0}
                        className="h-full"
                    />
                </div>
            </div>
        </>
    );
}

export function JsonCopyButton({ url }: { url: string }) {
    const [feedback, setFeedback] = useState<'copied' | 'failed' | null>(null);
    const [copying, setCopying] = useState(false);
    const feedbackTimer = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (feedbackTimer.current !== null) {
                window.clearTimeout(feedbackTimer.current);
            }
        };
    }, []);

    async function copyJson(): Promise<void> {
        setCopying(true);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Failed to load JSON');
            }

            await navigator.clipboard.writeText(await response.text());
            setFeedback('copied');
        } catch {
            setFeedback('failed');
        } finally {
            setCopying(false);

            if (feedbackTimer.current !== null) {
                window.clearTimeout(feedbackTimer.current);
            }

            feedbackTimer.current = window.setTimeout(
                () => setFeedback(null),
                3000,
            );
        }
    }

    return (
        <span className="relative inline-flex">
            <button
                type="button"
                onClick={copyJson}
                disabled={copying}
                aria-label="Copy build JSON"
                className="btn btn-iron disabled:cursor-wait"
            >
                JSON
            </button>
            {feedback !== null && (
                <span
                    role="status"
                    className={`notice absolute top-full right-0 z-30 mt-2 w-max px-3 py-2 font-ui text-[13px] text-paper shadow-lg shadow-black/45 ${feedback === 'copied' ? 'notice-ok' : 'notice-bad'}`}
                >
                    {feedback === 'copied' ? 'JSON copied' : 'Copy failed'}
                </span>
            )}
        </span>
    );
}

function ArchiveNotice({
    archive,
    slug,
}: {
    archive: ArchivedTree;
    slug: string;
}) {
    return (
        <div
            className={`notice relative z-10 flex flex-wrap items-center gap-3 border-t-0 border-r-0 py-3 font-ui ${BAR_GUTTER}`}
        >
            <p className="min-w-0 flex-1 text-sm">
                Made on{' '}
                {gameVersionLabel({
                    era: archive.gameEra,
                    name: archive.eraName,
                })}{' '}
                and shown on the tree of that version. It is read-only.
            </p>
            <Link
                href={tree.url({ query: { from: slug } })}
                className="btn btn-sm btn-iron shrink-0"
            >
                Convert to current version
            </Link>
        </div>
    );
}
