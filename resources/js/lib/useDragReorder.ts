import { useState } from 'react';
import type { DragEvent } from 'react';

/**
 * A small HTML5 drag-and-drop reorder helper. It tracks which key is being dragged and
 * which is hovered and hands back prop bundles for the drag source and the drop targets;
 * the caller decides what a key means (an id, an index) and applies the actual move.
 * Mirrors the hand-rolled pattern in PhaseTabs, shared so gem groups and their support
 * gems can both reorder without duplicating the event plumbing.
 */
export function useDragReorder(
    onReorder: (fromKey: string, toKey: string) => void,
) {
    const [dragKey, setDragKey] = useState<string | null>(null);
    const [overKey, setOverKey] = useState<string | null>(null);

    function clear(): void {
        setDragKey(null);
        setOverKey(null);
    }

    return {
        dragKey,
        overKey,
        /** Whether `key` is the element currently being dragged. */
        isDragging: (key: string): boolean => dragKey === key,
        /** Whether `key` is the drop target under the pointer (and not the source). */
        isOver: (key: string): boolean => overKey === key && dragKey !== key,
        /**
         * Props for the drag source - a handle, or the whole element. Pass
         * `dragImageSelector` to drag a ghost of an ancestor (e.g. the whole group
         * card) instead of the tiny handle, so the user sees what is moving.
         */
        source(key: string, options?: { dragImageSelector?: string }) {
            return {
                draggable: true as const,
                onDragStart(event: DragEvent): void {
                    event.dataTransfer.effectAllowed = 'move';
                    // Firefox won't start a drag without payload; the value is unused.
                    event.dataTransfer.setData('text/plain', key);

                    if (options?.dragImageSelector) {
                        const ghost = (
                            event.currentTarget as HTMLElement
                        ).closest(options.dragImageSelector);

                        if (ghost instanceof HTMLElement) {
                            const rect = ghost.getBoundingClientRect();
                            event.dataTransfer.setDragImage(
                                ghost,
                                event.clientX - rect.left,
                                event.clientY - rect.top,
                            );
                        }
                    }

                    setDragKey(key);
                },
                onDragEnd: clear,
            };
        },
        /** Props for a drop target. */
        target(key: string) {
            return {
                onDragEnter(): void {
                    if (dragKey) {
                        setOverKey(key);
                    }
                },
                onDragOver(event: DragEvent): void {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                },
                onDrop(event: DragEvent): void {
                    event.preventDefault();

                    if (dragKey && dragKey !== key) {
                        onReorder(dragKey, key);
                    }

                    clear();
                },
            };
        },
    };
}
