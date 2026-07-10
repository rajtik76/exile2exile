import type { TreeData } from '@poe2-toolkit/tree-core';
import { describe, expect, it, vi } from 'vitest';

// Keep the join under test free of the heavy portrait-sheet and tree-scene imports.
vi.mock('@/components/build/classPortrait', () => ({
    classPortrait: (name: string) =>
        name === 'Witch'
            ? { src: '/witch.webp', rect: { x: 1, y: 2, w: 3, h: 4 } }
            : undefined,
}));
vi.mock('@/lib/tree-scene', () => ({ treeAssetBase: '/tree/current' }));
vi.mock('@/lib/assetVersion', () => ({
    withAssetVersion: (url: string) => url,
}));

import { centreSprites, resolveClassId } from '@/lib/classCatalog';

const tree = {
    classes: [
        { id: 0, name: 'Witch' },
        { id: 1, name: 'Ranger' },
    ],
} as unknown as TreeData;

describe('resolveClassId', () => {
    it('resolves a class name case-insensitively to its live id', () => {
        expect(resolveClassId(tree, 'witch')).toBe(0);
        expect(resolveClassId(tree, 'Ranger')).toBe(1);
    });

    it('returns null for an empty or unknown name', () => {
        expect(resolveClassId(tree, null)).toBeNull();
        expect(resolveClassId(tree, '')).toBeNull();
        expect(resolveClassId(tree, 'Templar')).toBeNull();
    });
});

describe('centreSprites', () => {
    it('returns undefined for an unknown class id', () => {
        expect(centreSprites(tree, 99, null)).toBeUndefined();
    });

    it('builds portrait + ring sprites from the class frame geometry', () => {
        const sprites = centreSprites(tree, 0, null);

        expect(sprites?.portrait).toEqual({
            url: '/witch.webp',
            sx: 1,
            sy: 2,
            sw: 3,
            sh: 4,
        });
        expect(sprites?.ringActive.url).toBe(
            '/tree/current/centre/ring-active.webp',
        );
        expect(sprites?.ringStatic.sw).toBe(4000);
    });

    it('omits the portrait when the class has no frame', () => {
        const sprites = centreSprites(tree, 1, null);

        expect(sprites?.portrait).toBeUndefined();
        expect(sprites?.ringActive).toBeDefined();
    });
});
