import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTheme, useAppearance } from '@/hooks/use-appearance';

function stubPrefersDark(matches: boolean): void {
    vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
            matches,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    );
}

beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    stubPrefersDark(false);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('initializeTheme', () => {
    it('seeds the default appearance and applies the resolved theme', () => {
        stubPrefersDark(true);

        initializeTheme();

        expect(localStorage.getItem('appearance')).toBe('system');
        // system + prefers-dark resolves to the dark class on <html>.
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});

describe('useAppearance', () => {
    it('exposes the current appearance and its resolved light/dark value', () => {
        stubPrefersDark(false);
        initializeTheme();

        const { result } = renderHook(() => useAppearance());

        expect(result.current.appearance).toBe('system');
        expect(result.current.resolvedAppearance).toBe('light');
    });

    it('updates, persists and applies a chosen appearance', () => {
        initializeTheme();
        const { result } = renderHook(() => useAppearance());

        act(() => result.current.updateAppearance('dark'));

        expect(result.current.appearance).toBe('dark');
        expect(result.current.resolvedAppearance).toBe('dark');
        expect(localStorage.getItem('appearance')).toBe('dark');
        expect(document.cookie).toContain('appearance=dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});
