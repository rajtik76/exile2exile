import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('@/lib/assetVersion', () => ({
    withAssetVersion: (url: string) => url,
}));

import { loadTreeAtlases } from '@/lib/tree-atlases';

/** A fake <img> whose `src` setter resolves the load on the next tick. */
class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
        queueMicrotask(() => this.onload?.());
    }
}

beforeEach(() => {
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal(
        'fetch',
        vi.fn((url: string) =>
            Promise.resolve({
                json: () =>
                    Promise.resolve({
                        frames: url.includes('frame')
                            ? {
                                  'frame:normalActive': {
                                      frame: { x: 1, y: 2, w: 3, h: 4 },
                                  },
                              }
                            : {
                                  keystoneActive: {
                                      frame: { x: 5, y: 6, w: 7, h: 8 },
                                  },
                              },
                    }),
            } as unknown as Response),
        ),
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

test('loads every node atlas and normalises frame keys to domain keys', async () => {
    const resources = await loadTreeAtlases('/tree/current');

    // The `frame:` tag is stripped; an untagged variant key is kept verbatim.
    expect(resources.manifest.frames.normalActive).toEqual({
        atlas: 'frame',
        x: 1,
        y: 2,
        w: 3,
        h: 4,
    });
    expect(resources.manifest.frames.keystoneActive).toMatchObject({
        x: 5,
        y: 6,
    });
    expect(Object.keys(resources.atlases)).toEqual(
        expect.arrayContaining(['skills', 'frame', 'mastery-effect-active']),
    );
});
