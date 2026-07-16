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
    NodeKind,
    NodeOption,
    Scene,
    TreeGraph,
    TreeNode,
    WeaponSet,
    WeaponSetAllocation,
    WorldRect,
} from '@poe2-toolkit/tree-core';
import { DEFAULT_TREE_COLORS, TreeView } from '@poe2-toolkit/tree-react';
import type {
    AllocationPreview,
    HighlightStyle,
    TreeViewControls,
} from '@poe2-toolkit/tree-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useCoarsePointer } from '@/hooks/use-coarse-pointer';
import { centreSprites } from '@/lib/classCatalog';
import { useTreeData } from '@/lib/useTreeData';
import {
    ClearGlyph,
    Divider,
    ICON_SEGMENT,
    INPUT_FONT,
    PANEL_FONT,
    PLAQUE,
} from './chrome';
import { notifyPointLimit } from './pointLimitToast';
import { ASCENDANCY_POINT_LIMIT, ascendancyPointsUsed } from './treePoints';
import { previewFor } from './treePreview';

/** Caps used only until the GGPK-derived budget extract loads. */
const FALLBACK_POINT_LIMIT = 123;
const FALLBACK_WEAPON_SET_LIMIT = 24;

/**
 * Weapon-set accent colours, derived from the renderer's default set tints (set
 * I red, set II green, the in-game colours) so the counters and paint toggle
 * always read as the same sets drawn on the tree. The basic tree keeps the gold
 * chrome.
 */
const hexColor = (color: number): string =>
    `#${color.toString(16).padStart(6, '0')}`;

const WEAPON_SET_HEX: Record<WeaponSet, string> = {
    1: hexColor(DEFAULT_TREE_COLORS.weaponSet[1]),
    2: hexColor(DEFAULT_TREE_COLORS.weaponSet[2]),
};

/**
 * Gauge tint for the ascendancy budget - a violet, distinct from the gold basic
 * gauge and the weapon-set red/green, so the four budgets read as one family.
 */
const ASCENDANCY_HEX = '#b48ce0';

/** Stable empty map, so a build with no weapon sets keeps one reference. */
const EMPTY_WEAPON_SETS: Record<number, WeaponSet> = {};

/** The deployed tree snapshot every edited allocation is stamped against. */
const TREE_VERSION = '0_5';

/** Shortest node-search query that highlights matches (avoids matching everything). */
const SEARCH_MIN = 2;

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
 * and the scene all come from `@poe2-toolkit/tree-core`.
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

    // Windowed: the props. Fullscreen: the props with any override merged over.
    const chrome: TreeChromeFlags = fullscreen
        ? { showSearch, showPointsCounter, ...fullscreenOverride }
        : { showSearch, showPointsCounter };

    // The fullscreen stage is a fixed overlay pinned just below the sticky site header,
    // so the top nav stays visible and reachable instead of being covered. Measure the
    // live header (its height changes by breakpoint) while fullscreen.
    const [headerHeight, setHeaderHeight] = useState(0);
    useEffect(() => {
        if (!fullscreen) {
            return;
        }

        // Lock body scroll so the page behind doesn't leave a scrollbar over nothing.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const header = document.querySelector('header');
        const measure = () =>
            setHeaderHeight(header ? header.getBoundingClientRect().height : 0);

        measure();

        const observer = header ? new ResizeObserver(measure) : null;

        if (header) {
            observer?.observe(header);
        }

        window.addEventListener('resize', measure);

        return () => {
            document.body.style.overflow = previousOverflow;
            observer?.disconnect();
            window.removeEventListener('resize', measure);
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

    // Per-mode main-tree usage. Ascendancy nodes draw from a separate pool and
    // never count here. Set I nodes are basic nodes tagged for a weapon set, so
    // they count toward both the basic budget and the set I cap; set II is the
    // additive divergence with its own cap.
    const pointUsage = (
        allocated: Iterable<number>,
        sets: Record<number, WeaponSet>,
    ): { basic: number; setI: number; setII: number } => {
        let basic = 0;
        let setI = 0;
        let setII = 0;

        for (const id of allocated) {
            if (data?.nodes[id]?.ascendancyName) {
                continue;
            }

            const mode = sets[id];

            if (mode === 1) {
                setI++;
            } else if (mode === 2) {
                setII++;
            } else {
                basic++;
            }
        }

        return { basic: basic + setI, setI, setII };
    };

    // The first budget a step would overspend (so the toast names it), comparing
    // before/after counts - a build already over a cap stays editable.
    const exceededCap = (
        before: { basic: number; setI: number; setII: number },
        after: { basic: number; setI: number; setII: number },
    ): { label: string; limit: number } | null => {
        if (before.basic <= pointLimit && after.basic > pointLimit) {
            return { label: 'Passive point', limit: pointLimit };
        }

        if (before.setI <= weaponSetLimit && after.setI > weaponSetLimit) {
            return { label: 'Weapon set I', limit: weaponSetLimit };
        }

        if (before.setII <= weaponSetLimit && after.setII > weaponSetLimit) {
            return { label: 'Weapon set II', limit: weaponSetLimit };
        }

        return null;
    };

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

        const cap = exceededCap(
            pointUsage(current.allocated, current.weaponSets),
            pointUsage(next.allocated, next.weaponSets),
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

            const cap = exceededCap(
                pointUsage(current.allocated, current.weaponSets),
                pointUsage(next.allocated, next.weaponSets),
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
    // Only the active ascendancy's nodes are on screen (relocated into the hub);
    // every other ascendancy's nodes sit at far-flung raw positions, so matching
    // them would ring empty spots on the tree's edges. Keep the active one - the
    // renderer highlights it at its relocated position.
    const searchMatches = useMemo<Set<number>>(() => {
        const query = search.trim().toLowerCase();

        if (query.length < SEARCH_MIN || !data) {
            return new Set();
        }

        const hits = new Set<number>();

        for (const [skill, node] of Object.entries(data.nodes)) {
            if (node.ascendancyName && node.ascendancyName !== ascendancy) {
                continue;
            }

            // An allocated "any attribute" node carries no Str/Dex/Int text on
            // the base node - the pick lives in allocation. Resolve the chosen
            // option so searching "intelligence" rings the node it was set to.
            const chosen = chosenAttributeOption(node, allocation ?? undefined);

            const matches =
                node.name?.toLowerCase().includes(query) ||
                node.stats?.some((stat) =>
                    stat.toLowerCase().includes(query),
                ) ||
                chosen?.name.toLowerCase().includes(query) ||
                chosen?.stats?.some((stat) =>
                    stat.toLowerCase().includes(query),
                );

            if (matches) {
                hits.add(Number(skill));
            }
        }

        return hits;
    }, [search, data, ascendancy, allocation]);

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
    const usage = pointUsage(allocation?.allocated ?? [], weaponSets);
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
                style={fullscreen ? { top: headerHeight } : undefined}
                className={
                    fullscreen
                        ? // Pinned below the site header (top nav stays visible) and above
                          // the planner's sticky phase bar (z-90) so it doesn't overlap.
                          'fixed right-0 bottom-0 left-0 z-[120] overflow-hidden bg-black'
                        : `relative overflow-hidden rounded-sm border border-[#1c1a22] bg-[#0a0a10] ${
                              editable ? 'h-full' : 'aspect-[4/3]'
                          }`
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
                        onNodeClick={editable ? handleNodeClick : undefined}
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

                {/* Touch detail: pinned above the tapped node. The attribute
                    picker (an interactive tooltip) takes over for its node, so
                    suppress this one while a picker is open. */}
                {editable &&
                    coarsePointer &&
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

/* ===================================================================== chrome */

/**
 * Node-name search: the same bronze {@link PLAQUE} shell as the rest of the
 * rail. Typing highlights matches live on the tree; Enter frames them. The match
 * count reads out at the end.
 */
function SearchBox({
    value,
    onValue,
    onSubmit,
    matchCount,
}: {
    value: string;
    onValue: (value: string) => void;
    onSubmit: () => void;
    matchCount: number;
}) {
    return (
        <div className="relative min-w-[12rem] flex-1 md:w-64 md:flex-none">
            <div
                className={`flex h-10 items-center gap-1 pr-1 pl-3.5 transition-colors focus-within:border-[#a9842f] ${PLAQUE}`}
            >
                <SearchGlyph />
                <input
                    type="text"
                    name="node-search"
                    value={value}
                    onChange={(event) => onValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            onSubmit();
                        }
                    }}
                    placeholder="Search name or stat…"
                    aria-label="Search passive nodes by name or stat"
                    spellCheck={false}
                    // Same split as the PoB import field: typed text in plain Fontin
                    // at a larger size, the placeholder in the bar's SmallCaps face.
                    style={INPUT_FONT}
                    className="h-full min-w-0 flex-1 bg-transparent text-base font-medium tracking-wide text-[#f5ecd8] outline-none placeholder:[font-family:'Fontin_SmallCaps',_'Cinzel',_serif] placeholder:text-sm placeholder:text-[#8a7850]"
                />
                {value !== '' && (
                    <button
                        type="button"
                        onClick={() => onValue('')}
                        title="Clear search"
                        aria-label="Clear search"
                        className="grid size-5 shrink-0 place-items-center rounded-full text-[#8a7850] transition-colors hover:bg-[#f0c869]/10 hover:text-[#ecc878] focus-visible:text-[#ecc878] focus-visible:outline-none"
                    >
                        <ClearGlyph />
                    </button>
                )}
                <Divider />
                <span className="shrink-0 px-2 text-base font-medium tracking-wide text-[#f5ecd8] tabular-nums">
                    {matchCount}
                    <span className="text-[#ecc878]">
                        {matchCount === 1 ? ' hit' : ' hits'}
                    </span>
                </span>
            </div>
        </div>
    );
}

/**
 * The point budgets in one compact plaque, doubling as the paint toggle: each
 * segment is a budget (Basic, Weapon set I/II) showing its `used/limit`, coloured
 * in its mode tint. While editing the segments are radio buttons picking the
 * paint target (the active one glows filled); read-only they just read out.
 * Ascendancy, which isn't a paint mode, is appended as a static count. No ring
 * gauges - the numbers carry the read-out, so the bar fits a phone.
 */
function BudgetBar({
    mode,
    onMode,
    basic,
    basicLimit,
    weaponSets,
    ascendancy,
}: {
    mode: AllocMode;
    /** Paint-mode setter while editing; null read-only (segments aren't buttons). */
    onMode: ((mode: AllocMode) => void) | null;
    basic: number;
    basicLimit: number;
    /** Per-set usage + shared cap, or null to hide the weapon-set segments. */
    weaponSets: { setI: number; setII: number; limit: number } | null;
    /** Ascendancy usage + cap, or null to hide it. */
    ascendancy: { used: number; limit: number } | null;
}) {
    const segments: {
        value: AllocMode;
        label: string;
        color: string;
        used: number;
        limit: number;
    }[] = [
        {
            value: 0,
            label: 'Basic',
            color: '#ecc878',
            used: basic,
            limit: basicLimit,
        },
    ];

    if (weaponSets) {
        segments.push(
            {
                value: 1,
                label: 'I',
                color: WEAPON_SET_HEX[1],
                used: weaponSets.setI,
                limit: weaponSets.limit,
            },
            {
                value: 2,
                label: 'II',
                color: WEAPON_SET_HEX[2],
                used: weaponSets.setII,
                limit: weaponSets.limit,
            },
        );
    }

    const segmentLabel = (
        label: string,
        used: number,
        limit: number,
        active: boolean,
    ): React.JSX.Element => (
        <span className="flex items-center gap-1.5">
            <span>{label}</span>
            <span
                className="text-[13px] tabular-nums"
                style={{
                    color: active
                        ? '#0b0805'
                        : used > limit
                          ? '#e0a04f'
                          : '#f5ecd8',
                }}
            >
                {used}/{limit}
            </span>
        </span>
    );

    return (
        <div
            className={`flex h-10 items-center gap-2 ${PLAQUE}`}
            role={onMode ? 'radiogroup' : undefined}
            aria-label="Point budgets"
        >
            <span className="pl-2 text-[11px] font-semibold tracking-[0.14em] text-[#8a7850] uppercase">
                Points
            </span>
            <Divider />
            <div className="flex items-center gap-0.5">
                {segments.map((segment) => {
                    const active = mode === segment.value;
                    const className =
                        'flex h-7 items-center rounded-full px-2.5 text-sm font-semibold tracking-wide transition-colors';
                    const style: CSSProperties = active
                        ? { color: '#0b0805', background: segment.color }
                        : { color: segment.color };

                    return onMode ? (
                        <button
                            key={segment.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onMode(segment.value)}
                            className={className}
                            style={style}
                        >
                            {segmentLabel(
                                segment.label,
                                segment.used,
                                segment.limit,
                                active,
                            )}
                        </button>
                    ) : (
                        <span
                            key={segment.value}
                            className={className}
                            style={style}
                        >
                            {segmentLabel(
                                segment.label,
                                segment.used,
                                segment.limit,
                                active,
                            )}
                        </span>
                    );
                })}

                {ascendancy && (
                    <>
                        <Divider />
                        <span
                            className="flex h-7 items-center rounded-full px-2.5 text-sm font-semibold tracking-wide"
                            style={{ color: ASCENDANCY_HEX }}
                            aria-label="Ascendancy points"
                        >
                            {segmentLabel(
                                'Asc',
                                ascendancy.used,
                                ascendancy.limit,
                                false,
                            )}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Wipe-the-whole-build button, in the same bronze plaque as the rest of the
 * canvas chrome. Clears every allocated node - basic, both weapon sets and the
 * ascendancy - in one click.
 */
function ClearBuildButton({ onClear }: { onClear: () => void }) {
    return (
        <div className={`flex h-10 items-center ${PLAQUE}`}>
            <button
                type="button"
                onClick={onClear}
                title="Clear the whole build"
                aria-label="Clear the whole build"
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-[0.14em] text-[#b39a64] uppercase transition-colors hover:bg-[#eb6060]/15 hover:text-[#eb6060] focus-visible:bg-[#eb6060]/15 focus-visible:text-[#eb6060] focus-visible:outline-none"
            >
                <ClearGlyph />
                Clear
            </button>
        </div>
    );
}

/**
 * Zoom + fullscreen as one engraved bar. View-only, both modes. Renders just the
 * plaque; the caller positions it.
 */
function ZoomBar({
    onZoomIn,
    onZoomOut,
    fullscreen,
    onToggleFullscreen,
}: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    fullscreen: boolean;
    onToggleFullscreen: () => void;
}) {
    return (
        <div className={`flex h-10 items-center gap-0.5 ${PLAQUE}`}>
            <button
                type="button"
                onClick={onZoomIn}
                title="Zoom in"
                aria-label="Zoom in"
                className={`${ICON_SEGMENT} text-lg leading-none`}
            >
                +
            </button>
            <button
                type="button"
                onClick={onZoomOut}
                title="Zoom out"
                aria-label="Zoom out"
                className={`${ICON_SEGMENT} text-lg leading-none`}
            >
                −
            </button>
            <Divider />
            <button
                type="button"
                onClick={onToggleFullscreen}
                title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                className={ICON_SEGMENT}
            >
                <FullscreenIcon active={fullscreen} />
            </button>
        </div>
    );
}

/** Magnifier glyph for the node search. */
function SearchGlyph() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-[#8a7850]"
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
        </svg>
    );
}

/** Sliders glyph for the mobile "Tools" toggle. */
function ToolsGlyph() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
            aria-hidden="true"
        >
            <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="8" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
        </svg>
    );
}

/* ================================================================== tooltip */

const TOOLTIP_FRAME_URL: string | null = null;
const TOOLTIP_FRAME_SLICE = 28;

const ATTRIBUTE_PICKS: {
    key: 'any' | 'str' | 'dex' | 'int';
    label: string;
    color: string;
}[] = [
    { key: 'any', label: 'Any', color: '#caa45c' },
    { key: 'str', label: 'Strength', color: '#e06a6a' },
    { key: 'dex', label: 'Dexterity', color: '#79c46a' },
    { key: 'int', label: 'Intelligence', color: '#6aa6e0' },
];

const RARITY_TEXT: Record<string, string> = {
    NORMAL: '#d6d6d6',
    MAGIC: '#8888ff',
    RARE: '#e8e84a',
    UNIQUE: '#cf7a3a',
};

const TOOLTIP_TITLE: Record<NodeKind, string> = {
    keystone: '#e7a23a',
    notable: '#efe8d6',
    mastery: '#b9a9ff',
    jewel: '#efe8d6',
    attribute: '#efe8d6',
    normal: '#efe8d6',
    classStart: '#e9c98a',
    ascendancyStart: '#e9c98a',
    ascendancyNormal: '#c5cdd9',
    ascendancyNotable: '#e9c98a',
};

/**
 * Node tooltip styled like the in-game / Path of Building tooltip: an ornate
 * bronze frame, a kind-coloured title and the granted modifiers in passive-blue.
 * Follows the cursor, or pins above a node when a picker is anchored to it.
 */
function NodeTooltip({
    node,
    kind,
    pointer,
    stage,
    allocated,
    attributeOption,
    jewel,
    anchor,
    pick,
}: {
    node: TreeNode;
    kind: NodeKind;
    pointer: { x: number; y: number };
    stage: HTMLElement | null;
    allocated: boolean;
    attributeOption?: NodeOption;
    jewel?: JewelInfo;
    anchor?: { x: number; y: number };
    pick?: {
        value?: 'str' | 'dex' | 'int';
        onPick: (attribute: 'any' | 'str' | 'dex' | 'int') => void;
        onClear: () => void;
    };
}) {
    const [hoverPick, setHoverPick] = useState<string | null>(null);
    const tipRef = useRef<HTMLDivElement>(null);
    const [tip, setTip] = useState({ w: 0, h: 0 });
    const width = stage?.clientWidth ?? 0;
    const height = stage?.clientHeight ?? 0;

    const stats = attributeOption ? attributeOption.stats : node.stats;

    // Measure the rendered tooltip so its position can be clamped inside the
    // stage - without the real size, an anchored or edge-of-screen tooltip would
    // overflow the viewport (the whole point on a phone).
    useLayoutEffect(() => {
        const element = tipRef.current;

        if (!element) {
            return;
        }

        const next = { w: element.offsetWidth, h: element.offsetHeight };

        // Only commit a real size change - the effect re-runs on every cursor move,
        // and a same-size update would spin an extra render each time.
        setTip((prev) =>
            prev.w === next.w && prev.h === next.h ? prev : next,
        );
    }, [node, anchor, pointer.x, pointer.y, width, height, pick, jewel]);

    // Place the tooltip and clamp it to the stage. Anchored (touch / picker): pin
    // above the node, flipping below when there's no room. Cursor (desktop hover):
    // offset from the pointer, flipping side/edge before it would spill out.
    const margin = 8;
    const gap = 14;
    const offset = 18;
    const clampPos = (value: number, size: number, extent: number): number =>
        Math.max(
            margin,
            Math.min(value, Math.max(margin, extent - size - margin)),
        );

    let left: number;
    let top: number;

    if (anchor) {
        left = clampPos(anchor.x - tip.w / 2, tip.w, width);
        const above = anchor.y - gap - tip.h;
        top = clampPos(above >= margin ? above : anchor.y + gap, tip.h, height);
    } else {
        left =
            pointer.x + offset + tip.w > width - margin
                ? pointer.x - offset - tip.w
                : pointer.x + offset;
        top =
            pointer.y + offset + tip.h > height - margin
                ? pointer.y - offset - tip.h
                : pointer.y + offset;
        left = clampPos(left, tip.w, width);
        top = clampPos(top, tip.h, height);
    }

    // Hidden until measured, so it never flashes at an unclamped position.
    const style: CSSProperties = { left, top, opacity: tip.w ? 1 : 0 };

    const body = (
        <>
            <div
                className="px-4 pt-2.5 pb-1.5 text-center text-xl sm:px-5 sm:text-2xl"
                style={{
                    color: TOOLTIP_TITLE[kind],
                    fontFamily: "'Fontin SmallCaps', 'Cinzel', serif",
                }}
            >
                {node.name || `#${node.skill}`}
            </div>

            <div
                className="mx-4 mb-2 h-px"
                style={{
                    background:
                        'linear-gradient(90deg,transparent,rgba(201,160,90,0.55),transparent)',
                }}
            />

            {stats.length > 0 && (
                <ul className="space-y-1 px-4 pb-2.5 text-left text-sm leading-snug sm:px-5 sm:text-lg">
                    {stats.map((stat, index) => (
                        <li key={index} className="text-[#aeb6ff]">
                            {highlightNumbers(stat)}
                        </li>
                    ))}
                </ul>
            )}

            {node.flavourText && (
                <div className="px-4 pb-2.5 text-left text-sm text-[#9a8b6e] italic sm:px-5 sm:text-lg">
                    {node.flavourText}
                </div>
            )}

            {jewel && (
                <div className="px-5 pb-3 text-center">
                    {jewel.icon && (
                        <img
                            src={jewel.icon}
                            alt=""
                            className="mx-auto mb-1.5 h-10 w-10 object-contain"
                            onError={(event) => {
                                event.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                    <div
                        className="text-xl"
                        style={{
                            color: RARITY_TEXT[jewel.rarity] ?? '#d6d6d6',
                        }}
                    >
                        {jewel.name || jewel.baseType}
                    </div>
                    {jewel.name &&
                        jewel.baseType &&
                        jewel.name !== jewel.baseType && (
                            <div className="text-sm text-[#9a8b6e]">
                                {jewel.baseType}
                            </div>
                        )}
                    {jewel.mods.length > 0 && (
                        <ul className="mt-1.5 space-y-1 text-left text-lg leading-snug">
                            {jewel.mods.map((mod, index) => (
                                <li key={index} className="text-[#aeb6ff]">
                                    {highlightNumbers(mod)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {pick ? (
                <div
                    className="px-4 pt-0.5 pb-3"
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="pointer-events-auto flex flex-col gap-1.5">
                        {ATTRIBUTE_PICKS.map((option) => {
                            const active = (pick.value ?? 'any') === option.key;
                            const hover = hoverPick === option.key;

                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => pick.onPick(option.key)}
                                    onPointerEnter={() =>
                                        setHoverPick(option.key)
                                    }
                                    onPointerLeave={() =>
                                        setHoverPick((current) =>
                                            current === option.key
                                                ? null
                                                : current,
                                        )
                                    }
                                    className="w-full rounded-[3px] border px-2.5 py-1 text-center text-sm font-semibold tracking-[0.06em] transition-all"
                                    style={{
                                        color: active
                                            ? '#0a0a0a'
                                            : option.color,
                                        backgroundColor: active
                                            ? option.color
                                            : hover
                                              ? `${option.color}26`
                                              : 'transparent',
                                        borderColor:
                                            active || hover
                                                ? option.color
                                                : `${option.color}66`,
                                        boxShadow: active
                                            ? `0 0 10px ${option.color}77`
                                            : 'none',
                                    }}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={pick.onClear}
                            className="mt-0.5 w-full rounded-[3px] border border-[#46454d] px-2.5 py-1 text-center text-xs font-semibold tracking-[0.16em] text-[#a7acb8] uppercase transition-all hover:bg-[#a7acb8] hover:text-[#0a0a0a]"
                        >
                            Clear path
                        </button>
                    </div>
                </div>
            ) : (
                allocated && (
                    <div className="px-5 pb-2.5 text-center text-xs tracking-[0.16em] text-[#6f9f8f] uppercase">
                        Allocated
                    </div>
                )
            )}
        </>
    );

    // Width capped to the viewport so a wide node never spills off a phone; left/
    // top are computed (and clamped) above, so no translate is needed.
    const base =
        'pointer-events-none absolute z-20 w-max max-w-[min(92vw,42rem)] shadow-xl shadow-black/70 transition-opacity duration-75';
    const font: CSSProperties = { fontFamily: "'Fontin', serif" };

    if (TOOLTIP_FRAME_URL) {
        return (
            <div
                ref={tipRef}
                className={base}
                style={{
                    ...style,
                    ...font,
                    borderStyle: 'solid',
                    borderWidth: TOOLTIP_FRAME_SLICE,
                    borderImage: `url(${TOOLTIP_FRAME_URL}) ${TOOLTIP_FRAME_SLICE} fill stretch`,
                }}
            >
                {body}
            </div>
        );
    }

    return (
        <div ref={tipRef} className={base} style={{ ...style, ...font }}>
            <div
                className="relative rounded-[4px] p-[2.5px]"
                style={{
                    background:
                        'linear-gradient(150deg,#9a7c42 0%,#4a3c20 35%,#241d10 70%,#5a4827 100%)',
                    boxShadow:
                        '0 0 0 1px rgba(0,0,0,0.75), 0 10px 26px rgba(0,0,0,0.6)',
                }}
            >
                <div
                    className="rounded-[2.5px] bg-gradient-to-b from-[#16130d] to-[#070605] pt-0.5"
                    style={{
                        boxShadow:
                            'inset 0 0 0 1px rgba(201,160,90,0.22), inset 0 1px 10px rgba(0,0,0,0.7)',
                    }}
                >
                    {body}
                </div>
                <TooltipCorner className="absolute -top-px -left-px" />
                <TooltipCorner className="absolute -top-px -right-px rotate-90" />
                <TooltipCorner className="absolute -right-px -bottom-px rotate-180" />
                <TooltipCorner className="absolute -bottom-px -left-px -rotate-90" />
            </div>
        </div>
    );
}

function TooltipCorner({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M1.5 15 V5 Q1.5 1.5 5 1.5 H15"
                stroke="#caa45c"
                strokeWidth="1.4"
                strokeLinecap="round"
            />
            <path
                d="M4 8 L8 4"
                stroke="#e6c87e"
                strokeWidth="1"
                strokeLinecap="round"
            />
            <path d="M3.5 3.5 l1.6 1.6 -1.6 1.6 -1.6 -1.6 z" fill="#eccd84" />
        </svg>
    );
}

function highlightNumbers(text: string) {
    return text.split(/(\d+(?:\.\d+)?)/g).map((part, index) =>
        /^\d/.test(part) ? (
            <span key={index} className="font-medium text-[#d4d9ff]">
                {part}
            </span>
        ) : (
            <span key={index}>{part}</span>
        ),
    );
}

function FullscreenIcon({ active }: { active: boolean }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {active ? (
                <path d="M9 3v3a3 3 0 0 1-3 3H3m18 0h-3a3 3 0 0 1-3-3V3M3 15h3a3 3 0 0 1 3 3v3m6 0v-3a3 3 0 0 1 3-3h3" />
            ) : (
                <path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4m12-6v4a2 2 0 0 1-2 2h-4" />
            )}
        </svg>
    );
}
