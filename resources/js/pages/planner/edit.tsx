import { Head, router, useForm } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { classPortrait } from '@/components/build/classPortrait';
import BuildClassGallery from '@/components/planner/BuildClassGallery';
import Button from '@/components/planner/Button';
import DroppedModsNotice from '@/components/planner/DroppedModsNotice';
import MarkdownField from '@/components/planner/MarkdownField';
import { ModsProvider } from '@/components/planner/ModsContext';
import PhaseTabs from '@/components/planner/PhaseTabs';
import PlannerEquipment from '@/components/planner/PlannerEquipment';
import PlannerGems, { GemsViewToggle } from '@/components/planner/PlannerGems';
import PlannerTree from '@/components/planner/PlannerTree';
import PobImportPanel from '@/components/planner/PobImportPanel';
import { ReferencesProvider } from '@/components/planner/ReferencesContext';
import ScrollToTop from '@/components/planner/ScrollToTop';
import SectionEditor from '@/components/planner/SectionEditor';
import SharePanel from '@/components/planner/SharePanel';
import { TextInput } from '@/components/planner/ui/Field';
import { Modal } from '@/components/planner/ui/Overlay';
import { Panel } from '@/components/planner/ui/Panel';
import { Eyebrow } from '@/components/planner/ui/Text';
import { resolveAscendancyName } from '@/lib/classCatalog';
import { xsrfToken } from '@/lib/csrf';
import { loadGemsView, saveGemsView } from '@/lib/gemsView';
import type { GemsView } from '@/lib/gemsView';
import type { ModInfo, ModMap } from '@/lib/modLines';
import {
    activeSectionKey,
    clearDraft,
    clonePlanSection,
    draftKeyFor,
    emptyAllocation,
    emptySection,
    fallbackActiveTabId,
    loadDraft,
    moveTab,
    nextPhaseTab,
    removeTab,
    saveDraft,
    sectionFor,
    SECTION_KEYS,
} from '@/lib/planner';
import { collectTokens, refKey } from '@/lib/planReferences';
import type { PlanReference, ReferenceMap } from '@/lib/planReferences';
import { reconcileNotablePriority } from '@/lib/treeNotables';
import { useTreeData } from '@/lib/useTreeData';
import planner from '@/routes/planner';
import { resolve as resolveMods } from '@/routes/planner/mods';
import { resolve as resolveReferences } from '@/routes/planner/references';
import type {
    PlanBuild,
    PlanData,
    PlanGroup,
    PlanMode,
    PlanSection,
    PlanTab,
    SectionKey,
} from '@/types/planner';
import type { TreeAllocation } from '@/types/tree';

/**
 * The build-plan editor, used for both a fresh plan (mode "create") and an existing
 * one (mode "edit"). A create submit is a POST that the server answers with a
 * redirect back here in edit mode - so the author lands holding the slug and secret
 * token, with the shareable read link shown at the top.
 */
export default function PlannerEdit({
    mode: pageMode,
    slug,
    editToken,
    plan,
    title,
    references,
    mods,
}: {
    mode: 'create' | 'edit';
    slug: string | null;
    editToken: string | null;
    title: string;
    plan: PlanData;
    references: ReferenceMap;
    mods: ModMap;
}) {
    // A draft autosaved before the last save survives a hard refresh; when present
    // it seeds the editor instead of the server copy, so unsaved work isn't lost.
    // The token is never taken from the draft - it always comes fresh from props.
    const draftKey = draftKeyFor(pageMode === 'edit' ? slug : null);
    const [draft] = useState(() => loadDraft(draftKey));

    // The reference map (icon/tooltip/flavour for each token) is display-only data,
    // never persisted: only the token id lives in the text. Seeded from the server's
    // live resolution of saved tokens; tokens restored from a draft but not yet in
    // the map are re-resolved live below, so references can never go stale.
    const [refMap, setRefMap] = useState<ReferenceMap>(() => ({
        ...references,
    }));

    const addReference = useCallback((reference: PlanReference): void => {
        setRefMap((previous) => {
            const key = refKey(reference.type, reference.id);

            return previous[key] ? previous : { ...previous, [key]: reference };
        });
    }, []);

    // The mod map (tier line, ranges, type for each stored affix id) is display-only,
    // like the reference map: only the mod id and rolled values are persisted. Seeded
    // from the server's resolution of saved ids; ids restored from a draft but not yet
    // in the map are re-resolved live below. The picker adds a freshly picked mod itself.
    const [modMap, setModMap] = useState<ModMap>(() => ({ ...mods }));

    const addMod = useCallback((mod: ModInfo): void => {
        setModMap((previous) =>
            previous[mod.id] ? previous : { ...previous, [mod.id]: mod },
        );
    }, []);

    // The editable plan lives in local state, NOT Inertia's useForm: useForm deep-clones
    // its whole data object on every setData call, which for a plan this size (six phases
    // of items/gems/tree + up-to-600-node allocations) both costs milliseconds per
    // keystroke AND hands every consumer new object references - busting the memoisation
    // that keeps the PIXI passive tree idle while typing. Local state with structural
    // sharing keeps untouched branches referentially stable, so the tree never re-renders
    // on a keystroke. useForm stays purely as the submit + validation-error vehicle.
    const form = useForm<Record<string, never>>({});
    // Errors are keyed by the transformed payload's fields (title, tabs, sections…), not
    // the form's own data shape, so read them through a wider type.
    const formErrors = form.errors as Partial<
        Record<'title' | 'tabs' | 'description', string>
    >;

    interface PlanContent {
        title: string;
        description: string;
        mode: PlanMode;
        build: PlanBuild;
        tabs: PlanTab[];
        sections: Record<string, PlanSection>;
    }

    const [data, setPlanData] = useState<PlanContent>(() => ({
        title: draft?.title ?? title,
        description: draft?.description ?? plan.description,
        mode: (draft?.mode ?? plan.mode) as PlanMode,
        build: (draft?.build ?? plan.build) as PlanBuild,
        tabs: (draft?.tabs ?? plan.tabs) as PlanTab[],
        sections: (draft?.sections ?? plan.sections) as Record<
            string,
            PlanSection
        >,
    }));

    const [activeTabId, setActiveTabId] = useState<string>(
        draft?.activeTabId ?? plan.tabs[0]?.id ?? 'act-1',
    );

    // Create and edit both render this same 'planner/edit' component, so an Inertia
    // visit between them (e.g. a fresh plan created by PoB import redirecting into the
    // editor) reuses this mounted instance and only swaps props - it never remounts, so
    // the useState initializers above keep the previous page's state (a blank build,
    // hence the class gallery). Re-seed the whole editor from the new props whenever the
    // plan identity (its slug) changes, honouring any draft saved for that slug.
    const loadedSlug = useRef(slug);
    useEffect(() => {
        if (loadedSlug.current === slug) {
            return;
        }

        loadedSlug.current = slug;
        const fresh = loadDraft(draftKeyFor(pageMode === 'edit' ? slug : null));

        setPlanData({
            title: fresh?.title ?? title,
            description: fresh?.description ?? plan.description,
            mode: (fresh?.mode ?? plan.mode) as PlanMode,
            build: (fresh?.build ?? plan.build) as PlanBuild,
            tabs: (fresh?.tabs ?? plan.tabs) as PlanTab[],
            sections: (fresh?.sections ?? plan.sections) as Record<
                string,
                PlanSection
            >,
        });
        setActiveTabId(fresh?.activeTabId ?? plan.tabs[0]?.id ?? 'act-1');
        setRefMap({ ...references });
        setModMap({ ...mods });
        // Only the slug change drives a re-seed; the guard above keeps a same-plan prop
        // update (e.g. after saving) from clobbering in-progress edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    // Whether the PoB import modal is open (create only). Opened from a button on the
    // class gallery; an import seeds the editor and closes it.
    const [showImport, setShowImport] = useState(false);
    // Author-mod lines a PoB import couldn't map, kept until the author dismisses them.
    const [droppedMods, setDroppedMods] = useState<Record<string, string[]>>(
        {},
    );

    // Whether the passive tree is currently fullscreen - hides the ScrollToTop
    // waypoint for the duration, since there's nothing to scroll to while the
    // tree fills the screen (see `PlannerTree`'s `onFullscreenChange`).
    const [treeFullscreen, setTreeFullscreen] = useState(false);

    // The gems layout (icon grid vs named list) is a display preference, remembered in
    // localStorage rather than the plan, and lives here so the panel header's toggle and
    // the gems body below it share one source of truth.
    const [gemsView, setGemsViewState] = useState<GemsView>(loadGemsView);
    const setGemsView = useCallback((view: GemsView): void => {
        setGemsViewState(view);
        saveGemsView(view);
    }, []);

    // Mirror every edit into the draft so a refresh can restore it. Only the text
    // (tokens included) is stored - never resolved reference data. Debounced: a draft
    // serialises the whole plan (every phase's sections + allocations) to localStorage,
    // so doing it per keystroke stutters fast typing - save once typing settles.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            saveDraft(draftKey, {
                title: data.title,
                description: data.description,
                mode: data.mode,
                build: data.build as PlanBuild,
                tabs: data.tabs as PlanTab[],
                sections: data.sections as Record<string, PlanSection>,
                activeTabId,
            });
        }, 400);

        return () => window.clearTimeout(timer);
    }, [draftKey, data, activeTabId]);

    // Resolve any reference token present in the text but not yet in the map (e.g.
    // tokens restored from a draft on a hard refresh, or pasted) to live catalogue
    // data. Freshly picked tokens are already added by the picker. Each token is
    // requested at most once (tracked in a ref) so unresolvable tokens can't loop.
    const requestedTokens = useRef<Set<string>>(new Set());
    useEffect(() => {
        const sections = data.sections as Record<string, PlanSection>;
        const texts = [
            data.description,
            ...Object.values(sections).flatMap((section) =>
                SECTION_KEYS.map((key) => section[key]?.notes ?? ''),
            ),
        ];

        // References come from text tokens, equipment slots (base + runes) and gems.
        const slotRefs = Object.values(sections).flatMap((section) =>
            Object.values(section.items?.slots ?? {}).flatMap((item) => [
                ...(item.base ? [item.base] : []),
                ...item.sockets.filter((socket) => socket !== null),
            ]),
        );
        const gemRefs = Object.values(sections).flatMap((section) =>
            (section.gems?.groups ?? []).flatMap((group) => group.gems),
        );

        const missing = [
            ...collectTokens(texts),
            ...slotRefs,
            ...gemRefs,
        ].filter((token) => {
            const key = refKey(token.type, token.id);

            return !refMap[key] && !requestedTokens.current.has(key);
        });

        if (missing.length === 0) {
            return;
        }

        missing.forEach((token) =>
            requestedTokens.current.add(refKey(token.type, token.id)),
        );

        void fetch(resolveReferences.url(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': xsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ refs: missing }),
        })
            .then((response) =>
                response.ok ? response.json() : { references: {} },
            )
            .then((body: { references?: ReferenceMap }) => {
                if (
                    body.references &&
                    Object.keys(body.references).length > 0
                ) {
                    setRefMap((previous) => ({
                        ...previous,
                        ...body.references,
                    }));
                }
            })
            .catch(() => {});
    }, [data, refMap]);

    // Resolve any stored affix id present in an equipment slot but not yet in the mod
    // map (e.g. ids restored from a draft on refresh) to its live tier line. Freshly
    // picked mods are already added by the picker. Each id is requested at most once.
    const requestedMods = useRef<Set<string>>(new Set());
    useEffect(() => {
        const sections = data.sections as Record<string, PlanSection>;
        const missing = [
            ...new Set(
                Object.values(sections).flatMap((section) =>
                    Object.values(section.items?.slots ?? {}).flatMap((item) =>
                        item.stats
                            .map((stat) => stat.modId)
                            .filter((id): id is string => id !== null),
                    ),
                ),
            ),
        ].filter(
            (id) => id !== '' && !modMap[id] && !requestedMods.current.has(id),
        );

        if (missing.length === 0) {
            return;
        }

        missing.forEach((id) => requestedMods.current.add(id));

        void fetch(resolveMods.url(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': xsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ ids: missing }),
        })
            .then((response) => (response.ok ? response.json() : { mods: {} }))
            .then((body: { mods?: ModMap }) => {
                if (body.mods && Object.keys(body.mods).length > 0) {
                    setModMap((previous) => ({ ...previous, ...body.mods }));
                }
            })
            .catch(() => {});
    }, [data, modMap]);

    const mode = data.mode as PlanMode;
    const tabs = data.tabs as PlanTab[];
    const sectionKey = activeSectionKey(mode, activeTabId);
    const currentSection = sectionFor(data as PlanData, sectionKey);

    // The chosen class/ascendancy drives the gallery gate, the header label and the
    // faded backdrop. The ascendancy display name comes from the live tree (the
    // build only stores its id), and the portrait is the game's own centre art.
    const build = data.build as PlanBuild;
    const { data: treeData } = useTreeData();
    const selectedAscName = treeData
        ? resolveAscendancyName(treeData, build.className, build.ascendId)
        : null;
    const portrait = build.className
        ? classPortrait(build.className, selectedAscName)
        : null;

    /** Persist an updated section set under the active key, preserving every other
     *  branch's reference (structural sharing) so unrelated components don't re-render. */
    function setSection(section: PlanSection): void {
        setPlanData((previous) => ({
            ...previous,
            sections: { ...previous.sections, [sectionKey]: section },
        }));
    }

    function setGroup(key: SectionKey, group: PlanGroup): void {
        setSection({ ...currentSection, [key]: group });
    }

    // The active section key, mirrored into a ref so the memoised tree handler always
    // targets the current phase without being re-created every render.
    const sectionKeyRef = useRef(sectionKey);
    useEffect(() => {
        sectionKeyRef.current = sectionKey;
    });

    // A stable allocation handler so <PlannerTree> can be memoised and stay idle while
    // the author types elsewhere. The functional state update touches only the active
    // phase's tree, leaving every other branch's reference intact.
    const handleTreeAllocationChange = useCallback(
        (allocation: TreeAllocation) => {
            setPlanData((previous) => {
                const key = sectionKeyRef.current;
                const section = previous.sections[key] ?? emptySection();
                const notablePriority = treeData
                    ? reconcileNotablePriority(
                          section.tree.notablePriority ?? [],
                          allocation.allocated,
                          treeData,
                      )
                    : section.tree.notablePriority;

                return {
                    ...previous,
                    sections: {
                        ...previous.sections,
                        [key]: {
                            ...section,
                            tree: {
                                ...section.tree,
                                allocation,
                                notablePriority,
                            },
                        },
                    },
                };
            });
        },
        [treeData],
    );

    function setMode(next: PlanMode): void {
        setPlanData((previous) => ({ ...previous, mode: next }));
    }

    // After picking a class/ascendancy from the gallery, jump back to the top
    // and drop the cursor straight into the name field.
    const nameInputRef = useRef<HTMLInputElement>(null);
    const focusNameAfterPick = useRef(false);

    useEffect(() => {
        if (build.className && focusNameAfterPick.current) {
            focusNameAfterPick.current = false;
            window.scrollTo({ top: 0 });
            nameInputRef.current?.focus();
        }
    }, [build.className]);

    function pickBuild(next: PlanBuild): void {
        focusNameAfterPick.current = true;
        setBuild(next);
    }

    /** Seed the editor from a PoB import (mapped server-side, not yet saved): load its
     *  whole plan into local state and open the editor. The gem/mod/rune references
     *  resolve lazily via the effects above. The author saves it like any fresh plan. */
    function loadImported(
        importedTitle: string,
        imported: PlanData,
        importedDroppedMods: Record<string, string[]>,
    ): void {
        setPlanData({
            title: importedTitle,
            description: imported.description,
            mode: imported.mode,
            build: imported.build,
            tabs: imported.tabs,
            sections: imported.sections,
        });
        setDroppedMods(importedDroppedMods);
        setActiveTabId(imported.tabs[0]?.id ?? 'act-1');
        window.scrollTo({ top: 0 });
    }

    /** Set the build; changing class invalidates every phase's tree (class-specific
     *  nodes), so drop all allocations when the class changes. */
    function setBuild(next: PlanBuild): void {
        if (next.className === data.build.className) {
            setPlanData((previous) => ({ ...previous, build: next }));

            return;
        }

        setPlanData((previous) => {
            const cleared: Record<string, PlanSection> = {};

            for (const [key, section] of Object.entries(previous.sections)) {
                cleared[key] = {
                    ...section,
                    tree: { ...section.tree, allocation: emptyAllocation() },
                };
            }

            return { ...previous, build: next, sections: cleared };
        });
    }

    /** Add the next suggested phase (prefilled per the fixed act order, or a fresh
     *  custom phase once every base phase is in use), inheriting the currently last
     *  tab's whole plan - paper-doll, gems, tree and every priority/note. */
    function addTab(): void {
        const tab = nextPhaseTab(tabs);

        if (!tab) {
            return;
        }

        const previousId = tabs[tabs.length - 1].id;
        const inherited = clonePlanSection(
            sectionFor(data as PlanData, previousId),
        );

        setPlanData((previous) => ({
            ...previous,
            tabs: [...previous.tabs, tab],
            sections: { ...previous.sections, [tab.id]: inherited },
        }));
        setActiveTabId(tab.id);
    }

    function renameTab(id: string, label: string): void {
        setPlanData((previous) => ({
            ...previous,
            tabs: previous.tabs.map((tab) =>
                tab.id === id ? { ...tab, label } : tab,
            ),
        }));
    }

    /** Move a phase one slot left/right - phases are freely orderable, no fixed
     *  sequence is enforced. */
    function handleMoveTab(id: string, direction: 'left' | 'right'): void {
        setPlanData((previous) => ({
            ...previous,
            tabs: moveTab(previous.tabs, id, direction),
        }));
    }

    /** Remove a phase. At least one phase always remains. */
    function handleRemoveTab(id: string): void {
        const remaining = removeTab(tabs, id);

        if (remaining === tabs) {
            return;
        }

        setPlanData((previous) => {
            const nextSections = { ...previous.sections };
            delete nextSections[id];

            return {
                ...previous,
                tabs: removeTab(previous.tabs, id),
                sections: nextSections,
            };
        });

        if (activeTabId === id) {
            setActiveTabId(fallbackActiveTabId(tabs, remaining, id));
        }
    }

    /**
     * Start over with a brand-new build. This navigates to the create editor rather
     * than wiping state in place: on an existing plan the slug/token in the URL still
     * belong to the saved build, so a refresh would otherwise resurrect its share
     * panel and re-save over it. A fresh create page (slug null) has no such baggage -
     * the next save mints a new plan. Both drafts are dropped so nothing restores.
     */
    function clearBuild(): void {
        if (
            !window.confirm(
                'Clear the whole build? This starts a fresh build and drops the saved draft. It cannot be undone.',
            )
        ) {
            return;
        }

        clearDraft(draftKey);
        clearDraft(draftKeyFor(null));
        router.visit(planner.create.url());
    }

    function submit(event: React.FormEvent): void {
        event.preventDefault();

        // The plan content lives in local state, so fold it into the request payload at
        // submit time. The edit is authorised by the unlocked session (never a token in
        // the body), so nothing secret rides along.
        form.transform(() => data);

        // On a successful save the server copy is now authoritative, so drop the
        // draft. For a new plan this clears the shared "new" draft before the
        // redirect carries the author to the slug-scoped editor.
        const options = {
            preserveScroll: true,
            onSuccess: () => clearDraft(draftKey),
        };

        if (pageMode === 'create') {
            form.post(planner.store.url(), options);

            return;
        }

        if (slug) {
            form.put(planner.update.url({ plan: slug }), options);
        }
    }

    const publicUrl = slug ? planner.show.url({ plan: slug }) : null;
    // The edit page URL carries no secret - it lands on the unlock form. The token is
    // shown separately so the author can save it and paste it there to edit later.
    const editUrl = slug ? planner.edit.url({ plan: slug }) : null;

    return (
        <form
            onSubmit={submit}
            className="relative mx-auto max-w-5xl px-4 pt-8 pb-28"
        >
            <Head
                title={
                    pageMode === 'create' ? 'New build plan' : `Edit - ${title}`
                }
            />

            <ReferencesProvider map={refMap} addReference={addReference}>
                <ModsProvider map={modMap} addMod={addMod}>
                    {/* Class/ascendancy centre art as a page backdrop, starting just
                    under the top nav. The GGPK art is a round medallion (character
                    centred, transparent corners), so we show the whole circle - every
                    class stays visible - and fade its rim into the page. */}
                    {portrait && (
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 top-0 z-0 flex justify-center overflow-hidden"
                        >
                            <img
                                alt=""
                                src={portrait.src}
                                className="w-[620px] max-w-none opacity-45 select-none"
                                style={{
                                    maskImage:
                                        'radial-gradient(circle at 50% 42%, black 44%, transparent 64%)',
                                    WebkitMaskImage:
                                        'radial-gradient(circle at 50% 42%, black 44%, transparent 64%)',
                                }}
                            />
                        </div>
                    )}

                    <div className="planner-reading relative z-10">
                        {!build.className ? (
                            <>
                                {/* A fresh plan can start from a PoB import (opened as a
                                modal); an existing one is already past the class gate. */}
                                {pageMode === 'create' && (
                                    <div className="mb-8 flex justify-center">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setShowImport(true)}
                                        >
                                            Import from Path of Building
                                        </Button>
                                    </div>
                                )}
                                <BuildClassGallery onPick={pickBuild} />
                                {showImport && (
                                    <Modal
                                        onClose={() => setShowImport(false)}
                                        className="max-w-2xl"
                                    >
                                        <PobImportPanel
                                            onImported={(
                                                importedTitle,
                                                imported,
                                                importedDropped,
                                            ) => {
                                                loadImported(
                                                    importedTitle,
                                                    imported,
                                                    importedDropped,
                                                );
                                                setShowImport(false);
                                            }}
                                            onClose={() => setShowImport(false)}
                                        />
                                    </Modal>
                                )}
                            </>
                        ) : (
                            <>
                                {/* What a PoB import couldn't map, per item - stays until dismissed. */}
                                <DroppedModsNotice
                                    dropped={droppedMods}
                                    onDismiss={() => setDroppedMods({})}
                                />
                                {/* Phase switcher pinned above the whole planner. */}
                                <PhaseTabs
                                    mode={mode}
                                    tabs={tabs}
                                    activeTabId={activeTabId}
                                    editable
                                    onSelectTab={setActiveTabId}
                                    onSetMode={setMode}
                                    onAddTab={addTab}
                                    onRenameTab={renameTab}
                                    onMoveTab={handleMoveTab}
                                    onRemoveTab={handleRemoveTab}
                                />

                                {/* Name + description region. */}
                                <div className="relative mb-4 overflow-hidden">
                                    <div className="relative">
                                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                            <div className="flex-1 pt-4">
                                                <Eyebrow>Build planner</Eyebrow>
                                                {/* The locked class/ascendancy - change it via New build. */}
                                                <p className="pl-text-sm mt-1">
                                                    <span className="font-semibold text-[var(--pl-text-strong)]">
                                                        {build.className}
                                                    </span>
                                                    {selectedAscName && (
                                                        <>
                                                            <span className="px-1.5 text-[var(--pl-faint)]">
                                                                ·
                                                            </span>
                                                            <span className="text-[var(--pl-accent-lit)]">
                                                                {
                                                                    selectedAscName
                                                                }
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                                <TextInput
                                                    ref={nameInputRef}
                                                    value={data.title}
                                                    onChange={(event) => {
                                                        const title =
                                                            event.target.value;
                                                        setPlanData(
                                                            (previous) => ({
                                                                ...previous,
                                                                title,
                                                            }),
                                                        );
                                                    }}
                                                    placeholder="Name your build…"
                                                    maxLength={120}
                                                    className="pl-text-xl mt-10 !border-0 !border-b !bg-transparent !px-4 pb-1 font-semibold text-[var(--pl-heading)] placeholder:text-[var(--pl-muted)] sm:placeholder:text-[var(--pl-faint)]"
                                                />
                                                {formErrors.title && (
                                                    <p className="pl-text-sm mt-1 text-[var(--pl-danger-lit)]">
                                                        {formErrors.title}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="danger"
                                                    onClick={clearBuild}
                                                >
                                                    New build
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    variant="primary"
                                                    disabled={form.processing}
                                                >
                                                    {form.processing
                                                        ? 'Saving…'
                                                        : pageMode === 'create'
                                                          ? 'Save & get link'
                                                          : 'Save changes'}
                                                </Button>
                                            </div>
                                        </div>

                                        {publicUrl && (
                                            <SharePanel
                                                publicUrl={publicUrl}
                                                editUrl={editUrl}
                                                editToken={editToken}
                                                slug={slug}
                                            />
                                        )}

                                        {formErrors.tabs && (
                                            <p className="pl-text-sm mb-4 rounded-[var(--pl-radius)] border border-[var(--pl-danger)] bg-[var(--pl-danger-soft)] px-3 py-2 text-[var(--pl-danger-lit)]">
                                                {formErrors.tabs}
                                            </p>
                                        )}

                                        {/* Build-level description - one per build, above the
                                        phase tabs. Required: every guide states what it is. */}
                                        <Panel
                                            title="Build description"
                                            collapsible
                                        >
                                            <MarkdownField
                                                value={data.description}
                                                onChange={(description) =>
                                                    setPlanData((previous) => ({
                                                        ...previous,
                                                        description,
                                                    }))
                                                }
                                                placeholder="What is this build about? Playstyle, goals, who it's for…"
                                                rows={4}
                                                maxLength={20000}
                                            />
                                            {formErrors.description && (
                                                <p className="pl-text-sm mt-2 text-[var(--pl-danger-lit)]">
                                                    {formErrors.description}
                                                </p>
                                            )}
                                        </Panel>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    {SECTION_KEYS.map((key) => (
                                        <SectionEditor
                                            key={`${sectionKey}:${key}`}
                                            sectionKey={key}
                                            group={currentSection[key]}
                                            onChange={(group) =>
                                                setGroup(key, group)
                                            }
                                            action={
                                                key === 'gems' ? (
                                                    <GemsViewToggle
                                                        value={gemsView}
                                                        onChange={setGemsView}
                                                    />
                                                ) : undefined
                                            }
                                            visual={
                                                key === 'tree' ? (
                                                    <PlannerTree
                                                        editable
                                                        build={
                                                            data.build as PlanBuild
                                                        }
                                                        allocation={
                                                            currentSection.tree
                                                                .allocation ??
                                                            emptyAllocation()
                                                        }
                                                        onAllocationChange={
                                                            handleTreeAllocationChange
                                                        }
                                                        onFullscreenChange={
                                                            setTreeFullscreen
                                                        }
                                                    />
                                                ) : key === 'items' ? (
                                                    <PlannerEquipment
                                                        editable
                                                        slots={
                                                            currentSection.items
                                                                .slots ?? {}
                                                        }
                                                        onChange={(slots) =>
                                                            setGroup('items', {
                                                                ...currentSection.items,
                                                                slots,
                                                            })
                                                        }
                                                    />
                                                ) : key === 'gems' ? (
                                                    <PlannerGems
                                                        editable
                                                        view={gemsView}
                                                        groups={
                                                            currentSection.gems
                                                                .groups ?? []
                                                        }
                                                        onChange={(groups) =>
                                                            setGroup('gems', {
                                                                ...currentSection.gems,
                                                                groups,
                                                            })
                                                        }
                                                    />
                                                ) : undefined
                                            }
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {!treeFullscreen && <ScrollToTop />}
                    </div>
                </ModsProvider>
            </ReferencesProvider>
        </form>
    );
}
