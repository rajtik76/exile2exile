import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DEFAULT_GEMS_VIEW, loadGemsView, saveGemsView } from '@/lib/gemsView';

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

test('loads the default view when nothing is stored', () => {
    expect(loadGemsView()).toBe(DEFAULT_GEMS_VIEW);
});

test('saves and reloads the chosen view', () => {
    saveGemsView('list');
    expect(loadGemsView()).toBe('list');

    saveGemsView('grid');
    expect(loadGemsView()).toBe('grid');
});

test('falls back to the default for an unrecognised stored value', () => {
    window.localStorage.setItem('planner-gems-view', 'nonsense');
    expect(loadGemsView()).toBe(DEFAULT_GEMS_VIEW);
});

test('falls back to the default when storage reads throw (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
    });

    expect(loadGemsView()).toBe(DEFAULT_GEMS_VIEW);
});

test('swallows a storage write failure without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
    });

    expect(() => saveGemsView('list')).not.toThrow();
});
