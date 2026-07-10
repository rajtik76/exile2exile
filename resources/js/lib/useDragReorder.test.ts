import { act, renderHook } from '@testing-library/react';
import type { DragEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDragReorder } from '@/lib/useDragReorder';

/** A minimal DragEvent whose dataTransfer records the calls the hook makes. */
function dragEvent(overrides: Partial<HTMLElement> = {}): DragEvent {
    return {
        preventDefault: vi.fn(),
        clientX: 10,
        clientY: 20,
        currentTarget: {
            closest: () => null,
            ...overrides,
        } as unknown as HTMLElement,
        dataTransfer: {
            effectAllowed: '',
            dropEffect: '',
            setData: vi.fn(),
            setDragImage: vi.fn(),
        },
    } as unknown as DragEvent;
}

describe('useDragReorder', () => {
    it('tracks the dragged key and reports drag/over state', () => {
        const { result } = renderHook(() => useDragReorder(vi.fn()));

        act(() => result.current.source('a').onDragStart(dragEvent()));
        expect(result.current.isDragging('a')).toBe(true);

        act(() => result.current.target('b').onDragEnter());
        expect(result.current.isOver('b')).toBe(true);
        // The source is never its own drop target.
        expect(result.current.isOver('a')).toBe(false);
    });

    it('fires onReorder on drop over a different key, then clears', () => {
        const onReorder = vi.fn();
        const { result } = renderHook(() => useDragReorder(onReorder));

        act(() => result.current.source('a').onDragStart(dragEvent()));
        act(() => result.current.target('b').onDrop(dragEvent()));

        expect(onReorder).toHaveBeenCalledWith('a', 'b');
        expect(result.current.isDragging('a')).toBe(false);
    });

    it('does not reorder when dropping onto the source itself', () => {
        const onReorder = vi.fn();
        const { result } = renderHook(() => useDragReorder(onReorder));

        act(() => result.current.source('a').onDragStart(dragEvent()));
        act(() => result.current.target('a').onDrop(dragEvent()));

        expect(onReorder).not.toHaveBeenCalled();
    });

    it('sets a custom drag image from the given ancestor selector', () => {
        const { result } = renderHook(() => useDragReorder(vi.fn()));
        const ghost = Object.assign(document.createElement('div'), {
            getBoundingClientRect: () => ({ left: 4, top: 6 }) as DOMRect,
        });
        const event = dragEvent({
            closest: () => ghost,
        } as Partial<HTMLElement>);

        act(() =>
            result.current
                .source('a', { dragImageSelector: '.card' })
                .onDragStart(event),
        );

        expect(event.dataTransfer.setDragImage).toHaveBeenCalledWith(
            ghost,
            6,
            14,
        );
    });
});
