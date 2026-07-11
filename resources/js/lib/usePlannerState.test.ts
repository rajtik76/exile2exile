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
    transform: vi.fn(),
    post: vi.fn(),
    processing: false,
};

vi.mock('@inertiajs/react', () => ({
    useHttp: () => httpForm,
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
        httpForm.transform.mockClear();
        httpForm.post.mockReset();
        httpForm.processing = false;
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

    it('shares the current allocation and exposes the link', () => {
        httpForm.post.mockImplementation((_url: string, options) => {
            options.onSuccess({ slug: 'abc', url: 'https://x.test/t/abc' });
        });

        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });

        expect(result.current.canShare).toBe(true);

        act(() => {
            result.current.share();
        });

        expect(httpForm.transform).toHaveBeenCalled();
        expect(result.current.shareUrl).toBe('https://x.test/t/abc');
    });

    it('reuses the link instead of re-sharing an unchanged tree', () => {
        httpForm.post.mockImplementation((_url: string, options) => {
            options.onSuccess({ slug: 'abc', url: 'https://x.test/t/abc' });
        });

        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        act(() => {
            result.current.share();
        });
        act(() => {
            result.current.share();
        });

        // Second click on the same tree must not mint another row.
        expect(httpForm.post).toHaveBeenCalledTimes(1);
        expect(result.current.shareUrl).toBe('https://x.test/t/abc');
    });

    it('treats a share reply without a url as a failure', () => {
        httpForm.post.mockImplementation((_url: string, options) => {
            // The url field is missing.
            options.onSuccess({ slug: 'abc' });
        });

        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        act(() => {
            result.current.share();
        });

        expect(result.current.shareUrl).toBeNull();
        expect(result.current.shareError).toBe(
            'Could not create a share link. Try again.',
        );
    });

    it('surfaces a share error when the request fails', () => {
        httpForm.post.mockImplementation((_url: string, options) => {
            options.onError();
        });

        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        act(() => {
            result.current.share();
        });

        expect(result.current.shareUrl).toBeNull();
        expect(result.current.shareError).toBe(
            'Could not create a share link. Try again.',
        );
    });

    it('clears a share outcome on demand', () => {
        httpForm.post.mockImplementation((_url: string, options) => {
            options.onSuccess({ slug: 'abc', url: 'https://x.test/t/abc' });
        });

        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        act(() => {
            result.current.share();
        });
        act(() => {
            result.current.clearShare();
        });

        expect(result.current.shareUrl).toBeNull();
        expect(result.current.shareError).toBeNull();
    });

    it('does not share while a request is already in flight', () => {
        httpForm.processing = true;

        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        act(() => {
            result.current.share();
        });

        expect(httpForm.post).not.toHaveBeenCalled();
    });

    it('drops a stale share link once the tree is edited', () => {
        httpForm.post.mockImplementation((_url: string, options) => {
            options.onSuccess({ slug: 'abc', url: 'https://x.test/t/abc' });
        });

        const { result } = renderHook(() => usePlannerState(makeTreeData()));

        act(() => {
            result.current.applyAllocation({ classId: 0, allocated: [100] });
        });
        act(() => {
            result.current.share();
        });

        expect(result.current.shareUrl).toBe('https://x.test/t/abc');

        // A further edit produces a new allocation, so the old link no longer
        // matches the tree and must disappear.
        act(() => {
            result.current.applyAllocation({
                classId: 0,
                allocated: [100, 101],
            });
        });

        expect(result.current.shareUrl).toBeNull();
    });
});
