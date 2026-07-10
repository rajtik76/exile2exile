import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useKeyboardList } from '@/lib/useKeyboardList';

function keyEvent(key: string): KeyboardEvent {
    return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

// Stable references: the hook resets its highlight whenever `items` changes
// identity, so a fresh literal each render would wipe it mid-test.
const twoItems = ['a', 'b'];
const oneItem = ['a'];

describe('useKeyboardList', () => {
    it('moves the highlight down and up within bounds', () => {
        const { result } = renderHook(() =>
            useKeyboardList(twoItems, vi.fn(), vi.fn()),
        );

        act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
        expect(result.current.highlight).toBe(0);

        act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
        act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
        expect(result.current.highlight).toBe(1); // clamped at last index

        act(() => result.current.onKeyDown(keyEvent('ArrowUp')));
        act(() => result.current.onKeyDown(keyEvent('ArrowUp')));
        expect(result.current.highlight).toBe(0); // clamped at zero
    });

    it('selects the highlighted item on Enter, and ignores Enter with no highlight', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useKeyboardList(twoItems, onSelect, vi.fn()),
        );

        act(() => result.current.onKeyDown(keyEvent('Enter')));
        expect(onSelect).not.toHaveBeenCalled();

        act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
        act(() => result.current.onKeyDown(keyEvent('Enter')));
        expect(onSelect).toHaveBeenCalledWith('a');
    });

    it('closes on Escape', () => {
        const onClose = vi.fn();
        const { result } = renderHook(() =>
            useKeyboardList(oneItem, vi.fn(), onClose),
        );

        act(() => result.current.onKeyDown(keyEvent('Escape')));
        expect(onClose).toHaveBeenCalled();
    });

    it('resets the highlight when the item set changes', () => {
        const { result, rerender } = renderHook(
            ({ items }) => useKeyboardList(items, vi.fn(), vi.fn()),
            {
                initialProps: { items: twoItems },
            },
        );

        act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
        expect(result.current.highlight).toBe(0);

        rerender({ items: oneItem });
        expect(result.current.highlight).toBe(-1);
    });
});
