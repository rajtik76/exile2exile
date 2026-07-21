import {
    allocatedBoundsWithCentre,
    ascendancyStartNode,
    buildAscendancyGraph,
    buildScene,
    buildTreeGraph,
    chosenAttributeOption,
    classOverrideNode,
    toggleAllocationInMode,
    toggleAscendancyAllocation,
} from '@poe2-toolkit/tree-core';
import type {
    AllocMode,
    BuildAllocation,
    JewelInfo,
    Scene,
    TreeGraph,
    WeaponSet,
    WeaponSetAllocation,
    WorldRect,
} from '@poe2-toolkit/tree-core';
import { TreeView } from '@poe2-toolkit/tree-react';
import type {
    AllocationPreview,
    HighlightStyle,
    TreeViewControls,
} from '@poe2-toolkit/tree-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCoarsePointer } from '@/hooks/use-coarse-pointer';
import { centreSprites } from '@/lib/classCatalog';
import { useTreeData } from '@/lib/useTreeData';
import { PANEL_FONT, PLAQUE } from './chrome';
import { searchTreeNodes } from './nodeSearch';
import { NodeTooltip } from './nodeTooltip';
import { notifyPointLimit } from './pointLimitToast';
import { exceededCap, pointUsage } from './treeBudgets';
import type { PointUsage } from './treeBudgets';
import {
    BudgetBar,
    ClearBuildButton,
    SearchBox,
    ToolsGlyph,
    ZoomBar,
} from './treeControls';
import { ASCENDANCY_POINT_LIMIT, ascendancyPointsUsed } from './treePoints';
import { previewFor } from './treePreview';

/** Caps used only until the GGPK-derived budget extract loads. */
const FALLBACK_POINT_LIMIT = 123;
const FALLBACK_WEAPON_SET_LIMIT = 24;

/** Stable empty map, so a build with no weapon sets keeps one reference. */
const EMPTY_WEAPON_SETS: Record<number, WeaponSet> = {};

/** The deployed tree snapshot every edited allocation is stamped against. */
const TREE_VERSION = '0_5';

/**
 * Gold search-highlight rings with a stronger pulse than the renderer default -
 * a wider, faster, higher-contrast throb so name-search hits pop on the busy tree.
 */
const SEARCH_HIGHLIGHT_STYLE: HighlightStyle = {
    glowColor: 0xc9a24a,
    coreColor: 0xffe9a8,
    glowWidth: 8,
    coreWidth: 3,
    radius: 2,
    pulseMs: 200,
    pulseGrow: 4,
    glowAlpha: [0.2, 0.85],
    coreAlpha: [0.6, 1],
};

/**
 * Visibility of the canvas-bound chrome the caller toggles per surface: the node
 * search and the point-count gauge. Both mandatory props, so every caller states
 * its intent; {@link onBeforeFullscreen} can override them while fullscreen.
 */
export interface TreeChromeFlags {
    showSearch: boolean;
    showPointsCounter: boolean;
}

/** Chrome and lifecycle props common to both modes of the canvas. */
interface SharedTreeProps {
    /** Live GGG class id (the caller resolves an import's class name to it). */
    classId: number | null;
    /** Active ascendancy name, or null. */
    ascendancy: string | null;
    /** Show the node search box. */
    showSearch: boolean;
    /** Show the point-count gauge. */
    showPointsCounter: boolean;
    /**
     * Called right before the tree enters fullscreen, with the current chrome
     * flags. Return a partial set to override for the duration of fullscreen
     * (e.g. reveal search that the windowed view hides); omit or return
     * nothing to keep the windowed flags. Reverts on exit.
     */
    onBeforeFullscreen?: (
        current: TreeChromeFlags,
    ) => Partial<TreeChromeFlags> | void;
    /** Fired whenever the canvas enters or leaves fullscreen. */
    onFullscreenChange?: (fullscreen: boolean) => void;
    /** Bump to frame the current allocation (the page does this after an import). */
    frameToken?: number;
    className?: string;
}

/** Draw one allocation, and - when `editable` - edit it. The default mode. */
interface PlanTreeProps extends SharedTreeProps {
    mode?: 'plan';
    editable: boolean;
    /** The allocation to draw; null is an unallocated tree. */
    allocation?: BuildAllocation | null;
    /** Editable only: a node edit produced this next allocation. */
    onAllocationChange?: (next: BuildAllocation) => void;
    /** Editable only: wipe the whole build (every basic, weapon-set and ascendancy node). */
    onClearBuild?: () => void;
}

/**
 * The passive tree canvas, one component for every place it appears: it draws a
 * single allocation and, when `editable`, edits it.
 *
 * The class / ascendancy pickers and the Path of Building importer live with the
 * page now ({@link PlannerControls}); this component keeps only the chrome bound
 * to the canvas: search, the point gauge and the zoom rail. Geometry, pathing
 * and the scene all come from `@poe2-toolkit/tree-core`; the chrome bars live in
 * {@link ./treeControls}, the tooltip in {@link ./nodeTooltip} and the budget /
 * search maths in {@link ./treeBudgets} / {@link ./nodeSearch}.
 */
export default function PassiveTreeView(props: PlanTreeProps) {
    const {
        classId,
        ascendancy,
        showSearch,
        showPointsCounter,
        onBeforeFullscreen,
        onFullscreenChange,
        frameToken,
        className = '',
    } = props;

    const editable = props.editable;
    const allocation = props.allocation ?? null;
    const onAllocationChange = props.onAllocationChange;
    const onClearBuild = props.onClearBuild;

    const { data, resources, budget, error } = useTreeData();

    // The GGPK-derived basic-tree cap; falls back only until the extract loads
    // (handlers early-return while `data` is still null anyway).
    const pointLimit = budget?.basic ?? FALLBACK_POINT_LIMIT;

    const [hovered, setHovered] = useState<number | null>(null);
    // Touch surfaces have no hover, so the cursor-following tooltip never fires
    // there (the renderer only reports a hover on pointer move). On a coarse
    // pointer the node detail is driven from taps via {@link tapDetail} instead,
    // and the hover tooltip is turned off so it can't get stuck open.
    const coarsePointer = useCoarsePointer();
    // The node a tap last revealed on touch: its id and on-canvas centre, used to
    // pin a read-only detail tooltip above it (the hover path never runs there).
    const [tapDetail, setTapDetail] = useState<{
        skill: number;
        screen: { x: number; y: number };
    } | null>(null);
    // Allocation paint mode: 0 basic, 1 weapon set I, 2 weapon set II. Clicks
    // allocate into this mode (only meaningful while editing).
    const [paintMode, setPaintMode] = useState<AllocMode>(0);
    const [picker, setPicker] = useState<{
        skill: number;
        screen: { x: number; y: number };
    } | null>(null);
    // Mobile only: whether the folded controls panel (search, paint, clear) is
    // open. Inline on desktop, so this flag is ignored there.
    const [toolsOpen, setToolsOpen] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    // Chrome-flag overrides active only while fullscreen, sourced from
    // `onBeforeFullscreen` at the moment of entering.
    const [fullscreenOverride, setFullscreenOverride] = useState<
        Partial<TreeChromeFlags>
    >({});

    const changeFullscreen = (next: boolean) => {
        if (next) {
            setFullscreenOverride(
                onBeforeFullscreen?.({ showSearch, showPointsCounter }) ?? {},
            );
        } else {
            setFullscreenOverride({});
        }

        setFullscreen(next);
        onFullscreenChange?.(next);
    };

    // If this component unmounts (or remounts under a fresh `key`, e.g. the
    // page switching phase tabs) while still fullscreen, nothing else ever
    // tells the caller fullscreen ended - a caller hiding its own UI in
    // response (see `PlannerTree`'s doc) would stay stuck in that state
    // forever. Refs, not `fullscreen`/`onFullscreenChange` themselves, so the
    // unmount effect below only ever runs its cleanup once, reading whatever
    // was current at that moment rather than a stale closure - kept in sync
    // via their own effects (a ref write belongs in an effect, not render).
    const fullscreenRef = useRef(fullscreen);
    const onFullscreenChangeRef = useRef(onFullscreenChange);

    useEffect(() => {
        fullscreenRef.current = fullscreen;
        onFullscreenChangeRef.current = onFullscreenChange;
    }, [fullscreen, onFullscreenChange]);

    useEffect(() => {
        return () => {
            if (fullscreenRef.current) {
                onFullscreenChangeRef.current?.(false);
            }
        };
    }, []);

    // Windowed: the props. Fullscreen: the props with any override merged over.
    const chrome: TreeChromeFlags = fullscreen
        ? { showSearch, showPointsCounter, ...fullscreenOverride }
        : { showSearch, showPointsCounter };

    // The fullscreen stage is a fixed overlay covering the whole viewport - the site
    // header isn't sticky, so it may already be scrolled out of view by the time
    // fullscreen opens; leaving room for it would either reserve a gap for nothing or
    // sit at the wrong offset. Body scroll is locked so the page behind doesn't leave
    // a scrollbar over nothing.
    useEffect(() => {
        if (!fullscreen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [fullscreen]);

    const lastClickRef = useRef<{ skill: number; time: number } | null>(null);
    const pendingAttrRef = useRef<{
        skill: number;
        screen: { x: number; y: number };
        wasActive: boolean;
    } | null>(null);
    const clickTimerRef = useRef<number | undefined>(undefined);
    const treeControls = useRef<TreeViewControls>(null);
    // Touch "armed node": the skill a first tap selected, awaiting a confirming
    // second tap. Held in a ref, not state, so a pointer-down (which clears the
    // visible tooltip/preview via onInteractStart) cannot wipe the arm - the
    // confirming tap fires on the following pointer-up and must still see it.
    const armedRef = useRef<number | null>(null);
    // Set by onNodeClick (which fires in the canvas pointer-up, before this
    // wrapper's bubbling pointer-up). Lets the wrapper tell a press that landed on
    // a node from one that resolved off any node (empty tap or pan) - the latter
    // fully resets the touch arm, as if nothing was ever tapped.
    const nodeTappedRef = useRef(false);

    // Debug aid: overlay each node's skill id to cross-check tree geometry/edges.
    // Off by default; enable by setting VITE_DEBUG_TREE_IDS=true (build-time env).
    const debugIds = import.meta.env.VITE_DEBUG_TREE_IDS === 'true';

    // The stage element + cursor position drive the tooltip's placement.
    const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number }>({
        x: 0,
        y: 0,
    });

    // Always pass the active class so per-class node overrides (icons) apply even
    // before anything is allocated; `allocated` defaults to none.
    const scene = useMemo<Scene | null>(
        () =>
            data
                ? buildScene(data, {
                      allocation: {
                          allocated: [],
                          ...allocation,
                          ...(classId !== null ? { classId } : {}),
                      },
                  })
                : null,
        [data, allocation, classId],
    );

    // Walkable graphs for click-to-allocate - only built when editing. Scoped to
    // the active class's start node so a path cannot bridge two gateways by
    // stepping through another class's start (tree-core >= 0.4.2).
    const activeStartNode =
        classId !== null
            ? data?.classes.find((cls) => cls.id === classId)?.startNode
            : undefined;
    const graph = useMemo<TreeGraph | null>(
        () => (editable && data ? buildTreeGraph(data, activeStartNode) : null),
        [editable, data, activeStartNode],
    );
    const ascGraph = useMemo<TreeGraph | null>(
        () =>
            editable && data && ascendancy
                ? buildAscendancyGraph(data, ascendancy)
                : null,
        [editable, data, ascendancy],
    );

    /* ----------------------------------------------------- editing actions */

    const startNodeId = () =>
        scene?.centre.classes.find((cls) => cls.classId === classId)?.startNode;

    // Weapon-set assignment of the current build (node id -> 1|2); basic otherwise.
    const weaponSets = allocation?.weaponSets ?? EMPTY_WEAPON_SETS;

    const weaponSetLimit = budget?.weaponSet ?? FALLBACK_WEAPON_SET_LIMIT;

    // Ascendancy nodes draw from a separate pool and never count toward the
    // main-tree budgets (see {@link pointUsage}).
    const usageOf = (
        allocated: Iterable<number>,
        sets: Record<number, WeaponSet>,
    ): PointUsage =>
        pointUsage(allocated, sets, (id) =>
            Boolean(data?.nodes[id]?.ascendancyName),
        );

    // The first budget a step would overspend, against the live caps.
    const capExceeded = (before: PointUsage, after: PointUsage) =>
        exceededCap(before, after, {
            basic: pointLimit,
            weaponSet: weaponSetLimit,
        });

    const commitAllocation = (
        allocated: number[],
        sets: Record<number, WeaponSet>,
        rawChoices?: Record<number, 'str' | 'dex' | 'int'>,
    ) => {
        if (classId === null) {
            return;
        }

        const set = new Set(allocated);
        const choices: Record<number, 'str' | 'dex' | 'int'> = {};

        for (const [id, attr] of Object.entries(rawChoices ?? {})) {
            if (set.has(Number(id))) {
                choices[Number(id)] = attr;
            }
        }

        const jewels: Record<number, JewelInfo> = {};

        for (const [id, jewel] of Object.entries(allocation?.jewels ?? {})) {
            if (set.has(Number(id))) {
                jewels[Number(id)] = jewel;
            }
        }

        const keptSets: Record<number, WeaponSet> = {};

        for (const [id, mode] of Object.entries(sets)) {
            if (set.has(Number(id))) {
                keptSets[Number(id)] = mode;
            }
        }

        onAllocationChange?.({
            classId,
            ascendId: ascendancy ?? undefined,
            allocated,
            treeVersion: TREE_VERSION,
            ...(Object.keys(keptSets).length > 0
                ? { weaponSets: keptSets }
                : {}),
            ...(Object.keys(choices).length > 0
                ? { attributeChoices: choices }
                : {}),
            ...(Object.keys(jewels).length > 0 ? { jewels } : {}),
        });
    };

    const toggleNode = (skill: number) => {
        if (!data) {
            return;
        }

        const ascName = data.nodes[skill]?.ascendancyName;

        if (ascName) {
            const current = new Set(allocation?.allocated ?? []);
            const next = toggleAscendancyAllocation(
                data,
                ascName,
                current,
                skill,
            );

            // One click can path through several ascendancy nodes at once, so compare
            // before/after counts and block the step if it would exceed the 8-point
            // cap. A build already over the cap stays editable - only growth is stopped -
            // mirroring the basic and weapon-set budget guards in {@link exceededCap}.
            const before = ascendancyPointsUsed(data, current, ascName);
            const after = ascendancyPointsUsed(data, next, ascName);

            if (
                before <= ASCENDANCY_POINT_LIMIT &&
                after > ASCENDANCY_POINT_LIMIT
            ) {
                notifyPointLimit('Ascendancy point', ASCENDANCY_POINT_LIMIT);

                return;
            }

            commitAllocation(next, weaponSets, allocation?.attributeChoices);

            return;
        }

        const startNode = startNodeId();

        if (!graph || startNode === undefined) {
            return;
        }

        const current: WeaponSetAllocation = {
            allocated: allocation?.allocated ?? [],
            weaponSets,
        };
        const next = toggleAllocationInMode(
            data,
            startNode,
            current,
            skill,
            paintMode,
            graph,
        );

        const cap = capExceeded(
            usageOf(current.allocated, current.weaponSets),
            usageOf(next.allocated, next.weaponSets),
        );

        if (cap) {
            notifyPointLimit(cap.label, cap.limit);

            return;
        }

        commitAllocation(
            next.allocated,
            next.weaponSets,
            allocation?.attributeChoices,
        );
    };

    const applyAttribute = (
        skill: number,
        attribute: 'any' | 'str' | 'dex' | 'int',
    ) => {
        const startNode = startNodeId();

        if (!data || !graph || startNode === undefined) {
            return;
        }

        let allocated = allocation?.allocated ?? [];
        let sets = weaponSets;

        if (!allocated.includes(skill)) {
            const current: WeaponSetAllocation = { allocated, weaponSets };
            const next = toggleAllocationInMode(
                data,
                startNode,
                current,
                skill,
                paintMode,
                graph,
            );

            const cap = capExceeded(
                usageOf(current.allocated, current.weaponSets),
                usageOf(next.allocated, next.weaponSets),
            );

            if (cap) {
                notifyPointLimit(cap.label, cap.limit);

                return;
            }

            allocated = next.allocated;
            sets = next.weaponSets;
        }

        const choices = { ...(allocation?.attributeChoices ?? {}) };

        if (attribute === 'any') {
            delete choices[skill];
        } else {
            choices[skill] = attribute;
        }

        commitAllocation(allocated, sets, choices);
    };

    const handleNodeClick = (
        skill: number,
        screen: { x: number; y: number },
    ) => {
        // Mark that this press hit a node, so the wrapper's pointer-up (fired next,
        // by bubbling) knows not to treat it as a tap into empty space.
        nodeTappedRef.current = true;

        const node = data?.nodes[skill];

        // Touch has no hover, so a first tap only *inspects*: it pins the detail
        // tooltip and shows the path preview (driven by `hovered`) without editing
        // the build. A second tap on the same node confirms the edit; tapping a
        // different node re-arms the preview to it. This keeps "see what a node
        // does" separate from "plan the route to it" on a touch screen.
        if (coarsePointer) {
            if (armedRef.current !== skill) {
                armedRef.current = skill;
                setTapDetail({ skill, screen });
                setHovered(skill);
                setPicker(null);

                return;
            }

            // Second tap on the armed node: disarm (clear preview + detail), then
            // commit - so the next tap on this node arms afresh instead of editing
            // it blind.
            armedRef.current = null;
            setHovered(null);
            setTapDetail(null);

            // An already-set attribute node reopens its chooser; everything else
            // toggles (allocating or removing the path).
            if (node?.isAttribute && allocation?.allocated.includes(skill)) {
                setPicker({ skill, screen });

                return;
            }

            toggleNode(skill);

            return;
        }

        if (!node?.isAttribute) {
            const now = Date.now();

            if (
                lastClickRef.current &&
                lastClickRef.current.skill === skill &&
                now - lastClickRef.current.time < 320
            ) {
                return;
            }

            lastClickRef.current = { skill, time: now };
            setPicker(null);
            toggleNode(skill);

            return;
        }

        const pending = pendingAttrRef.current;

        if (pending && pending.skill === skill) {
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
            }

            pendingAttrRef.current = null;
            setPicker(null);
            toggleNode(skill);

            return;
        }

        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
        }

        const wasActive = allocation?.allocated.includes(skill) ?? false;
        pendingAttrRef.current = { skill, screen, wasActive };
        clickTimerRef.current = window.setTimeout(() => {
            const single = pendingAttrRef.current;
            pendingAttrRef.current = null;

            if (!single) {
                return;
            }

            if (single.wasActive) {
                setPicker({ skill: single.skill, screen: single.screen });
            } else {
                setPicker(null);
                toggleNode(single.skill);
            }
        }, 240);
    };

    /**
     * Read-only touch: a tap only ever inspects, never edits, so it skips
     * {@link handleNodeClick}'s whole arm/edit dance and just pins the detail
     * tooltip. Still marks {@link nodeTappedRef} - the stage wrapper's
     * pointer-up bubbles right after this and would otherwise treat the tap as
     * having hit empty space and clear what this just set.
     */
    const handleNodeInspect = (
        skill: number,
        screen: { x: number; y: number },
    ) => {
        nodeTappedRef.current = true;
        setTapDetail({ skill, screen });
        setHovered(skill);
    };

    /* ----------------------------------------------------------- framing */

    const [focus, setFocus] = useState<WorldRect | null>(null);

    // Frame the allocation once after an import: the page bumps `frameToken`.
    // `framedTokenRef` guards against re-framing on later edits - each token is
    // framed once, as soon as the scene for it is ready.
    const framedTokenRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!editable || frameToken === undefined || frameToken === 0) {
            return;
        }

        if (framedTokenRef.current === frameToken || !scene) {
            return;
        }

        framedTokenRef.current = frameToken;
        setFocus(allocatedBoundsWithCentre(scene));
    }, [frameToken, editable, scene]);

    /* ------------------------------------------------------------ search */

    const [search, setSearch] = useState('');

    // Skill ids whose node name OR stat description matches - drawn with a ring.
    const searchMatches = useMemo<Set<number>>(
        () => searchTreeNodes(data, search, ascendancy, allocation),
        [search, data, ascendancy, allocation],
    );

    // Frame every match (main tree only - ascendancy nodes sit off-canvas unless
    // their disc is open). Fired on submit so typing doesn't pan on every keypress.
    const focusSearchMatches = () => {
        if (!scene || searchMatches.size === 0) {
            return;
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let count = 0;

        for (const node of scene.nodes) {
            if (!searchMatches.has(node.skill) || node.ascendancy) {
                continue;
            }

            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
            count += 1;
        }

        if (count === 0) {
            return;
        }

        const pad = 220;
        setFocus({
            minX: minX - pad,
            minY: minY - pad,
            maxX: maxX + pad,
            maxY: maxY + pad,
        });
    };

    /* ----------------------------------------------------------- preview */

    const preview = useMemo<AllocationPreview | null>(() => {
        if (!editable || hovered === null || !data || !scene) {
            return null;
        }

        const node = data.nodes[hovered];

        if (node?.ascendancyName) {
            if (!ascGraph || node.ascendancyName !== ascendancy) {
                return null;
            }

            const ascStart = ascendancyStartNode(data, node.ascendancyName);

            if (ascStart === undefined || hovered === ascStart) {
                return null;
            }

            const ascAlloc = new Set(
                [...(allocation?.allocated ?? [])].filter((id) =>
                    ascGraph.has(id),
                ),
            );

            // Ascendancy nodes are always basic - no weapon-set rules apply.
            return previewFor(ascGraph, ascStart, ascAlloc, hovered, 0, {});
        }

        if (classId === null || !graph) {
            return null;
        }

        const startNode = scene.centre.classes.find(
            (cls) => cls.classId === classId,
        )?.startNode;

        if (startNode === undefined || hovered === startNode) {
            return null;
        }

        return previewFor(
            graph,
            startNode,
            new Set(allocation?.allocated ?? []),
            hovered,
            paintMode,
            weaponSets,
        );
    }, [
        editable,
        hovered,
        allocation,
        paintMode,
        weaponSets,
        classId,
        graph,
        ascGraph,
        ascendancy,
        data,
        scene,
    ]);

    /* --------------------------------------------------------- close keys */

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }

            setPicker((current) => {
                if (current) {
                    return null;
                }

                setFullscreen((on) => {
                    if (on) {
                        setFullscreenOverride({});
                        onFullscreenChange?.(false);
                    }

                    return false;
                });

                return current;
            });
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onFullscreenChange]);

    /* ------------------------------------------------------ derived view */

    // Apply the active class's per-node override (e.g. the Witch shows the
    // generic "Spell Damage" node as "Spell and Minion Damage").
    const hoveredNode =
        hovered !== null && data
            ? classOverrideNode(data, classId, data.nodes[hovered])
            : null;
    const hoveredKind =
        hovered !== null && scene
            ? scene.nodes.find((node) => node.skill === hovered)?.kind
            : null;
    const pickerNode = picker && data ? data.nodes[picker.skill] : null;
    const pickerKind =
        picker && scene
            ? scene.nodes.find((node) => node.skill === picker.skill)?.kind
            : null;
    // The tap-revealed node (touch), resolved exactly like the hovered one.
    const tapNode =
        tapDetail && data
            ? classOverrideNode(data, classId, data.nodes[tapDetail.skill])
            : null;
    const tapKind =
        tapDetail && scene
            ? scene.nodes.find((node) => node.skill === tapDetail.skill)?.kind
            : null;

    const zoomBar = (
        <ZoomBar
            onZoomIn={() => treeControls.current?.zoomIn()}
            onZoomOut={() => treeControls.current?.zoomOut()}
            fullscreen={fullscreen}
            onToggleFullscreen={() => changeFullscreen(!fullscreen)}
        />
    );

    // Search is offered in every mode (read-only compare included).
    const searchBox = (
        <SearchBox
            value={search}
            onValue={setSearch}
            onSubmit={focusSearchMatches}
            matchCount={searchMatches.size}
        />
    );

    // Live per-mode usage for the counters. Weapon-set counters show whenever a
    // set is in use, or always while editing so the budgets are visible up front.
    const usage = usageOf(allocation?.allocated ?? [], weaponSets);
    const showWeaponSets = editable || usage.setI > 0 || usage.setII > 0;

    // Ascendancy points spent in the active disc, gauged against the flat cap.
    // Shown whenever an ascendancy is active while editing, or - read-only - once
    // any of its points are spent.
    const ascendancyUsed =
        ascendancy && data
            ? ascendancyPointsUsed(
                  data,
                  allocation?.allocated ?? [],
                  ascendancy,
              )
            : 0;
    const showAscendancy =
        ascendancy !== null && (editable || ascendancyUsed > 0);

    // Budgets in one bar: the paint segments (Basic / I / II) double as the point
    // counters - each shows its `used/limit` - so there's a single compact control
    // instead of a toggle plus separate ring gauges. The active segment is the
    // paint target while editing; read-only just reads the numbers out. Ascendancy
    // is appended as a static count, since it isn't a paint mode.
    const budgetBar = chrome.showPointsCounter ? (
        <BudgetBar
            mode={paintMode}
            onMode={editable ? setPaintMode : null}
            basic={usage.basic}
            basicLimit={pointLimit}
            weaponSets={
                showWeaponSets
                    ? {
                          setI: usage.setI,
                          setII: usage.setII,
                          limit: weaponSetLimit,
                      }
                    : null
            }
            ascendancy={
                showAscendancy
                    ? { used: ascendancyUsed, limit: ASCENDANCY_POINT_LIMIT }
                    : null
            }
        />
    ) : null;

    // Wipe the whole build (basic, both weapon sets, ascendancy) - shown only
    // while editing once something is allocated.
    const clearBar =
        editable && onClearBuild && (allocation?.allocated.length ?? 0) > 0 ? (
            <ClearBuildButton onClear={onClearBuild} />
        ) : null;

    // Whether there's anything to fold behind the mobile "Tools" toggle. Clear
    // and zoom stay out of the fold, so only search and the budget bar count.
    const hasFoldedTools = chrome.showSearch || budgetBar !== null;

    return (
        <div className={className}>
            <div
                ref={setStageEl}
                onPointerMove={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setPointer({
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                    });
                }}
                onPointerUp={() => {
                    // Bubbles in after the canvas pointer-up (and its onNodeClick).
                    // A press that landed on no node - empty tap or pan - fully
                    // resets the touch arm, so the next tap on any node starts
                    // fresh with its tooltip instead of committing straight away.
                    if (coarsePointer && !nodeTappedRef.current) {
                        armedRef.current = null;
                        setTapDetail(null);
                        setHovered(null);
                    }

                    nodeTappedRef.current = false;
                }}
                className={
                    fullscreen
                        ? // Covers the whole viewport - above the planner's sticky
                          // phase bar (z-90) so it doesn't overlap.
                          'fixed inset-0 z-[120] overflow-hidden bg-black'
                        : // Every caller sizes its own box (a fixed height or a
                          // flex-1 panel) and hands it down via `className`, in
                          // both modes - read-only never wants a fixed aspect
                          // ratio shrinking the canvas inside a taller box.
                          'relative h-full overflow-hidden rounded-sm border border-[#1c1a22] bg-[#0a0a10]'
                }
            >
                {/* On-canvas controls. On mobile the search box and budget bar
                    fold into a dropdown panel behind the Tools toggle; clear-build
                    and the zoom rail stay out so they're always one tap away. On
                    desktop everything is an inline row. Chrome flags
                    ({@link onBeforeFullscreen}) gate search and the budgets. */}
                <div
                    className="absolute top-4 right-2 left-2 z-10 flex flex-wrap items-center justify-end gap-2"
                    style={PANEL_FONT}
                >
                    {clearBar}

                    {hasFoldedTools && (
                        <button
                            type="button"
                            onClick={() => setToolsOpen((open) => !open)}
                            aria-expanded={toolsOpen}
                            className={`flex h-10 items-center gap-1.5 px-3 text-[11px] font-semibold tracking-[0.14em] text-[#b39a64] uppercase transition-colors hover:text-[#ecc878] sm:hidden ${PLAQUE}`}
                        >
                            <ToolsGlyph />
                            Tools
                        </button>
                    )}

                    {/* Folded controls: a dropdown panel on mobile (shown only when
                        toolsOpen), an inline row on desktop. */}
                    <div
                        className={`${toolsOpen ? 'flex' : 'hidden'} absolute top-[calc(100%+0.5rem)] right-0 left-2 flex-col items-end gap-2 sm:static sm:left-auto sm:flex sm:flex-row sm:items-center`}
                    >
                        {chrome.showSearch && searchBox}
                        {budgetBar}
                    </div>

                    {zoomBar}
                </div>

                {scene ? (
                    <TreeView
                        scene={scene}
                        activeClassId={classId ?? undefined}
                        activeAscendancy={ascendancy ?? undefined}
                        centreSprites={
                            data
                                ? centreSprites(data, classId, ascendancy)
                                : undefined
                        }
                        resources={resources ?? undefined}
                        onNodeHover={setHovered}
                        onNodeClick={
                            editable
                                ? handleNodeClick
                                : coarsePointer
                                  ? handleNodeInspect
                                  : undefined
                        }
                        onInteractStart={
                            editable
                                ? () => {
                                      // A press (pan or any tap) dismisses the
                                      // visible tooltip + path preview. The arm
                                      // lives in `armedRef`, untouched here, so the
                                      // confirming second tap on the same node (its
                                      // pointer-up follows this) still commits.
                                      setPicker(null);
                                      setTapDetail(null);
                                      setHovered(null);
                                      setToolsOpen(false);
                                  }
                                : coarsePointer
                                  ? () => {
                                        setTapDetail(null);
                                        setHovered(null);
                                        setToolsOpen(false);
                                    }
                                  : undefined
                        }
                        preview={preview}
                        controls={treeControls}
                        wheelZoom={fullscreen}
                        focus={focus}
                        highlight={searchMatches}
                        highlightStyle={SEARCH_HIGHLIGHT_STYLE}
                        debugIds={debugIds}
                    />
                ) : (
                    <div className="grid h-full place-items-center">
                        <p className="text-sm text-[#8a7850] italic">
                            {error
                                ? `Failed to load tree: ${error}`
                                : 'Loading tree…'}
                        </p>
                    </div>
                )}

                {!coarsePointer &&
                    hoveredNode &&
                    hoveredKind &&
                    hovered !== picker?.skill && (
                        <NodeTooltip
                            node={hoveredNode}
                            kind={hoveredKind}
                            pointer={pointer}
                            stage={stageEl}
                            allocated={
                                allocation?.allocated.includes(
                                    hoveredNode.skill,
                                ) ?? false
                            }
                            attributeOption={chosenAttributeOption(
                                hoveredNode,
                                allocation ?? undefined,
                            )}
                            jewel={allocation?.jewels?.[hoveredNode.skill]}
                        />
                    )}

                {/* Touch detail: pinned above the tapped node. Works read-only
                    too - inspecting a node never requires editing. The attribute
                    picker (an interactive tooltip, editable only) takes over for
                    its node, so suppress this one while a picker is open. */}
                {coarsePointer &&
                    tapDetail &&
                    tapNode &&
                    tapKind &&
                    picker?.skill !== tapDetail.skill && (
                        <NodeTooltip
                            node={tapNode}
                            kind={tapKind}
                            pointer={pointer}
                            stage={stageEl}
                            allocated={
                                allocation?.allocated.includes(
                                    tapDetail.skill,
                                ) ?? false
                            }
                            anchor={tapDetail.screen}
                            attributeOption={chosenAttributeOption(
                                tapNode,
                                allocation ?? undefined,
                            )}
                            jewel={allocation?.jewels?.[tapDetail.skill]}
                        />
                    )}

                {editable && picker && pickerNode && pickerKind && (
                    <NodeTooltip
                        node={pickerNode}
                        kind={pickerKind}
                        pointer={pointer}
                        stage={stageEl}
                        allocated={
                            allocation?.allocated.includes(picker.skill) ??
                            false
                        }
                        anchor={picker.screen}
                        attributeOption={chosenAttributeOption(
                            pickerNode,
                            allocation ?? undefined,
                        )}
                        pick={{
                            value: allocation?.attributeChoices?.[picker.skill],
                            onPick: (attr) => {
                                applyAttribute(picker.skill, attr);
                                setPicker(null);
                            },
                            onClear: () => {
                                toggleNode(picker.skill);
                                setPicker(null);
                            },
                        }}
                    />
                )}
            </div>
        </div>
    );
}
