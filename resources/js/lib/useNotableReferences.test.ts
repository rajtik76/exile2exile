import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refKey } from '@/lib/planReferences';

vi.mock('@/lib/csrf', () => ({ xsrfToken: () => 'token' }));
vi.mock('@/routes/planner/references', () => ({
    resolve: { url: () => '/planner/references' },
}));

import { useNotableReferences } from '@/lib/useNotableReferences';

function mockReferencesResponse(body: unknown, ok = true): void {
    vi.stubGlobal(
        'fetch',
        vi.fn(() =>
            Promise.resolve({
                ok,
                json: () => Promise.resolve(body),
            } as Response),
        ),
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('useNotableReferences', () => {
    it('fetches missing names and returns the resolved references', async () => {
        const reference = { name: 'Fury', icon: '/fury.webp', description: '' };
        mockReferencesResponse({
            references: { [refKey('notable', 'Fury')]: reference },
        });

        const { result } = renderHook(() => useNotableReferences(['Fury']));

        await waitFor(() => expect(result.current.Fury).toEqual(reference));
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('makes no request when there are no names to resolve', () => {
        mockReferencesResponse({ references: {} });

        renderHook(() => useNotableReferences(['', '']));

        expect(fetch).not.toHaveBeenCalled();
    });

    it('returns nothing and does not throw when the endpoint fails', async () => {
        mockReferencesResponse({}, false);

        const { result } = renderHook(() =>
            useNotableReferences(['Unresolved-Name']),
        );

        // A non-ok response yields an empty reference map; the name stays unresolved.
        await waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(result.current['Unresolved-Name']).toBeUndefined();
    });
});
