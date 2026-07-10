import { describe, expect, it } from 'vitest';
import { arrayMove, moveById } from '@/lib/reorder';

describe('arrayMove', () => {
    it('moves an item forward, shifting the rest', () => {
        expect(arrayMove(['a', 'b', 'c', 'd'], 1, 3)).toEqual([
            'a',
            'c',
            'd',
            'b',
        ]);
    });

    it('moves an item backward', () => {
        expect(arrayMove(['a', 'b', 'c', 'd'], 3, 0)).toEqual([
            'd',
            'a',
            'b',
            'c',
        ]);
    });

    it('returns the same array reference when the move is a no-op', () => {
        const list = ['a', 'b', 'c'];

        expect(arrayMove(list, 1, 1)).toBe(list);
    });

    it('ignores out-of-range indices', () => {
        const list = ['a', 'b'];

        expect(arrayMove(list, -1, 1)).toBe(list);
        expect(arrayMove(list, 0, 5)).toBe(list);
    });

    it('does not mutate the input', () => {
        const list = ['a', 'b', 'c'];
        arrayMove(list, 0, 2);

        expect(list).toEqual(['a', 'b', 'c']);
    });
});

describe('moveById', () => {
    const items = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];

    it('moves the item with the given id to the target slot', () => {
        expect(moveById(items, (item) => item.id, 'x', 'z')).toEqual([
            { id: 'y' },
            { id: 'z' },
            { id: 'x' },
        ]);
    });

    it('is a no-op for an unknown id', () => {
        expect(moveById(items, (item) => item.id, 'nope', 'z')).toBe(items);
    });
});
