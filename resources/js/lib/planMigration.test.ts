import type { TreeData, TreeNode } from '@poe2-toolkit/tree-core';
import { describe, expect, it } from 'vitest';
import { migratePlanTrees } from '@/lib/planMigration';
import { emptyAllocation, emptySection } from '@/lib/planner';
import type { PlanData, PlanSection } from '@/types/planner';

function node(skill: number, links: number[] = []): TreeNode {
    return {
        skill,
        connections: links.map((id) => ({ id, orbit: 0 })),
        name: `Node ${skill}`,
        stats: [`+${skill}`],
        ...(skill === 1 ? { classesStart: ['Witch'] } : {}),
    } as unknown as TreeNode;
}

function tree(nodes: TreeNode[], className = 'Witch'): TreeData {
    return {
        nodes: Object.fromEntries(nodes.map((entry) => [entry.skill, entry])),
        classes: [{ name: className, id: 1, startNode: 1, ascendancies: [] }],
    } as unknown as TreeData;
}

function section(
    allocated: number[],
    notablePriority: number[] = [],
): PlanSection {
    const blank = emptySection();

    return {
        ...blank,
        tree: {
            ...blank.tree,
            allocation: { ...emptyAllocation(), allocated },
            notablePriority,
        },
    };
}

function plan(sections: Record<string, PlanSection>): PlanData {
    return {
        description: '',
        mode: 'phases',
        build: { className: 'Witch', ascendId: null },
        tabs: [
            { id: 'act-1', label: 'Act I', kind: 'base' },
            { id: 'act-2', label: 'Act II', kind: 'base' },
        ],
        sections,
    };
}

const old = tree([node(1, [2]), node(2, [3]), node(3)]);
const current = tree([node(1, [3]), node(3)]);

describe('migratePlanTrees', () => {
    it('maps every phase and reports each node once across phases', () => {
        const { plan: migrated, report } = migratePlanTrees(
            old,
            current,
            plan({
                'act-1': section([2], [2]),
                'act-2': section([2, 3], [2, 3]),
            }),
        );

        expect(migrated.sections['act-1'].tree.allocation?.allocated).toEqual(
            [],
        );
        expect(migrated.sections['act-2'].tree.allocation?.allocated).toEqual([
            3,
        ]);
        expect(migrated.sections['act-2'].tree.notablePriority).toEqual([3]);
        expect(report.removed).toEqual([
            { id: 2, name: 'Node 2', phases: ['Act I', 'Act II'] },
        ]);
        expect(report.unchanged).toBe(1);
    });

    it('never counts a node as unchanged while another phase dropped it', () => {
        const chain = tree([node(1, [3]), node(3, [2]), node(2)]);
        const { plan: migrated, report } = migratePlanTrees(
            tree([node(1, [2, 3]), node(2), node(3)]),
            chain,
            plan({ 'act-1': section([2]), 'act-2': section([3, 2]) }),
        );

        expect(migrated.sections['act-2'].tree.allocation?.allocated).toEqual([
            3, 2,
        ]);
        expect(report.disconnected).toEqual([
            { id: 2, name: 'Node 2', phases: ['Act I'] },
        ]);
        expect(report.unchanged).toBe(1);
    });

    it('converts the hidden set of the other mode without reporting it', () => {
        const { plan: migrated, report } = migratePlanTrees(
            old,
            current,
            plan({ 'act-1': section([3]), single: section([2]) }),
        );

        expect(migrated.sections.single.tree.allocation?.allocated).toEqual([]);
        expect(report.removed).toEqual([]);
    });

    it('clears the class and every tree when the class is gone', () => {
        const { plan: migrated, report } = migratePlanTrees(
            old,
            tree([node(1)], 'Templar'),
            plan({ 'act-1': section([2]) }),
        );

        expect(report.classMissing).toBe(true);
        expect(migrated.build).toEqual({ className: null, ascendId: null });
        expect(migrated.sections['act-1'].tree.allocation?.allocated).toEqual(
            [],
        );
    });

    it('leaves a plan without a class alone', () => {
        const blank = {
            ...plan({}),
            build: { className: null, ascendId: null },
        };

        expect(migratePlanTrees(old, current, blank).plan).toBe(blank);
    });
});
