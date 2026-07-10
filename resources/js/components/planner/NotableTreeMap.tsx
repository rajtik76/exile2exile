import { buildScene } from '@poe2-toolkit/tree-core';
import type { Point, Scene, TreeData } from '@poe2-toolkit/tree-core';
import { memo, useMemo } from 'react';
import { useTreeData } from '@/lib/useTreeData';

/**
 * A wireframe mini-map of the passive tree, drawn as plain SVG from the same GGPK
 * data the full canvas uses - no sprites, node art, class/ascendancy centres or
 * mastery graphics, just the shape of the tree (connections + node dots) with one
 * notable highlighted. Used inside the reference tooltip to show a notable's place
 * on the tree at a glance.
 */

/** Accent for the highlighted node: keystones gold, notables teal (matching the tooltip titles). */
const NOTABLE_ACCENT = '#7fd4c9';
const KEYSTONE_ACCENT = '#e7a23a';

/** Wireframe ink for the tree shape - a muted blue-grey that reads on the dark tooltip. */
const WIRE = '#8a93a8';

/** Fixed pixel size of the mini-map window. */
const MAP_WIDTH = 380;
const MAP_HEIGHT = 240;

/** Node kinds drawn on the main tree - the structural ones. Centres, masteries and jewels are dropped. */
const DRAWN_KINDS = new Set(['normal', 'notable', 'keystone', 'attribute']);

/**
 * `buildScene` with no allocation is pure geometry derived from the tree data, so
 * cache one scene per data object (the data is itself module-memoised) rather than
 * rebuilding it for every tooltip that opens.
 */
const sceneCache = new WeakMap<TreeData, Scene>();

function unallocatedScene(data: TreeData): Scene {
    let scene = sceneCache.get(data);

    if (!scene) {
        scene = buildScene(data);
        sceneCache.set(data, scene);
    }

    return scene;
}

/** The distilled geometry a mini-map draws: main-tree dots, edges and the target. */
export interface NotableMapModel {
    dots: { skill: number; x: number; y: number; big: boolean }[];
    edges: { a: Point; b: Point }[];
    target: { x: number; y: number; keystone: boolean } | null;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
    /** Frame zoom fraction override (ascendancy discs fit the whole disc). */
    zoom?: number;
}

/**
 * Resolve a notable by its display name (the id an IconResolver notable reference
 * carries) to the numeric skill id, matching only notable/keystone nodes so a plain
 * node that happens to share a name can't win.
 */
export function findNotableSkill(data: TreeData, name: string): number | null {
    for (const [id, node] of Object.entries(data.nodes)) {
        if (node.name === name && (node.isNotable || node.isKeystone)) {
            return Number(id);
        }
    }

    return null;
}

/**
 * Build the mini-map geometry from a scene: keep the structural main-tree nodes and
 * the edges between them, and locate the highlighted notable. Pure so it can be
 * tested without a live scene.
 */
export function notableMapModel(
    scene: Scene,
    targetSkill: number | null,
): NotableMapModel {
    const drawn = new Set<number>();

    for (const node of scene.nodes) {
        if (node.ascendancy || !DRAWN_KINDS.has(node.kind)) {
            continue;
        }

        drawn.add(node.skill);
    }

    const dots = scene.nodes
        .filter((node) => drawn.has(node.skill))
        .map((node) => ({
            skill: node.skill,
            x: node.x,
            y: node.y,
            big: node.kind === 'notable' || node.kind === 'keystone',
        }));

    const edges = scene.connections
        .filter((edge) => drawn.has(edge.from) && drawn.has(edge.to))
        .map((edge) => ({ a: edge.a, b: edge.b }));

    const placed =
        targetSkill !== null
            ? scene.nodes.find((node) => node.skill === targetSkill)
            : undefined;
    const target = placed
        ? { x: placed.x, y: placed.y, keystone: placed.kind === 'keystone' }
        : null;

    return { dots, edges, target, bounds: scene.mainBounds };
}

/**
 * Build the mini-map for an ascendancy notable: its own small disc, drawn straight
 * from the raw tree data (`node.x/y` + `connections`) rather than the main scene -
 * the disc sits far off the main tree in world space, so the main scene / mainBounds
 * can't frame it. Bounds are the disc's own bbox and the whole disc is fit.
 */
export function ascendancyMapModel(
    data: TreeData,
    targetSkill: number,
): NotableMapModel {
    const focus = data.nodes[targetSkill];
    const ascendancy = focus?.ascendancyName;

    const members = new Set<number>();
    const dots: NotableMapModel['dots'] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [id, node] of Object.entries(data.nodes)) {
        if (node.ascendancyName !== ascendancy || node.isMastery) {
            continue;
        }

        const skill = Number(id);
        members.add(skill);
        dots.push({
            skill,
            x: node.x,
            y: node.y,
            big: Boolean(node.isNotable || node.isKeystone),
        });
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    }

    const edges: NotableMapModel['edges'] = [];

    for (const [id, node] of Object.entries(data.nodes)) {
        if (node.ascendancyName !== ascendancy) {
            continue;
        }

        for (const connection of node.connections) {
            // One edge per pair (the connection is mirrored on both nodes).
            if (members.has(connection.id) && connection.id > Number(id)) {
                const other = data.nodes[connection.id];
                edges.push({
                    a: { x: node.x, y: node.y },
                    b: { x: other.x, y: other.y },
                });
            }
        }
    }

    return {
        dots,
        edges,
        target: focus ? { x: focus.x, y: focus.y, keystone: false } : null,
        bounds: { minX, minY, maxX, maxY },
        // Fit the whole disc with a little margin rather than zooming into it.
        zoom: 1.15,
    };
}

/**
 * Frame a viewBox zoomed in on the target node: a fixed-size window (a fraction of
 * the tree's span) at the tooltip's aspect ratio, centred on the target but clamped
 * to the tree bounds - so a node on the edge of the tree isn't centred (which would
 * leave half the window empty); the window slides to stay full of tree instead.
 * Falls back to the tree centre when there's no target. Smaller `zoom` = tighter.
 */
export function frameViewBox(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    target: { x: number; y: number } | null,
    ratio = 2.4,
    zoom = 0.32,
): { x: number; y: number; w: number; h: number } {
    const centreX = (bounds.minX + bounds.maxX) / 2;
    const centreY = (bounds.minY + bounds.maxY) / 2;
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

    const focusX = target?.x ?? centreX;
    const focusY = target?.y ?? centreY;

    const height = span * zoom;
    const width = height * ratio;

    // Slide the window to keep the target in view without spilling past the tree; if
    // the window is wider/taller than the tree on an axis, centre that axis instead.
    const clampAxis = (
        focus: number,
        size: number,
        min: number,
        max: number,
    ): number => {
        if (size >= max - min) {
            return (min + max) / 2 - size / 2;
        }

        return Math.max(min, Math.min(focus - size / 2, max - size));
    };

    return {
        x: clampAxis(focusX, width, bounds.minX, bounds.maxX),
        y: clampAxis(focusY, height, bounds.minY, bounds.maxY),
        w: width,
        h: height,
    };
}

function NotableTreeMap({ name }: { name: string }) {
    const { data } = useTreeData();

    const model = useMemo<NotableMapModel | null>(() => {
        if (!data) {
            return null;
        }

        const skill = findNotableSkill(data, name);

        // Ascendancy notables live on their own disc off the main tree - draw that
        // disc instead of the (unreachable) main-tree frame.
        if (skill !== null && data.nodes[skill]?.ascendancyName) {
            return ascendancyMapModel(data, skill);
        }

        return notableMapModel(unallocatedScene(data), skill);
    }, [data, name]);

    if (!model) {
        return (
            <div
                className="animate-pulse rounded-[var(--pl-radius)] bg-[var(--pl-panel-2)]"
                style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
            />
        );
    }

    const { dots, edges, target, bounds } = model;
    // Fixed map window; frame ratio matches MAP_WIDTH / MAP_HEIGHT.
    const frame = frameViewBox(
        bounds,
        target,
        MAP_WIDTH / MAP_HEIGHT,
        model.zoom,
    );
    const viewBox = `${frame.x} ${frame.y} ${frame.w} ${frame.h}`;

    // Dot radii sized to the framed viewBox (not the whole tree) so they stay a
    // steady on-screen size whatever the zoom. Strokes stay crisp via non-scaling.
    const dotR = frame.w / 150;
    const accent = target?.keystone ? KEYSTONE_ACCENT : NOTABLE_ACCENT;

    // All edges in a single path element - far cheaper than one node per line.
    const edgePath = edges
        .map((edge) => `M${edge.a.x} ${edge.a.y}L${edge.b.x} ${edge.b.y}`)
        .join('');

    return (
        <svg
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            className="block max-w-full"
            style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
            role="img"
            aria-label={`${name} location on the passive tree`}
        >
            <path
                d={edgePath}
                fill="none"
                stroke={WIRE}
                strokeOpacity={0.55}
                strokeWidth={1}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />

            {dots.map((dot) => (
                <circle
                    key={dot.skill}
                    cx={dot.x}
                    cy={dot.y}
                    r={dot.big ? dotR * 0.5 : dotR * 0.18}
                    fill={WIRE}
                    fillOpacity={dot.big ? 0.8 : 0.5}
                />
            ))}

            {target && (
                <>
                    {/* Pulsing ring: expands and fades on a loop to draw the eye. */}
                    <circle
                        cx={target.x}
                        cy={target.y}
                        fill="none"
                        stroke={accent}
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                    >
                        <animate
                            attributeName="r"
                            values={`${dotR * 2.4};${dotR * 6}`}
                            dur="1.5s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="opacity"
                            values="0.7;0"
                            dur="1.5s"
                            repeatCount="indefinite"
                        />
                    </circle>
                    <circle
                        cx={target.x}
                        cy={target.y}
                        r={dotR * 2.2}
                        fill={accent}
                    />
                </>
            )}
        </svg>
    );
}

// Memoised: the tooltip re-renders on every cursor move, but the map only depends
// on the notable name, so a stable name skips the whole SVG re-render.
export default memo(NotableTreeMap);
