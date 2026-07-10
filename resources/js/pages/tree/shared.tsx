import { Head, Link } from '@inertiajs/react';
import type { BuildAllocation } from '@poe2-toolkit/tree-core';
import { useMemo } from 'react';
import { ENGRAVED } from '@/components/brand';
import { ClassPortrait, classPortrait } from '@/components/build/classPortrait';
import { INPUT_FONT } from '@/components/passive-tree/chrome';
import PassiveTreeView from '@/components/passive-tree/PassiveTreeView';
import { resolveClassId } from '@/lib/classCatalog';
import type { SharedTreeBuild } from '@/lib/usePlannerState';
import { useTreeData } from '@/lib/useTreeData';

/**
 * The read-only viewer for a shared passive tree (/t/{slug}). It drops the
 * planner's class/ascendancy pickers and PoB importer entirely: a name plate
 * over a full-screen, non-editable tree. "Open in planner" carries the build
 * back into /tree as an editable snapshot - the tree only, no gems or items.
 */
export default function SharedTree({
    build,
    slug,
    meta,
}: {
    build: SharedTreeBuild;
    slug: string;
    meta?: { title: string; description: string; alternateJson: string };
}) {
    const { data } = useTreeData();

    const classId = useMemo(
        () => (data ? (resolveClassId(data, build.className) ?? null) : null),
        [data, build.className],
    );

    // The ascendancy's display name, resolved from its id against the live tree.
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
            <Head title={`${build.className} build`} />

            <div className="flex h-[calc(100dvh-69px)] w-full flex-col">
                <div
                    className="relative z-20 flex w-full flex-wrap items-center gap-4 border-b border-[#40331a] px-3 py-4 sm:gap-5 sm:px-6 sm:py-5"
                    style={{
                        // Forged-bronze bar: a vertical sheen-to-shadow gradient with
                        // a warm glow pooling behind the portrait, plus a thin gold
                        // hairline along the top edge - reads as a struck plaque, not
                        // a flat fill.
                        background:
                            'radial-gradient(120% 140% at 8% 0%, rgba(120,86,32,0.28), transparent 55%), linear-gradient(180deg, #251a0b 0%, #1a1108 55%, #0d0904 100%)',
                        // Top gold sheen, a brighter gold hairline along the bottom
                        // edge, and a drop shadow cast down onto the dark tree below -
                        // lifts the plaque off the canvas instead of butting flat into it.
                        boxShadow:
                            'inset 0 1px 0 rgba(240,200,105,0.12), inset 0 -1px 0 rgba(201,162,74,0.55), 0 12px 24px -8px rgba(0,0,0,0.75)',
                    }}
                >
                    <div className="flex min-w-0 items-center gap-4">
                        <span
                            className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full sm:size-16"
                            style={{
                                background:
                                    'radial-gradient(circle at 50% 30%, #2a1d0c, #0b0805 80%)',
                                boxShadow:
                                    'inset 0 0 0 2px rgba(199,154,63,0.7), 0 0 24px -8px rgba(240,200,105,0.45)',
                            }}
                        >
                            {classPortrait(build.className, ascendancyName) ? (
                                <ClassPortrait
                                    className={build.className}
                                    ascendancy={ascendancyName}
                                    size={64}
                                />
                            ) : (
                                <span className="text-xl text-[#e6d2a0]">
                                    {build.className.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </span>
                        <span className="flex min-w-0 flex-col leading-tight">
                            {ascendancyName ? (
                                <>
                                    <span
                                        className="truncate text-2xl text-[#ffe6a8] sm:text-3xl"
                                        style={ENGRAVED}
                                    >
                                        {ascendancyName}
                                    </span>
                                    <span className="mt-0.5 text-xs font-semibold tracking-[0.22em] text-[#b39a64] uppercase">
                                        {build.className}
                                    </span>
                                </>
                            ) : (
                                <span
                                    className="truncate text-2xl text-[#ffe6a8] sm:text-3xl"
                                    style={ENGRAVED}
                                >
                                    {build.className}
                                </span>
                            )}
                        </span>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        {meta ? (
                            // The machine-readable build document. A plain link, not
                            // an "AI, look here" sign: an export affordance humans
                            // expect and any fetch tool reads as a normal anchor.
                            <a
                                href={meta.alternateJson}
                                className="rounded-full px-3.5 py-2 text-[11px] font-semibold tracking-[0.14em] text-[#b39a64] uppercase transition-colors hover:bg-[#f0c869]/12 hover:text-[#ecc878] focus-visible:bg-[#f0c869]/12 focus-visible:text-[#ecc878] focus-visible:outline-none"
                                style={{
                                    border: '1px solid rgba(169,132,47,0.35)',
                                    ...INPUT_FONT,
                                }}
                            >
                                JSON
                            </a>
                        ) : null}
                        <Link
                            href={`/tree?from=${encodeURIComponent(slug)}`}
                            className="rounded-full px-3.5 py-2 text-[11px] font-semibold tracking-[0.14em] text-[#ecc878] uppercase transition-colors hover:bg-[#f0c869]/22 hover:text-[#ffdf9a] focus-visible:bg-[#f0c869]/22 focus-visible:text-[#ffdf9a] focus-visible:outline-none"
                            style={{
                                border: '1px solid rgba(169,132,47,0.55)',
                                ...INPUT_FONT,
                            }}
                        >
                            Open in planner
                        </Link>
                    </div>
                </div>

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
