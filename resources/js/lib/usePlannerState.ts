import { useHttp } from '@inertiajs/react';
import {
    clearAscendancyAllocation,
    freshAllocation,
} from '@poe2-toolkit/tree-core';
import type {
    AscendancyDef,
    AttributeChoice,
    BuildAllocation,
    ClassDef,
    JewelInfo,
    TreeData,
    WeaponSet,
} from '@poe2-toolkit/tree-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveClassId } from '@/lib/classCatalog';
import { isNumberArray, isRecord } from '@/lib/guards';

/**
 * A shared build's allocation as the server stores and replays it: the class by
 * *name* (the import's numeric id is not stable across versions), the ascendancy
 * id, allocated nodes, attribute choices, jewels and the tree version. Seeds the
 * editable planner when /tree opens with `?from={slug}`.
 */
export interface SharedTreeBuild {
    className: string;
    ascendId: string | null;
    allocated: number[];
    attributeChoices?: Record<number, AttributeChoice>;
    weaponSets?: Record<number, WeaponSet>;
    jewels?: Record<number, JewelInfo>;
    treeVersion?: string | null;
}

/** The payload the share endpoint persists - the live canvas allocation. */
interface SharePayload {
    className: string;
    ascendId: string | null;
    allocated: number[];
    attributeChoices: Record<number, AttributeChoice>;
    weaponSets: Record<number, WeaponSet>;
    jewels: Record<number, JewelInfo>;
    treeVersion: string | null;
}

/** The share endpoint's JSON reply: the new row's slug and its public URL. */
interface ShareResponse {
    slug: string;
    url: string;
}

/**
 * The planner's build state, lifted out of {@link PassiveTreeView} so the page
 * can own it: the active class, ascendancy and allocation, plus the class /
 * ascendancy pickers and the Path of Building importer that drive them. The
 * tree component is now controlled - it draws this state and reports node edits
 * back through {@link applyAllocation}, but never holds the build itself.
 *
 * Node-click editing (and the 123-point budget it enforces) stays in the
 * component, on the canvas where it happens; this hook owns everything the
 * surrounding chrome touches.
 */
export interface PlannerState {
    allocation: BuildAllocation | null;
    classId: number | null;
    ascendancy: string | null;
    /** True once a build is imported: its class and ascendancy are then locked. */
    imported: boolean;
    /** Playable classes (legacy class entries with no ascendancies are dropped). */
    classes: ClassDef[];
    /** Ascendancies of the active class. */
    ascendancies: AscendancyDef[];
    /** Bumped after an import so the canvas frames the freshly loaded allocation. */
    frameToken: number;
    /** PoB import field. */
    code: string;
    setCode: (value: string) => void;
    loading: boolean;
    buildError: string | null;
    selectClass: (id: number) => void;
    selectAscendancy: (id: string | null) => void;
    loadBuild: () => void;
    clearBuild: () => void;
    /** Store an allocation the controlled component emitted from a node edit. */
    applyAllocation: (next: BuildAllocation) => void;
    /** True once there is a class and an allocation worth sharing. */
    canShare: boolean;
    /** A share request is in flight. */
    sharing: boolean;
    /** Public URL of the most recent share, or null until one is created. */
    shareUrl: string | null;
    shareError: string | null;
    /** Persist the current allocation as a public link and expose its URL. */
    share: () => void;
    /** Dismiss the share read-out (closes its row in the bar). */
    clearShare: () => void;
}

export function usePlannerState(
    data: TreeData | null,
    initialBuild: SharedTreeBuild | null = null,
): PlannerState {
    const [allocation, setAllocation] = useState<BuildAllocation | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [ascendancy, setAscendancy] = useState<string | null>(null);
    const [imported, setImported] = useState(false);
    const [frameToken, setFrameToken] = useState(0);
    const [buildError, setBuildError] = useState<string | null>(null);
    // The last share's outcome, pinned to the allocation it was made for. Any edit
    // produces a new allocation object, so reference equality alone tells us the
    // link is stale - no effect, no copying a URL that no longer matches the tree.
    const [shareResult, setShareResult] = useState<{
        for: BuildAllocation | null;
        url: string | null;
        error: string | null;
    }>({ for: null, url: null, error: null });

    const buildForm = useHttp({ code: '' });
    const shareForm = useHttp<SharePayload, ShareResponse>({
        className: '',
        ascendId: null,
        allocated: [],
        attributeChoices: {},
        weaponSets: {},
        jewels: {},
        treeVersion: null,
    });

    // Playable classes only - GGG's export also carries legacy classes with no
    // ascendancies (e.g. Marauder) and no portrait art, which must not appear in
    // the picker or be chosen as the default.
    const classes = useMemo(
        () =>
            (data?.classes ?? []).filter((cls) => cls.ascendancies.length > 0),
        [data],
    );

    // The active class id, derived rather than stored so the first-class default
    // needs no effect: until the user (or an import/share seed) picks one, fall
    // back to the first playable class - except when seeding a shared build, which
    // resolves its own class below.
    const classId =
        selectedClassId ?? (initialBuild ? null : (classes[0]?.id ?? null));

    const ascendancies = useMemo(
        () => classes.find((cls) => cls.id === classId)?.ascendancies ?? [],
        [classes, classId],
    );

    // Seed the editable planner from a shared build (/tree?from={slug}) once the
    // tree data is in. It adopts the allocation as a snapshot - tree only, no gems
    // or items - and locks class/ascendancy like a PoB import does.
    const seeded = useRef(false);
    useEffect(() => {
        if (seeded.current || !data || !initialBuild) {
            return;
        }

        const resolvedClassId =
            resolveClassId(data, initialBuild.className) ?? undefined;

        setAllocation({
            classId: resolvedClassId,
            ascendId: initialBuild.ascendId ?? undefined,
            allocated: initialBuild.allocated,
            attributeChoices: initialBuild.attributeChoices,
            weaponSets: initialBuild.weaponSets,
            jewels: initialBuild.jewels,
            treeVersion: initialBuild.treeVersion ?? undefined,
        });
        setSelectedClassId(resolvedClassId ?? null);
        setAscendancy(initialBuild.ascendId ?? null);
        setImported(true);
        setFrameToken((token) => token + 1);
        seeded.current = true;
    }, [data, initialBuild]);

    const selectClass = (nextClassId: number) => {
        setSelectedClassId(nextClassId);
        setAscendancy(null);
        // A different class starts from its own root: drop every allocated node
        // (main tree and ascendancy) so nothing carries over.
        setAllocation(freshAllocation(nextClassId));
    };

    // Switching ascendancy deactivates the previous ascendancy's nodes; the main
    // tree, attributes and jewels carry through.
    const selectAscendancy = (nextAscendancy: string | null) => {
        if (data && allocation && ascendancy && ascendancy !== nextAscendancy) {
            setAllocation({
                ...allocation,
                ascendId: nextAscendancy ?? undefined,
                allocated: clearAscendancyAllocation(
                    data,
                    allocation.allocated,
                    ascendancy,
                ),
            });
        }

        setAscendancy(nextAscendancy);
    };

    const loadBuild = () => {
        if (buildForm.data.code.trim() === '' || buildForm.processing) {
            return;
        }

        setBuildError(null);
        buildForm.post('/tree/allocation', {
            onSuccess: (response) => {
                // The fields the planner reads directly must be present and
                // well-typed before the response is adopted as an allocation.
                if (
                    !isRecord(response) ||
                    typeof response.className !== 'string' ||
                    !isNumberArray(response.allocated)
                ) {
                    setBuildError('Could not load build.');

                    return;
                }

                const alloc = response as unknown as BuildAllocation & {
                    className: string;
                };
                // The endpoint sends the class by name (the import's numeric
                // classId is not stable across versions); resolve it to the live
                // GGG id through the catalog before the planner takes it on.
                const resolvedClassId = data
                    ? (resolveClassId(data, alloc.className) ?? undefined)
                    : undefined;
                setAllocation({ ...alloc, classId: resolvedClassId });
                setSelectedClassId(resolvedClassId ?? null);
                setAscendancy(alloc.ascendId ?? null);
                setImported(true);
                setFrameToken((token) => token + 1);
            },
            onError: (errors) => {
                setBuildError(errors.code ?? 'Could not load build.');
            },
        });
    };

    const clearBuild = () => {
        setAllocation(null);
        setBuildError(null);
        setImported(false);
        buildForm.setData('code', '');
    };

    const className = classes.find((cls) => cls.id === classId)?.name ?? null;
    const canShare = allocation !== null && className !== null;

    const share = () => {
        if (allocation === null || className === null || shareForm.processing) {
            return;
        }

        // The current tree is already shared - reuse that link instead of minting
        // a duplicate row on every click. An edit produces a new allocation object,
        // so this only short-circuits while nothing has changed.
        if (shareResult.for === allocation && shareResult.url !== null) {
            return;
        }

        // Capture the allocation this share is for, so its outcome is shown only
        // while the tree on screen still matches it.
        const sharedAllocation = allocation;

        setShareResult({ for: sharedAllocation, url: null, error: null });
        shareForm.transform(() => ({
            className,
            ascendId: sharedAllocation.ascendId ?? null,
            allocated: sharedAllocation.allocated,
            attributeChoices: sharedAllocation.attributeChoices ?? {},
            weaponSets: sharedAllocation.weaponSets ?? {},
            jewels: sharedAllocation.jewels ?? {},
            treeVersion: sharedAllocation.treeVersion ?? null,
        }));
        void shareForm.post('/tree/share', {
            onSuccess: (response) => {
                // Adopt the link only when the reply actually carries one.
                const url =
                    isRecord(response) && typeof response.url === 'string'
                        ? response.url
                        : null;

                setShareResult({
                    for: sharedAllocation,
                    url,
                    error: url
                        ? null
                        : 'Could not create a share link. Try again.',
                });
            },
            onError: () => {
                setShareResult({
                    for: sharedAllocation,
                    url: null,
                    error: 'Could not create a share link. Try again.',
                });
            },
        });
    };

    const clearShare = () => {
        setShareResult({ for: null, url: null, error: null });
    };

    // The share outcome is only current while its allocation is still on screen.
    const shareIsFresh = shareResult.for === allocation;

    return {
        allocation,
        classId,
        ascendancy,
        imported,
        classes,
        ascendancies,
        frameToken,
        code: buildForm.data.code,
        setCode: (value) => buildForm.setData('code', value),
        loading: buildForm.processing,
        buildError,
        selectClass,
        selectAscendancy,
        loadBuild,
        clearBuild,
        applyAllocation: setAllocation,
        canShare,
        sharing: shareForm.processing,
        shareUrl: shareIsFresh ? shareResult.url : null,
        shareError: shareIsFresh ? shareResult.error : null,
        share,
        clearShare,
    };
}
