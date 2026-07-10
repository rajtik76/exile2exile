import { expect, test } from 'vitest';
import { cn, toUrl } from '@/lib/utils';

test('cn merges class lists and dedupes conflicting tailwind utilities', () => {
    const hidden = false;

    expect(cn('px-2', 'px-4')).toBe('px-4');
    // A falsy conditional class is dropped, like a real `cn(cond && '...')` call.
    expect(cn('text-sm', hidden && 'hidden', 'font-bold')).toBe(
        'text-sm font-bold',
    );
});

test('toUrl reads a string href as-is and unwraps an object href', () => {
    expect(toUrl('/planner')).toBe('/planner');
    expect(toUrl({ url: '/tree', method: 'get' })).toBe('/tree');
});
