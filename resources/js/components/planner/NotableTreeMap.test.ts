import type { Scene, TreeData } from '@poe2-toolkit/tree-core';
import { describe, expect, it } from 'vitest';
import {
    ascendancyMapModel,
    findNotableSkill,
    frameViewBox,
    notableMapModel,
} from './NotableTreeMap';

function treeData(nodes: Record<number, unknown>): TreeData {
    return { nodes } as unknown as TreeData;
}

describe('findNotableSkill', () => {
    const data = treeData({
        1: { name: 'Fire Mastery', isNotable: true },
        2: { name: 'Cadence', isKeystone: true },
        3: { name: 'Fire Mastery', isNotable: false },
        4: { name: 'Plain Node' },
    });

    it('maps a notable name to its numeric skill id', () => {
        expect(findNotableSkill(data, 'Fire Mastery')).toBe(1);
    });

    it('matches keystones too', () => {
        expect(findNotableSkill(data, 'Cadence')).toBe(2);
    });

    it('ignores non-notable nodes that share a name', () => {
        expect(
            findNotableSkill(treeData({ 3: { name: 'X' } }), 'X'),
        ).toBeNull();
    });

    it('returns null when the name is unknown', () => {
        expect(findNotableSkill(data, 'Nope')).toBeNull();
    });
});

describe('notableMapModel', () => {
    const scene = {
        nodes: [
            { skill: 1, x: 0, y: 0, kind: 'notable' },
            { skill: 2, x: 10, y: 0, kind: 'normal' },
            { skill: 3, x: 20, y: 0, kind: 'keystone' },
            { skill: 4, x: 30, y: 0, kind: 'mastery' },
            { skill: 5, x: 40, y: 0, kind: 'normal', ascendancy: 'Warden' },
        ],
        connections: [
            { from: 1, to: 2, a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
            { from: 2, to: 3, a: { x: 10, y: 0 }, b: { x: 20, y: 0 } },
            { from: 3, to: 5, a: { x: 20, y: 0 }, b: { x: 40, y: 0 } },
        ],
        mainBounds: { minX: 0, minY: 0, maxX: 20, maxY: 0 },
    } as unknown as Scene;

    it('keeps only structural main-tree dots', () => {
        const model = notableMapModel(scene, 3);

        expect(model.dots.map((dot) => dot.skill)).toEqual([1, 2, 3]);
    });

    it('flags notables and keystones as big dots', () => {
        const model = notableMapModel(scene, 3);

        expect(model.dots.find((dot) => dot.skill === 1)?.big).toBe(true);
        expect(model.dots.find((dot) => dot.skill === 2)?.big).toBe(false);
    });

    it('drops edges touching a dropped node', () => {
        const model = notableMapModel(scene, 3);

        // 1-2 and 2-3 stay; 3-5 goes (5 is ascendancy).
        expect(model.edges).toHaveLength(2);
    });

    it('locates the target and reads its keystone flag', () => {
        expect(notableMapModel(scene, 3).target).toEqual({
            x: 20,
            y: 0,
            keystone: true,
        });
        expect(notableMapModel(scene, 1).target?.keystone).toBe(false);
        expect(notableMapModel(scene, 99).target).toBeNull();
    });
});

describe('ascendancyMapModel', () => {
    const data = treeData({
        10: {
            name: 'Endless Munitions',
            isNotable: true,
            ascendancyName: 'Deadeye',
            x: 1000,
            y: 1000,
            connections: [{ id: 11 }],
        },
        11: {
            name: 'Asc Normal',
            ascendancyName: 'Deadeye',
            x: 1010,
            y: 1000,
            connections: [{ id: 10 }, { id: 12 }],
        },
        12: {
            name: 'Asc Start',
            isAscendancyStart: true,
            ascendancyName: 'Deadeye',
            x: 1005,
            y: 990,
            connections: [{ id: 11 }],
        },
        20: {
            name: 'Main Notable',
            isNotable: true,
            x: 0,
            y: 0,
            connections: [],
        },
    });

    it('draws only the target ascendancy disc from raw data', () => {
        const model = ascendancyMapModel(data, 10);

        expect(model.dots.map((dot) => dot.skill).sort()).toEqual([10, 11, 12]);
        expect(model.edges).toHaveLength(2); // 10-11 and 11-12, deduped
        expect(model.bounds).toEqual({
            minX: 1000,
            minY: 990,
            maxX: 1010,
            maxY: 1000,
        });
    });

    it('locates the target and fits the whole disc', () => {
        const model = ascendancyMapModel(data, 10);

        expect(model.target).toEqual({ x: 1000, y: 1000, keystone: false });
        expect(model.zoom).toBeGreaterThan(1);
    });
});

describe('frameViewBox', () => {
    const bounds = { minX: -100, minY: -100, maxX: 100, maxY: 100 };

    /** Whether a point sits inside a viewBox rect. */
    function contains(
        frame: { x: number; y: number; w: number; h: number },
        px: number,
        py: number,
    ): boolean {
        return (
            px >= frame.x &&
            px <= frame.x + frame.w &&
            py >= frame.y &&
            py <= frame.y + frame.h
        );
    }

    it('centres a tight window on a central target', () => {
        // A small window well inside the tree isn't clamped, so it centres.
        const frame = frameViewBox(bounds, { x: 0, y: 0 }, 2.4, 0.1);

        expect(frame.x + frame.w / 2).toBeCloseTo(0, 5);
        expect(frame.y + frame.h / 2).toBeCloseTo(0, 5);
    });

    it('matches the requested aspect ratio', () => {
        const frame = frameViewBox(bounds, { x: 80, y: 60 }, 2.4);

        expect(frame.w / frame.h).toBeCloseTo(2.4, 5);
    });

    it('does not centre an edge target - clamps inside the tree bounds', () => {
        const frame = frameViewBox(bounds, { x: 100, y: 100 }, 2.4, 0.2);

        // Window stays within the tree, so the corner target is off-centre but visible.
        expect(frame.x + frame.w).toBeLessThanOrEqual(bounds.maxX + 1e-6);
        expect(frame.y + frame.h).toBeLessThanOrEqual(bounds.maxY + 1e-6);
        expect(contains(frame, 100, 100)).toBe(true);
        expect(frame.x + frame.w / 2).not.toBeCloseTo(100, 1);
    });

    it('zooms tighter with a smaller zoom fraction', () => {
        const wide = frameViewBox(bounds, { x: 0, y: 0 }, 2.4, 0.4);
        const tight = frameViewBox(bounds, { x: 0, y: 0 }, 2.4, 0.2);

        expect(tight.w).toBeLessThan(wide.w);
    });

    it('centres on the tree when there is no target', () => {
        const frame = frameViewBox(bounds, null);
        const midX = frame.x + frame.w / 2;
        const midY = frame.y + frame.h / 2;

        expect(midX).toBeCloseTo(0, 5);
        expect(midY).toBeCloseTo(0, 5);
    });
});
