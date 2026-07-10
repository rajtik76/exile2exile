import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import ReferencePicker from '@/components/planner/ReferencePicker';

afterEach(() => vi.unstubAllGlobals());

/** Stub fetch, recording every requested URL; every call resolves to an empty result. */
function captureFetch(): string[] {
    const urls: string[] = [];

    vi.stubGlobal(
        'fetch',
        vi.fn((url: string | URL) => {
            urls.push(String(url));

            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ results: [] }),
            } as Response);
        }),
    );

    return urls;
}

test('a locked picker searches its lockType even after the lock changes', async () => {
    const urls = captureFetch();
    const props = { onPick: () => {}, onClose: () => {}, placeholder: 'find' };

    const { rerender, getByPlaceholderText } = render(
        <ReferencePicker lockType="base" {...props} />,
    );

    // The slot toggled base -> unique. The picker stays mounted, so its internal filter
    // state is stale - the lock must still win, or an equipment slot leaks gems (a typeless
    // request returns gems + runes + uniques).
    rerender(<ReferencePicker lockType="unique" {...props} />);

    fireEvent.change(getByPlaceholderText('find'), {
        target: { value: 'life' },
    });

    await waitFor(() =>
        expect(urls.some((url) => url.includes('type=unique'))).toBe(true),
    );

    // Never the stale base type, and never a typeless request (which would return gems).
    expect(urls.every((url) => url.includes('type='))).toBe(true);
    expect(urls.some((url) => url.includes('type=base'))).toBe(false);
});

test('an unlocked picker defaults to a typeless (all) search', async () => {
    const urls = captureFetch();

    const { getByPlaceholderText } = render(
        <ReferencePicker
            onPick={() => {}}
            onClose={() => {}}
            placeholder="find"
        />,
    );

    fireEvent.change(getByPlaceholderText('find'), {
        target: { value: 'ice' },
    });

    await waitFor(() => expect(urls.length).toBeGreaterThan(0));

    // No lock, no filter chosen → "all", so no type param (server searches gems/runes/uniques).
    expect(urls.every((url) => !url.includes('type='))).toBe(true);
});
