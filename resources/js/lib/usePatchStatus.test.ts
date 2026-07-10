import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const page = { props: {} as Record<string, unknown> };

vi.mock('@inertiajs/react', () => ({
    usePage: () => page,
    usePoll: vi.fn(),
}));

import { usePatchStatus } from '@/lib/usePatchStatus';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
    page.props = {};
});

afterEach(() => {
    vi.useRealTimers();
});

describe('usePatchStatus', () => {
    it('is null before the first patch poll', () => {
        const { result } = renderHook(() => usePatchStatus());

        expect(result.current).toBeNull();
    });

    it('computes relative times and data-currency from the shared props', () => {
        page.props = {
            patch: {
                version: '4.5.3',
                releasedAt: '2026-07-07T12:00:00Z', // 3 days ago
                checkedAt: '2026-07-10T11:59:00Z', // 1 minute ago
            },
            dataVersion: '4.5.3',
        };

        const { result } = renderHook(() => usePatchStatus());

        expect(result.current).toMatchObject({
            version: '4.5.3',
            releasedAgo: '3d ago',
            checkedAgo: '1m ago',
            isDataCurrent: true,
        });
    });

    it('flags stale data when the build version trails the release', () => {
        page.props = {
            patch: {
                version: '4.5.3',
                releasedAt: '2026-07-10T11:59:40Z',
                checkedAt: '2026-07-10T12:00:00Z',
            },
            dataVersion: '4.5.2',
        };

        const { result } = renderHook(() => usePatchStatus());

        // Under a minute reads as "just now"; the version mismatch is not current.
        expect(result.current?.releasedAgo).toBe('just now');
        expect(result.current?.isDataCurrent).toBe(false);
        expect(result.current?.dataVersion).toBe('4.5.2');
    });

    it('treats a missing dataVersion prop as not current', () => {
        page.props = {
            patch: {
                version: '4.5.3',
                releasedAt: '2026-05-10T12:00:00Z',
                checkedAt: '2026-07-10T09:00:00Z',
            },
        };

        const { result } = renderHook(() => usePatchStatus());

        // Weeks and hours format from the same helper.
        expect(result.current?.releasedAgo).toMatch(/w ago$/);
        expect(result.current?.checkedAgo).toBe('3h ago');
        expect(result.current?.isDataCurrent).toBe(false);
    });
});
