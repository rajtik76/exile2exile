import type { RequestPayload } from '@inertiajs/core';
import { router, useHttp } from '@inertiajs/react';
import {
    clearAscendancyAllocation,
    freshAllocation,
} from '@poe2-toolkit/tree-core';
import type {
    AscendancyDef,
    BuildAllocation,
    ClassDef,
    TreeData,
} from '@poe2-toolkit/tree-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveClassId } from '@/lib/classCatalog';
import { isNumberArray, isRecord } from '@/lib/guards';
import shared from '@/routes/shared';
import type { TreeSnapshot } from '@/types/tree';

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
 *
 * Saving mirrors the build planner's guest model: a first save POSTs the tree
 * and the server redirects into /t/{slug}/edit holding the freshly minted edit
 * token; later saves PUT the same slug from the unlocked editor.
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
    /** True once there is a class and an allocation worth saving. */
    canSave: boolean;
    /** True while the tree differs from its last saved copy (always true unsaved). */
    dirty: boolean;
    /** A save request is in flight. */
    saving: boolean;
    /** Flashes true for a moment after a successful update. */
    saved: boolean;
    saveError: string | null;
    /**
     * Persist the tree: a first save creates the build and the server redirects
     * to its edit page (minting the public link and edit token); from the edit
     * page it updates the saved build in place.
     */
    save: () => void;
}

export function usePlannerState(
    data: TreeData | null,
    initialBuild: TreeSnapshot | null = null,
    options: { mode?: 'create' | 'edit'; slug?: string | null } = {},
): PlannerState {
    const mode = options.mode ?? 'create';
    const slug = options.slug ?? null;

    const [allocation, setAllocation] = useState<BuildAllocation | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [ascendancy, setAscendancy] = useState<string | null>(null);
    const [imported, setImported] = useState(false);
    const [frameToken, setFrameToken] = useState(0);
    const [buildError, setBuildError] = useState<string | null>(null);
    // The allocation as last persisted, compared by reference: any node edit
    // produces a new allocation object, so identity alone tells us the tree on
    // screen has drifted from its saved copy.
    const [lastSaved, setLastSaved] = useState<BuildAllocation | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const buildForm = useHttp({ code: '' });

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

    // Which page (create, or a build's editor) the seed below already ran for.
    // Keying it this way lets a navigation to a *different* build's editor seed
    // again on the same mounted component.
    const seededFor = useRef<string | null>(null);
    const identity =
        mode === 'edit' && slug !== null ? `edit:${slug}` : 'create';

    // Seed the planner from a server-provided build once the tree data is in:
    // a shared snapshot (/tree?from={slug}) or the editor of a saved tree
    // (/t/{slug}/edit). A snapshot locks class/ascendancy like a PoB import
    // does; the editor keeps them pickable - it IS the author's own build.
    //
    // The seed is skipped when an allocation is already on screen: after a first
    // save the server redirects back into edit mode with the same page component
    // mounted, and overwriting the live allocation with its just-saved copy would
    // only reframe the canvas.
    useEffect(() => {
        if (seededFor.current === identity || !data || !initialBuild) {
            return;
        }

        seededFor.current = identity;

        if (allocation !== null) {
            return;
        }

        const resolvedClassId =
            resolveClassId(data, initialBuild.className) ?? undefined;

        const seededAllocation: BuildAllocation = {
            classId: resolvedClassId,
            ascendId: initialBuild.ascendId ?? undefined,
            allocated: initialBuild.allocated,
            attributeChoices: initialBuild.attributeChoices,
            weaponSets: initialBuild.weaponSets,
            jewels: initialBuild.jewels,
            treeVersion: initialBuild.treeVersion ?? undefined,
        };

        setAllocation(seededAllocation);
        setSelectedClassId(resolvedClassId ?? null);
        setAscendancy(initialBuild.ascendId ?? null);
        setImported(mode !== 'edit');
        setFrameToken((token) => token + 1);

        if (mode === 'edit') {
            setLastSaved(seededAllocation);
        }
        // The allocation guard is a mount-time condition, not a reactive dependency:
        // re-running the seed on every node edit would immediately mark it done anyway.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, initialBuild, mode, identity]);

    // Inertia reuses this page component across navigations, so mode/slug changes
    // arrive as prop changes on live state. React to the transitions with a
    // render-phase state adjustment (not an effect - React re-renders immediately
    // with the fixed state):
    //
    //  - create → edit (the redirect after a first save): the tree on screen IS
    //    the saved copy - adopt it, and pin the picked class so the derived
    //    default (which yields to a present initialBuild) doesn't blank the
    //    pickers and the canvas centre.
    //  - anything → create (a delete, or navigating to the blank /tree): wipe
    //    everything, or the dead build would keep haunting the canvas.
    //  - edit → a different edit: wipe and let the seed take the new build in.
    const [lastIdentity, setLastIdentity] = useState(identity);

    if (identity !== lastIdentity) {
        const cameFromCreate = lastIdentity === 'create';

        setLastIdentity(identity);

        if (identity !== 'create' && cameFromCreate) {
            if (allocation !== null && lastSaved === null) {
                setLastSaved(allocation);
            }

            if (selectedClassId === null && data && initialBuild) {
                setSelectedClassId(
                    resolveClassId(data, initialBuild.className) ?? null,
                );
            }
        } else {
            setAllocation(null);
            setSelectedClassId(null);
            setAscendancy(null);
            setImported(false);
            setLastSaved(null);
            setBuildError(null);
            setSaveError(null);
        }
    }

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
    const canSave = allocation !== null && className !== null;
    const dirty = allocation !== lastSaved;

    const save = () => {
        if (allocation === null || className === null || saving) {
            return;
        }

        // Capture the allocation this save is for: on success it becomes the
        // saved copy, even if the user kept editing while the request ran.
        const savedAllocation = allocation;

        // The typed shape is asserted here once; Inertia's RequestPayload wants
        // index-signature compatibility the toolkit's interfaces can't declare.
        const payload = {
            className,
            ascendId: savedAllocation.ascendId ?? null,
            allocated: savedAllocation.allocated,
            attributeChoices: savedAllocation.attributeChoices ?? {},
            weaponSets: savedAllocation.weaponSets ?? {},
            jewels: savedAllocation.jewels ?? {},
            treeVersion: savedAllocation.treeVersion ?? null,
        } satisfies TreeSnapshot as unknown as RequestPayload;

        setSaveError(null);
        setSaving(true);

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setLastSaved(savedAllocation);
                setSaved(true);
                window.setTimeout(() => setSaved(false), 2000);
            },
            onError: (errors: Record<string, string>) => {
                setSaveError(
                    Object.values(errors)[0] ??
                        'Could not save the build. Try again.',
                );
            },
            onFinish: () => setSaving(false),
        };

        // A first save creates the row; the server redirects into the edit page
        // holding the fresh edit token. Later saves update the row in place.
        if (mode === 'edit' && slug !== null) {
            router.put(
                shared.update.url({ sharedTree: slug }),
                payload,
                options,
            );
        } else {
            router.post(shared.store.url(), payload, options);
        }
    };

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
        canSave,
        dirty,
        saving,
        saved,
        saveError,
        save,
    };
}
