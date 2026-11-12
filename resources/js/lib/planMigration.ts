import type { TreeData } from '@poe2-toolkit/tree-core';
import { emptyAllocation } from '@/lib/planner';
import { migrateTree } from '@/lib/treeMigration';
import type { ChangedNode, DroppedNode } from '@/lib/treeMigration';
import { SINGLE_KEY } from '@/types/planner';
import type { PlanData, PlanSection } from '@/types/planner';

export type Phased<T> = T & { phases: string[] };

export interface PlanTreeReport {
    classMissing: boolean;
    ascendancyMissing: boolean;
    unchanged: number;
    changed: Phased<ChangedNode>[];
    removed: Phased<DroppedNode>[];
    disconnected: Phased<DroppedNode>[];
}

/** The hidden set of the other mode is converted too, but never reported. */
function phaseOf(plan: PlanData, key: string): string | null {
    if (plan.mode === 'single') {
        return key === SINGLE_KEY ? 'Whole build' : null;
    }

    return plan.tabs.find((tab) => tab.id === key)?.label ?? null;
}

function record<T extends { id: number }>(
    into: Map<number, Phased<T>>,
    nodes: T[],
    phase: string | null,
): void {
    if (phase === null) {
        return;
    }

    for (const node of nodes) {
        const entry = into.get(node.id) ?? { ...node, phases: [] };
        entry.phases.push(phase);
        into.set(node.id, entry);
    }
}

export function migratePlanTrees(
    previous: TreeData,
    current: TreeData,
    plan: PlanData,
): { plan: PlanData; report: PlanTreeReport } {
    const className = plan.build.className;
    const report: PlanTreeReport = {
        classMissing: false,
        ascendancyMissing: false,
        unchanged: 0,
        changed: [],
        removed: [],
        disconnected: [],
    };

    if (!className) {
        return { plan, report };
    }

    const kept = new Set<number>();
    const changed = new Map<number, Phased<ChangedNode>>();
    const removed = new Map<number, Phased<DroppedNode>>();
    const disconnected = new Map<number, Phased<DroppedNode>>();
    const sections: Record<string, PlanSection> = {};

    for (const [key, section] of Object.entries(plan.sections)) {
        const phase = phaseOf(plan, key);
        const allocation = section.tree.allocation ?? emptyAllocation();
        const migration = migrateTree(previous, current, {
            className,
            ascendId: plan.build.ascendId,
            ...allocation,
        });

        report.classMissing ||= migration.report.classMissing;
        report.ascendancyMissing ||= migration.report.ascendancyMissing;
        record(changed, migration.report.changed, phase);
        record(removed, migration.report.removed, phase);
        record(disconnected, migration.report.disconnected, phase);

        const sectionKept = new Set(migration.build.allocated);

        if (phase !== null) {
            sectionKept.forEach((id) => kept.add(id));
        }

        sections[key] = {
            ...section,
            tree: {
                ...section.tree,
                allocation: {
                    allocated: migration.build.allocated,
                    attributeChoices: migration.build.attributeChoices,
                    weaponSets: migration.build.weaponSets,
                    jewels: migration.build.jewels,
                    treeVersion: migration.build.treeVersion,
                },
                notablePriority: section.tree.notablePriority?.filter((id) =>
                    sectionKept.has(id),
                ),
            },
        };
    }

    const reported = new Set([
        ...changed.keys(),
        ...removed.keys(),
        ...disconnected.keys(),
    ]);
    report.unchanged = [...kept].filter((id) => !reported.has(id)).length;
    report.changed = [...changed.values()];
    report.removed = [...removed.values()];
    report.disconnected = [...disconnected.values()];

    return {
        plan: {
            ...plan,
            build: {
                className: report.classMissing ? null : className,
                ascendId:
                    report.classMissing || report.ascendancyMissing
                        ? null
                        : plan.build.ascendId,
            },
            sections,
        },
        report,
    };
}
