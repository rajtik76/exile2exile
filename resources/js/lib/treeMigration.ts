import {
    ascendancyNodeOwner,
    ascendancyStartNode,
    buildAscendancyGraph,
    buildTreeGraph,
    reachable,
} from '@poe2-toolkit/tree-core';
import type {
    AscendancyDef,
    TreeData,
    TreeNode,
} from '@poe2-toolkit/tree-core';
import { resolveClassId } from '@/lib/classCatalog';
import type { TreeSnapshot } from '@/types/tree';

export interface DroppedNode {
    id: number;
    name: string;
}

export interface ChangedNode {
    id: number;
    name: string;
    previousName: string;
    before: string[];
    after: string[];
}

export interface TreeMigrationReport {
    classMissing: boolean;
    ascendancyMissing: boolean;
    unchanged: number;
    changed: ChangedNode[];
    removed: DroppedNode[];
    disconnected: DroppedNode[];
}

export interface TreeMigration {
    build: TreeSnapshot;
    report: TreeMigrationReport;
}

/**
 * Nodes match by GGG skill id, which survives patches. Connectivity ignores weapon
 * sets on purpose: the editor's per-set rule rejects states it creates itself (a
 * forced-basic jewel socket reached only through set nodes).
 */
export function migrateTree(
    previous: TreeData,
    current: TreeData,
    build: TreeSnapshot,
): TreeMigration {
    const report: TreeMigrationReport = {
        classMissing: false,
        ascendancyMissing: false,
        unchanged: 0,
        changed: [],
        removed: [],
        disconnected: [],
    };

    const classId = resolveClassId(current, build.className);
    const startNode = current.classes.find(
        (cls) => cls.id === classId,
    )?.startNode;

    if (classId === null || startNode === undefined) {
        report.classMissing = true;
        report.removed = build.allocated.map((id) =>
            dropped(previous.nodes[id], id),
        );

        return { build: withAllocated(build, [], null), report };
    }

    const ascendancy = findClassAscendancy(current, classId, build.ascendId);
    report.ascendancyMissing = build.ascendId !== null && ascendancy === null;
    const owner =
        ascendancy === null
            ? null
            : ascendancyNodeOwner(current, ascendancy.id);

    const present: number[] = [];

    for (const id of build.allocated) {
        const node = current.nodes[id];

        if (
            node === undefined ||
            (node.ascendancyName !== undefined && node.ascendancyName !== owner)
        ) {
            report.removed.push(dropped(previous.nodes[id] ?? node, id));

            continue;
        }

        present.push(id);
    }

    const connected = connectedNodes(current, startNode, present, ascendancy);

    const kept: number[] = [];

    for (const id of present) {
        const node = current.nodes[id];
        const before = previous.nodes[id];

        if (!connected.has(id)) {
            report.disconnected.push(dropped(before ?? node, id));

            continue;
        }

        kept.push(id);

        if (before !== undefined && differs(before, node)) {
            report.changed.push({
                id,
                name: node.name,
                previousName: before.name,
                before: before.stats,
                after: node.stats,
            });
        } else {
            report.unchanged++;
        }
    }

    return {
        build: withAllocated(
            build,
            kept,
            build.ascendId && ascendancy ? build.ascendId : null,
        ),
        report,
    };
}

function findClassAscendancy(
    data: TreeData,
    classId: number,
    ascendId: string | null,
): AscendancyDef | null {
    if (ascendId === null) {
        return null;
    }

    return (
        data.classes
            .find((cls) => cls.id === classId)
            ?.ascendancies.find(
                (asc) => asc.id === ascendId || asc.internalId === ascendId,
            ) ?? null
    );
}

function connectedNodes(
    data: TreeData,
    startNode: number,
    allocated: number[],
    ascendancy: AscendancyDef | null,
): Set<number> {
    const onDisc = (id: number) => data.nodes[id]?.ascendancyName !== undefined;
    const connected = reachable(
        buildTreeGraph(data, startNode),
        [startNode],
        new Set(allocated.filter((id) => !onDisc(id))),
    );

    if (allocated.includes(startNode)) {
        connected.add(startNode);
    }

    const discStart =
        ascendancy === null
            ? undefined
            : ascendancyStartNode(data, ascendancy.id);

    if (ascendancy === null || discStart === undefined) {
        return connected;
    }

    const disc = new Set(allocated.filter(onDisc));

    for (const id of reachable(
        buildAscendancyGraph(data, ascendancy.id),
        [discStart],
        disc,
    )) {
        connected.add(id);
    }

    if (disc.has(discStart)) {
        connected.add(discStart);
    }

    return connected;
}

function differs(before: TreeNode, after: TreeNode): boolean {
    return (
        before.name !== after.name ||
        before.stats.length !== after.stats.length ||
        before.stats.some((line, index) => line !== after.stats[index])
    );
}

function dropped(node: TreeNode | undefined, id: number): DroppedNode {
    return { id, name: node?.name ?? `Passive #${id}` };
}

function withAllocated(
    build: TreeSnapshot,
    allocated: number[],
    ascendId: string | null,
): TreeSnapshot {
    const keep = new Set(allocated);
    const only = <T>(record: Record<number, T>): Record<number, T> =>
        Object.fromEntries(
            Object.entries(record).filter(([id]) => keep.has(Number(id))),
        ) as Record<number, T>;

    return {
        className: build.className,
        ascendId,
        allocated,
        attributeChoices: only(build.attributeChoices),
        weaponSets: only(build.weaponSets),
        jewels: only(build.jewels),
        treeVersion: null,
    };
}
