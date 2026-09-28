import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoadedGameData } from '@/lib/gameEra';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', () => ({
    usePage: () => page,
}));

describe('useLoadedGameData', () => {
    beforeEach(() => {
        page.props = { dataVersion: '4.5.5.4', gameEra: '0.5' };
    });

    it('keeps the data the editor was opened on when the shared props move on', () => {
        const { result, rerender } = renderHook(() => useLoadedGameData());

        // A refused save reloads the shared props with the new data; the editor
        // still holds old-era content, so it must keep sending the old patch.
        page.props = { dataVersion: '5.0.0.1', gameEra: '1.0' };
        rerender();

        expect(result.current).toEqual({ patch: '4.5.5.4', era: '0.5' });
    });

    it('is empty when the page carries no game data', () => {
        page.props = {};

        const { result } = renderHook(() => useLoadedGameData());

        expect(result.current).toEqual({ patch: null, era: null });
    });
});
