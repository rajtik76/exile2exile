import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The media query is captured at module load, so stub matchMedia and re-import
// per case to control what the primary pointer reports.
let listeners: Array<() => void> = [];

function stubMatchMedia(matches: boolean): void {
    listeners = [];
    vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
            matches,
            addEventListener: (_type: string, cb: () => void) =>
                listeners.push(cb),
            removeEventListener: vi.fn(),
        })),
    );
}

beforeEach(() => {
    vi.resetModules();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

test('reports a coarse pointer when the media query matches', async () => {
    stubMatchMedia(true);
    const { useCoarsePointer } = await import('@/hooks/use-coarse-pointer');

    const { result } = renderHook(() => useCoarsePointer());

    expect(result.current).toBe(true);
});

test('reports a fine pointer when the media query does not match', async () => {
    stubMatchMedia(false);
    const { useCoarsePointer } = await import('@/hooks/use-coarse-pointer');

    const { result } = renderHook(() => useCoarsePointer());

    expect(result.current).toBe(false);
    // The hook subscribes so a docked mouse can flip the mode live.
    expect(listeners.length).toBe(1);
});
