import type { TreeData, TreeNode } from '@poe2-toolkit/tree-core';
import { describe, expect, it } from 'vitest';
import { migrateTree } from '@/lib/treeMigration';
import type { TreeSnapshot } from '@/types/tree';

/*
 * A tiny tree: the Witch starts at 1, the main path runs 1-2-3-4 with a branch
 * 3-5, and the Blood Mage disc runs 100-101-102 from its start node 100.
 */
type NodeSpec = Partial<TreeNode> & { links?: number[] };

function node(skill: number, spec: NodeSpec = {}): TreeNode {
    const { links = [], ...rest } = spec;

    return {
        skill,
        group: 0,
        orbit: 0,
        orbitIndex: 0,
        x: 0,
        y: 0,
        connections: links.map((id) => ({ id, orbit: 0 })),
        name: `Node ${skill}`,
        icon: '',
        stats: [`+${skill} to something`],
        ...rest,
    } as TreeNode;
}

function tree(
    nodes: TreeNode[],
    { withAscendancy = true, className = 'Witch' } = {},
): TreeData {
    return {
        nodes: Object.fromEntries(nodes.map((entry) => [entry.skill, entry])),
        classes: [
            {
                name: className,
                id: 1,
                startNode: 1,
                ascendancies: withAscendancy
                    ? [
                          {
                              id: 'Blood Mage',
                              name: 'Blood Mage',
                              internalId: 'Witch1',
                          },
                      ]
                    : [],
            },
        ],
    } as unknown as TreeData;
}

const disc = [
    node(100, {
        links: [101],
        ascendancyName: 'Blood Mage',
        isAscendancyStart: true,
    }),
    node(101, { links: [102], ascendancyName: 'Blood Mage' }),
    node(102, { ascendancyName: 'Blood Mage' }),
];

const base = [
    node(1, { links: [2], classesStart: ['Witch'] }),
    node(2, { links: [3] }),
    node(3, { links: [4, 5] }),
    node(4),
    node(5),
    ...disc,
];

function build(overrides: Partial<TreeSnapshot> = {}): TreeSnapshot {
    return {
        className: 'Witch',
        ascendId: 'Blood Mage',
        allocated: [2, 3, 4, 5, 100, 101, 102],
        attributeChoices: {},
        weaponSets: {},
        jewels: {},
        treeVersion: '0_4',
        ...overrides,
    };
}

describe('migrateTree', () => {
    it('carries an untouched build over as it was', () => {
        const { build: migrated, report } = migrateTree(
            tree(base),
            tree(base),
            build(),
        );

        expect(migrated.allocated).toEqual([2, 3, 4, 5, 100, 101, 102]);
        expect(report).toEqual({
            classMissing: false,
            ascendancyMissing: false,
            unchanged: 7,
            changed: [],
            removed: [],
            disconnected: [],
        });
    });

    it('drops a node the new tree lacks and everything that hung off it', () => {
        const current = tree([
            node(1, { links: [3], classesStart: ['Witch'] }),
            node(3, { links: [5] }),
            node(4),
            node(5),
            ...disc,
        ]);

        const { build: migrated, report } = migrateTree(
            tree(base),
            current,
            build({ allocated: [2, 3, 4, 5] }),
        );

        expect(migrated.allocated).toEqual([3, 5]);
        expect(report.removed).toEqual([{ id: 2, name: 'Node 2' }]);
        expect(report.disconnected).toEqual([{ id: 4, name: 'Node 4' }]);
    });

    it('reports a node whose name or stats changed, with both versions', () => {
        const current = tree(
            base.map((entry) =>
                entry.skill === 4
                    ? { ...entry, name: 'Renamed', stats: ['+1 to less'] }
                    : entry,
            ),
        );

        const { report } = migrateTree(tree(base), current, build());

        expect(report.unchanged).toBe(6);
        expect(report.changed).toEqual([
            {
                id: 4,
                name: 'Renamed',
                previousName: 'Node 4',
                before: ['+4 to something'],
                after: ['+1 to less'],
            },
        ]);
    });

    it('keeps the ascendancy disc only as far as it still connects to its start', () => {
        const current = tree([
            ...base.filter((entry) => entry.skill < 100),
            node(100, {
                links: [102],
                ascendancyName: 'Blood Mage',
                isAscendancyStart: true,
            }),
            node(101, { ascendancyName: 'Blood Mage' }),
            node(102, { ascendancyName: 'Blood Mage' }),
        ]);

        const { build: migrated, report } = migrateTree(
            tree(base),
            current,
            build({ ascendId: 'Witch1' }),
        );

        expect(migrated.ascendId).toBe('Witch1');
        expect(migrated.allocated).toEqual([2, 3, 4, 5, 100, 102]);
        expect(report.disconnected).toEqual([{ id: 101, name: 'Node 101' }]);
    });

    it('drops an ascendancy the new tree no longer offers, with its nodes', () => {
        const { build: migrated, report } = migrateTree(
            tree(base),
            tree(base, { withAscendancy: false }),
            build(),
        );

        expect(report.ascendancyMissing).toBe(true);
        expect(migrated.ascendId).toBeNull();
        expect(migrated.allocated).toEqual([2, 3, 4, 5]);
        expect(report.removed.map((entry) => entry.id)).toEqual([
            100, 101, 102,
        ]);
    });

    it('carries nothing over when the class itself is gone', () => {
        const { build: migrated, report } = migrateTree(
            tree(base),
            tree(base, { className: 'Templar' }),
            build(),
        );

        expect(report.classMissing).toBe(true);
        expect(migrated.allocated).toEqual([]);
        expect(report.removed).toHaveLength(7);
    });

    it('drops the per-node choices of dropped nodes and the stale PoB tree version', () => {
        const current = tree(base.filter((entry) => entry.skill !== 5));

        const { build: migrated } = migrateTree(
            tree(base),
            current,
            build({
                attributeChoices: { 4: 'str', 5: 'dex' },
                weaponSets: { 4: 1, 5: 2 },
                jewels: { 5: { name: 'Gone' } as never },
            }),
        );

        expect(migrated.attributeChoices).toEqual({ 4: 'str' });
        expect(migrated.weaponSets).toEqual({ 4: 1 });
        expect(migrated.jewels).toEqual({});
        expect(migrated.treeVersion).toBeNull();
    });
});
