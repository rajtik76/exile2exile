import type { TreeData } from '@poe2-toolkit/tree-core';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loaders = {
    loadTreeData: vi.fn(),
    loadPointBudget: vi.fn(),
    loadTreeResources: vi.fn(),
};

vi.mock('@/lib/tree-scene', () => ({
    loadTreeData: () => loaders.loadTreeData(),
    loadPointBudget: () => loaders.loadPointBudget(),
    loadTreeResources: () => loaders.loadTreeResources(),
}));

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

        const { result } = renderHook(() => useTreeData());

        await waitFor(() => expect(result.current.data).toBe(tree));
        expect(result.current.budget).toEqual({ total: 123 });
        expect(result.current.resources).not.toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('reports the tree load error and keeps resources null on atlas failure', async () => {
        loaders.loadTreeData.mockRejectedValue(new Error('boom'));
        loaders.loadPointBudget.mockRejectedValue(new Error('no budget'));
        loaders.loadTreeResources.mockRejectedValue(new Error('no atlas'));

        const { result } = renderHook(() => useTreeData());

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
});
