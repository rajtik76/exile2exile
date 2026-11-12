import { Head, Link } from '@inertiajs/react';
import type { BuildAllocation } from '@poe2-toolkit/tree-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ClassPortrait, classPortrait } from '@/components/build/classPortrait';
import {
    GameVersionBadge,
    gameVersionLabel,
} from '@/components/build/GameVersion';
import { PANEL_FONT } from '@/components/passive-tree/chrome';
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

            <div className="flex h-[calc(100dvh-69px)] w-full flex-col">
                <div
                    className="relative z-20 flex w-full flex-wrap items-center gap-4 border-b border-[#303544] bg-[#11131b] px-3 py-4 sm:gap-5 sm:px-6 lg:px-12"
                    style={PANEL_FONT}
                >
                    <div className="flex min-w-0 items-center gap-4">
                        <span
                            className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full sm:size-16"
                            style={{
                                background:
                                    'radial-gradient(circle at 50% 30%, #343c55, #12141b 80%)',
                                boxShadow:
                                    'inset 0 0 0 1px rgba(128,152,255,0.4)',
                            }}
                        >
                            {classPortrait(build.className, ascendancyName) ? (
                                <ClassPortrait
                                    className={build.className}
                                    ascendancy={ascendancyName}
                                    size={64}
                                />
                            ) : (
                                <span className="text-xl text-[#dfe4ee]">
                                    {build.className.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </span>
                        <span className="flex min-w-0 flex-col leading-tight">
                            {ascendancyName ? (
                                <>
                                    <span
                                        className="truncate text-xl font-semibold text-[#f1f4fa] sm:text-2xl"
                                        style={PANEL_FONT}
                                    >
                                        {ascendancyName}
                                    </span>
                                    <span className="mt-0.5 text-xs font-semibold tracking-[0.22em] text-[#a7b7ff] uppercase">
                                        {build.className}
                                    </span>
                                </>
                            ) : (
                                <span
                                    className="truncate text-xl font-semibold text-[#f1f4fa] sm:text-2xl"
                                    style={PANEL_FONT}
                                >
                                    {build.className}
                                </span>
                            )}
                        </span>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        <GameVersionBadge
                            className="tree-shared-version"
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
                className="h-9 cursor-pointer rounded-lg border border-[#8098ff] bg-[#8098ff] px-3.5 text-[11px] font-semibold tracking-[0.14em] text-[#101424] uppercase transition-colors hover:border-[#a7b7ff] hover:bg-[#a7b7ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a7b7ff] disabled:cursor-wait disabled:opacity-60"
                style={PANEL_FONT}
            >
                JSON
            </button>
            {feedback !== null && (
                <span
                    role="status"
                    className="absolute top-full right-0 z-30 mt-2 w-max rounded-lg border border-[#343a4a] bg-[#1b1e28] px-3 py-2 text-xs text-[#dfe4ee] shadow-lg shadow-black/40"
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
            className="relative z-10 flex flex-wrap items-center gap-3 border-b border-[#303544] bg-[#171a24] px-3 py-3 sm:px-6"
            style={PANEL_FONT}
        >
            <p className="min-w-0 flex-1 text-sm text-[#c3cad8]">
                Made on{' '}
                {gameVersionLabel({
                    era: archive.gameEra,
                    name: archive.eraName,
                })}{' '}
                and shown on the tree of that version. It is read-only.
            </p>
            <Link
                href={tree.url({ query: { from: slug } })}
                className="shrink-0 rounded-lg border border-[#8098ff]/55 px-3.5 py-2 text-[11px] font-semibold tracking-[0.14em] text-[#a7b7ff] uppercase transition-colors hover:bg-[#8098ff]/12 hover:text-[#d4ddff] focus-visible:bg-[#8098ff]/12 focus-visible:outline-none"
            >
                Convert to current version
            </Link>
        </div>
    );
}
