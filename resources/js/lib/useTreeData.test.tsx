import type { TreeData } from '@poe2-toolkit/tree-core';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loaders = {
    loadTreeData: vi.fn(),
    loadPointBudget: vi.fn(),
    loadTreeResources: vi.fn(),
};

vi.mock('@/lib/tree-scene', () => ({
    LIVE_TREE: { base: '/tree/current', version: null },
    patchTree: (patch: string, version: string) => ({
        base: `/tree/patches/${patch}`,
        version,
    }),
    treeSourceKey: (source: { base: string; version: string | null }) =>
        `${source.base}?${source.version ?? ''}`,
    loadTreeData: (source?: unknown) => loaders.loadTreeData(source),
    loadPointBudget: (source?: unknown) => loaders.loadPointBudget(source),
    loadTreeResources: (source?: unknown) => loaders.loadTreeResources(source),
}));

import { TreeSourceProvider } from '@/lib/treeSource';
import { useTreeData } from '@/lib/useTreeData';

const tree = { classes: [] } as unknown as TreeData;

beforeEach(() => {
    vi.clearAllMocks();
});

describe('useTreeData', () => {
    it('surfaces the tree, budget and resources once each loader resolves', async () => {
        loaders.loadTreeData.mockResolvedValue(tree);
        loaders.loadPointBudget.mockResolvedValue({ total: 123 });
        loaders.loadTreeResources.mockResolvedValue({
            manifest: { frames: {} },
            atlases: {},
        });

        const { result } = renderHook(() => useTreeData({ resources: true }));

        await waitFor(() => expect(result.current.data).toBe(tree));
        expect(result.current.budget).toEqual({ total: 123 });
        expect(result.current.resources).not.toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('leaves the sprite atlases alone unless a caller asks for them', async () => {
        // The atlases are several MB of GGG webp sheets against ~400 kB of JSON, so a
        // caller that only reads node names or the class list must not pull them.
        loaders.loadTreeData.mockResolvedValue(tree);
        loaders.loadPointBudget.mockResolvedValue({ total: 123 });
        loaders.loadTreeResources.mockResolvedValue({
            manifest: { frames: {} },
            atlases: {},
        });

        const { result } = renderHook(() => useTreeData());

        await waitFor(() => expect(result.current.data).toBe(tree));
        expect(loaders.loadTreeResources).not.toHaveBeenCalled();
        expect(result.current.resources).toBeNull();
    });

    it('reports the tree load error and keeps resources null on atlas failure', async () => {
        loaders.loadTreeData.mockRejectedValue(new Error('boom'));
        loaders.loadPointBudget.mockRejectedValue(new Error('no budget'));
        loaders.loadTreeResources.mockRejectedValue(new Error('no atlas'));

        const { result } = renderHook(() => useTreeData({ resources: true }));

        await waitFor(() => expect(result.current.error).toBe('boom'));
        expect(result.current.data).toBeNull();
        expect(result.current.resources).toBeNull();
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
        loaders.loadTreeData.mockRejectedValue('nope');
        loaders.loadPointBudget.mockResolvedValue(null);
        loaders.loadTreeResources.mockResolvedValue(null);

        const { result } = renderHook(() => useTreeData());

        await waitFor(() =>
            expect(result.current.error).toBe('Failed to load tree'),
        );
    });

    it('reads the tree the surrounding source selects', async () => {
        loaders.loadTreeData.mockResolvedValue(tree);
        loaders.loadPointBudget.mockResolvedValue({ total: 123 });
        const snapshot = { treePatch: '4.4.3.1', treeVersion: 'abc' };
        const expected = { base: '/tree/patches/4.4.3.1', version: 'abc' };

        const { result } = renderHook(() => useTreeData(), {
            wrapper: ({ children }) => (
                <TreeSourceProvider snapshot={snapshot}>
                    {children}
                </TreeSourceProvider>
            ),
        });

        await waitFor(() => expect(result.current.data).toBe(tree));
        expect(loaders.loadTreeData).toHaveBeenCalledWith(expected);
        expect(loaders.loadPointBudget).toHaveBeenCalledWith(expected);
    });

    it('drops what it loaded for one tree as soon as it is asked for another', async () => {
        const archived = { classes: [] } as unknown as TreeData;
        loaders.loadTreeData.mockImplementation(
            (source: { version: string | null }) =>
                source.version === null
                    ? new Promise(() => {})
                    : Promise.resolve(archived),
        );
        loaders.loadPointBudget.mockResolvedValue({ total: 123 });
        let snapshot: { treePatch: string; treeVersion: string } | null = {
            treePatch: '4.4.3.1',
            treeVersion: 'abc',
        };

        const { result, rerender } = renderHook(() => useTreeData(), {
            wrapper: ({ children }) => (
                <TreeSourceProvider snapshot={snapshot}>
                    {children}
                </TreeSourceProvider>
            ),
        });

        await waitFor(() => expect(result.current.data).toBe(archived));

        snapshot = null;
        rerender();

        expect(result.current.data).toBeNull();
    });
});
