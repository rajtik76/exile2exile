import type { TreeData } from '@poe2-toolkit/tree-core';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlannerState } from '@/lib/usePlannerState';

/**
 * The planner build state was lifted out of PassiveTreeView so the page owns the
 * class, ascendancy and allocation. These tests pin the two behaviours that must
 * never regress: switching class wipes everything, switching ascendancy wipes
 * only the previous ascendancy's nodes. (The geometry-level reset helpers are
 * covered in @poe2-toolkit/tree-core; this is the app-side wiring.)
 */

/** Minimal useHttp stub: a controllable form whose post() invokes its callbacks. */
const httpForm = {
    data: { code: '' } as { code: string },
    setData: vi.fn((key: string, value: string) => {
        httpForm.data[key as 'code'] = value;
    }),
    post: vi.fn(),
    processing: false,
};

/** Router stub for the save flow: create POSTs, edit PUTs; callbacks are manual. */
// vi.hoisted: the mock factory below is hoisted above this file's const
// declarations, so the stub must be created in a hoisted block too.
const routerMock = vi.hoisted(() => ({
    post: vi.fn(),
    put: vi.fn(),
}));

vi.mock('@inertiajs/react', () => ({
    useHttp: () => httpForm,
    router: routerMock,
}));

// Resolve a class name to the live id, the same join classCatalog does, but
// without dragging the portrait-sheet asset imports into the test.
vi.mock('@/lib/classCatalog', () => ({
    resolveClassId: (data: TreeData, name: string | null | undefined) =>
        name == null
            ? null
            : (data.classes.find(
                  (cls) => cls.name.toLowerCase() === name.toLowerCase(),
              )?.id ?? null),
}));

/**
 * A tree with two playable classes (Warrior, Witch), one legacy class with no
 * ascendancies (dropped from the picker), and nodes tagged so the ascendancy
 * reset has something to filter.
 */
function makeTreeData(): TreeData {
    const data = {
        classes: [
            {
                id: 0,
                name: 'Warrior',
                ascendancies: [
                    { id: 'Titan', name: 'Titan' },
                    { id: 'Warbringer', name: 'Warbringer' },
                ],
            },
            {
                id: 1,
                name: 'Witch',
                ascendancies: [{ id: 'Infernalist', name: 'Infernalist' }],
            },
            { id: 2, name: 'Marauder', ascendancies: [] },
        ],
        nodes: {
            100: { skill: 100 }, // main-tree node
            101: { skill: 101 }, // main-tree node
            200: { skill: 200, ascendancyName: 'Titan' },
            201: { skill: 201, ascendancyName: 'Titan' },
            300: { skill: 300, ascendancyName: 'Warbringer' },
        },
    };

    return data as unknown as TreeData;
}

describe('usePlannerState', () => {
    beforeEach(() => {
        httpForm.data = { code: '' };
        httpForm.setData.mockClear();
        httpForm.post.mockReset();
        httpForm.processing = false;
        routerMock.post.mockReset();
        routerMock.put.mockReset();
    });

    it('defaults to the first playable class once the tree loads', () => {
        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        expect(result.current.classId).toBe(0);
        // The legacy class with no ascendancies is dropped from the picker.
        expect(result.current.classes.map((cls) => cls.id)).toEqual([0, 1]);
    });

    it('clears every allocated node when the class changes', () => {
        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({
                classId: 0,
                ascendId: 'Titan',
                allocated: [100, 101, 200],
            });
        });
        act(() => {
            result.current.selectClass(1);
        });

        expect(result.current.classId).toBe(1);
        expect(result.current.ascendancy).toBeNull();
        // freshAllocation: the new class starts from an empty allocation.
        expect(result.current.allocation).toEqual({
            classId: 1,
            allocated: [],
        });
    });

    it('drops only the previous ascendancy nodes when the ascendancy changes', () => {
        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.selectAscendancy('Titan');
        });
        act(() => {
            result.current.applyAllocation({
                classId: 0,
                ascendId: 'Titan',
                allocated: [100, 101, 200, 201],
            });
        });
        act(() => {
            result.current.selectAscendancy('Warbringer');
        });

        expect(result.current.ascendancy).toBe('Warbringer');
        // Main-tree nodes survive; the Titan ascendancy nodes are dropped.
        expect(result.current.allocation?.allocated).toEqual([100, 101]);
        expect(result.current.allocation?.ascendId).toBe('Warbringer');
    });

    it('keeps the allocation when re-selecting the same ascendancy', () => {
        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.selectAscendancy('Titan');
        });
        act(() => {
            result.current.applyAllocation({
                classId: 0,
                ascendId: 'Titan',
                allocated: [100, 200],
            });
        });
        act(() => {
            result.current.selectAscendancy('Titan');
        });

        expect(result.current.allocation?.allocated).toEqual([100, 200]);
    });

    it('loads an imported build, resolves its class and bumps the frame token', () => {
        httpForm.post.mockImplementation((_url: string, options) => {
            options.onSuccess({
                className: 'Witch',
                ascendId: 'Infernalist',
                allocated: [100],
            });
        });

        const { result } = renderHook(() => usePlannerState(makeTreeData()));
        const before = result.current.frameToken;

        act(() => {
            result.current.setCode('some-pob-code');
        });
        act(() => {
            result.current.loadBuild();
        });

        expect(result.current.classId).toBe(1);
        expect(result.current.ascendancy).toBe('Infernalist');
        expect(result.current.imported).toBe(true);
        expect(result.current.allocation?.classId).toBe(1);
        expect(result.current.frameToken).toBe(before + 1);
    });

    it('rejects a malformed import response instead of adopting it', () => {
        httpForm.post.mockImplementation((_url: string, options) => {
            // The allocated array is missing.
            options.onSuccess({ className: 'Witch' });
        });

        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.setCode('some-pob-code');
        });
        act(() => {
            result.current.loadBuild();
        });

        expect(result.current.imported).toBe(false);
        expect(result.current.allocation).toBeNull();
        expect(result.current.buildError).toBe('Could not load build.');
    });

    it('clears an imported build', () => {
        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        act(() => {
            result.current.clearBuild();
        });

        expect(result.current.allocation).toBeNull();
        expect(result.current.imported).toBe(false);
    });

    it('seeds an editable snapshot from a shared build', () => {
        const { result } = renderHook(() =>
            usePlannerState(makeTreeData(), {
                className: 'Witch',
                ascendId: 'Infernalist',
                allocated: [100, 200],
            }),
        );

        // The shared build sets the class itself; the first-class default must
        // not fire over it.
        expect(result.current.classId).toBe(1);
        expect(result.current.ascendancy).toBe('Infernalist');
        expect(result.current.imported).toBe(true);
        expect(result.current.allocation?.allocated).toEqual([100, 200]);
    });

    it('creates the build with a POST on first save', () => {
        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });

        expect(result.current.canSave).toBe(true);

        act(() => {
            result.current.save();
        });

        expect(routerMock.post).toHaveBeenCalledTimes(1);
        const [url, payload] = routerMock.post.mock.calls[0];
        expect(url).toBe('/tree/share');
        expect(payload).toMatchObject({
            className: 'Warrior',
            allocated: [100],
        });
        expect(routerMock.put).not.toHaveBeenCalled();
    });

    it('updates the saved build with a PUT from the editor', () => {
        const { result } = renderHook(() =>
            usePlannerState(
                makeTreeData(),
                {
                    className: 'Witch',
                    ascendId: 'Infernalist',
                    allocated: [100],
                },
                { mode: 'edit', slug: 'abc123' },
            ),
        );

        act(() => {
            result.current.applyAllocation({
                classId: 1,
                ascendId: 'Infernalist',
                allocated: [100, 101],
            });
        });
        act(() => {
            result.current.save();
        });

        expect(routerMock.put).toHaveBeenCalledTimes(1);
        const [url, payload] = routerMock.put.mock.calls[0];
        expect(url).toBe('/t/abc123');
        expect(payload).toMatchObject({ allocated: [100, 101] });
        expect(routerMock.post).not.toHaveBeenCalled();
    });

    it('seeds the editor unlocked and clean, and a node edit marks it dirty', () => {
        const { result } = renderHook(() =>
            usePlannerState(
                makeTreeData(),
                {
                    className: 'Witch',
                    ascendId: 'Infernalist',
                    allocated: [100],
                },
                { mode: 'edit', slug: 'abc123' },
            ),
        );

        // The editor is the author's own build: pickers stay usable (no import
        // lock) and the just-loaded tree matches its saved copy.
        expect(result.current.imported).toBe(false);
        expect(result.current.dirty).toBe(false);

        act(() => {
            result.current.applyAllocation({
                classId: 1,
                ascendId: 'Infernalist',
                allocated: [100, 101],
            });
        });

        expect(result.current.dirty).toBe(true);
    });

    it('marks the tree clean again after a successful update', () => {
        routerMock.put.mockImplementation((_url, _payload, options) => {
            options.onSuccess();
            options.onFinish();
        });

        const { result } = renderHook(() =>
            usePlannerState(
                makeTreeData(),
                { className: 'Witch', ascendId: null, allocated: [100] },
                { mode: 'edit', slug: 'abc123' },
            ),
        );

        act(() => {
            result.current.applyAllocation({
                classId: 1,
                allocated: [100, 101],
            });
        });
        act(() => {
            result.current.save();
        });

        expect(result.current.dirty).toBe(false);
        expect(result.current.saved).toBe(true);
        expect(result.current.saving).toBe(false);
    });

    it('surfaces the first validation message when a save fails', () => {
        routerMock.post.mockImplementation((_url, _payload, options) => {
            options.onError({ allocated: 'That node does not exist.' });
            options.onFinish();
        });

        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        act(() => {
            result.current.save();
        });

        expect(result.current.saveError).toBe('That node does not exist.');
        expect(result.current.saving).toBe(false);
    });

    it('does not save while a request is already in flight', () => {
        // post never calls onFinish, so the first save stays in flight.
        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        act(() => {
            result.current.save();
        });
        act(() => {
            result.current.save();
        });

        expect(routerMock.post).toHaveBeenCalledTimes(1);
    });

    it('does not save an empty planner', () => {
        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        expect(result.current.canSave).toBe(false);

        act(() => {
            result.current.save();
        });

        expect(routerMock.post).not.toHaveBeenCalled();
        expect(routerMock.put).not.toHaveBeenCalled();
    });

    it('keeps the live allocation when the editor props arrive after a first save', () => {
        // After the create POST the server redirects into edit mode; the same
        // component re-renders with the saved build as initialBuild. The live
        // allocation must not be overwritten (no canvas reframe), and it counts
        // as the saved copy.
        const initialProps: {
            build: Parameters<typeof usePlannerState>[1];
            options: Parameters<typeof usePlannerState>[2];
        } = { build: null, options: { mode: 'create', slug: null } };

        const { result, rerender } = renderHook(
            ({ build, options }) =>
                usePlannerState(makeTreeData(), build, options),
            { initialProps },
        );

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        const liveAllocation = result.current.allocation;
        const frameBefore = result.current.frameToken;

        rerender({
            build: { className: 'Warrior', ascendId: null, allocated: [100] },
            options: { mode: 'edit', slug: 'abc123' },
        });

        expect(result.current.allocation).toBe(liveAllocation);
        expect(result.current.frameToken).toBe(frameBefore);
        expect(result.current.dirty).toBe(false);
    });

    it('keeps the picked class across the first-save redirect', () => {
        // Before the save the class comes from the derived default (nothing was
        // explicitly picked); once initialBuild appears that default yields to
        // it, so the transition must pin the class - otherwise the picker falls
        // back to "Choose a class" and the canvas centre goes blank.
        const initialProps: {
            build: Parameters<typeof usePlannerState>[1];
            options: Parameters<typeof usePlannerState>[2];
        } = { build: null, options: { mode: 'create', slug: null } };

        const { result, rerender } = renderHook(
            ({ build, options }) =>
                usePlannerState(makeTreeData(), build, options),
            { initialProps },
        );

        expect(result.current.classId).toBe(0);

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });

        rerender({
            build: { className: 'Warrior', ascendId: null, allocated: [100] },
            options: { mode: 'edit', slug: 'abc123' },
        });

        expect(result.current.classId).toBe(0);
    });

    it('wipes the build when the editor navigates back to the blank planner', () => {
        // A delete redirects to /tree on this same component: every trace of the
        // dead build must leave with it, or it would keep haunting the canvas.
        const initialProps: {
            build: Parameters<typeof usePlannerState>[1];
            options: Parameters<typeof usePlannerState>[2];
        } = {
            build: { className: 'Witch', ascendId: null, allocated: [100] },
            options: { mode: 'edit', slug: 'abc123' },
        };

        const { result, rerender } = renderHook(
            ({ build, options }) =>
                usePlannerState(makeTreeData(), build, options),
            { initialProps },
        );

        expect(result.current.allocation?.allocated).toEqual([100]);

        rerender({
            build: null,
            options: { mode: 'create', slug: null },
        });

        expect(result.current.allocation).toBeNull();
        // Back to the blank planner's derived default class.
        expect(result.current.classId).toBe(0);
        expect(result.current.ascendancy).toBeNull();
        expect(result.current.imported).toBe(false);
    });
});
