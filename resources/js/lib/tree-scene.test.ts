import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `loadPointBudget` surfaces the GGPK-derived passive-point caps baked into
 * `data.json` to the planner, with fallbacks for an older extract that predates
 * the fields. The heavy renderer/normaliser imports tree-scene pulls in are
 * stubbed so these tests exercise only the raw-payload read.
 */

vi.mock('@poe2-toolkit/tree-core/ggg', () => ({
    normalizeGggTree: (raw: unknown) => raw,
}));

vi.mock('@/lib/tree-atlases', () => ({
    loadTreeAtlases: vi.fn(),
}));

function mockTreeFetch(payload: unknown, ok = true, status = 200): void {
    vi.stubGlobal(
        'fetch',
        vi.fn(() =>
            Promise.resolve({
                ok,
                status,
                json: () => Promise.resolve(payload),
            } as Response),
        ),
    );
}

beforeEach(() => {
    // tree-scene memoises the raw fetch at module scope; reset it per case so
    // each test sees its own mocked payload.
    vi.resetModules();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('loadPointBudget', () => {
    it('returns the caps the extract carries, not the fallback', async () => {
        // Values distinct from the fallback prove it reads from the payload.
        mockTreeFetch({ maxBasicPoints: 120, maxWeaponSetPoints: 20 });

        const { loadPointBudget } = await import('@/lib/tree-scene');

        await expect(loadPointBudget()).resolves.toEqual({
            basic: 120,
            weaponSet: 20,
        });
    });

    it('falls back when an older extract omits the fields', async () => {
        mockTreeFetch({ nodes: {} });

        const { loadPointBudget } = await import('@/lib/tree-scene');

        await expect(loadPointBudget()).resolves.toEqual({
            basic: 123,
            weaponSet: 24,
        });
    });

    it('rejects when the raw tree fetch is not ok', async () => {
        mockTreeFetch(null, false, 503);

        const { loadPointBudget } = await import('@/lib/tree-scene');

        await expect(loadPointBudget()).rejects.toThrow('HTTP 503');
    });
});

describe('treeAssetUrl', () => {
    it('builds a webp url under the asset base', async () => {
        const { treeAssetUrl, treeAssetBase } =
            await import('@/lib/tree-scene');

        expect(treeAssetBase).toBe('/tree/current/assets');
        expect(treeAssetUrl('skills')).toBe('/tree/current/assets/skills.webp');
    });
});

describe('loadTreeData', () => {
    it('normalises the raw payload and memoises across calls', async () => {
        const payload = { nodes: { 1: {} }, groups: {}, classes: [] };
        mockTreeFetch(payload);

        const { loadTreeData } = await import('@/lib/tree-scene');

        const first = await loadTreeData();
        await loadTreeData();

        // normalizeGggTree is stubbed to identity, so the raw payload comes back.
        expect(first).toEqual(payload);
        // Memoised: the shared raw fetch fired only once for both calls.
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('rejects a payload that is not a tree extract', async () => {
        // A misrouted or truncated response: JSON, but not the tree tables.
        mockTreeFetch({ message: 'not found' });

        const { loadTreeData } = await import('@/lib/tree-scene');

        await expect(loadTreeData()).rejects.toThrow('Malformed tree data');
    });
});

describe('loadTreeResources', () => {
    it('delegates to the atlas loader and memoises the promise', async () => {
        const resources = { manifest: { frames: {} }, atlases: {} };
        const { loadTreeAtlases } = await import('@/lib/tree-atlases');
        vi.mocked(loadTreeAtlases).mockResolvedValue(resources);

        const { loadTreeResources } = await import('@/lib/tree-scene');

        await expect(loadTreeResources()).resolves.toBe(resources);
        await loadTreeResources();
        expect(loadTreeAtlases).toHaveBeenCalledOnce();
    });
});
