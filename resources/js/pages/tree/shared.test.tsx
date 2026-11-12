import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

const originalClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    'clipboard',
);
import { JsonCopyButton } from './shared';

vi.mock('@/components/passive-tree/PassiveTreeView', () => ({
    default: () => null,
}));

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    if (originalClipboard) {
        Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
        Reflect.deleteProperty(navigator, 'clipboard');
    }
});

test('copies the JSON document and hides confirmation after three seconds', async () => {
    vi.useFakeTimers();
    const documentText = '{"class":"Witch","nodes":[123]}';
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(documentText),
        }),
    );
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
    render(<JsonCopyButton url="/t/abc.json" />);

    await act(async () => {
        fireEvent.click(
            screen.getByRole('button', { name: 'Copy build JSON' }),
        );
    });

    expect(screen.getByRole('status').textContent).toBe('JSON copied');
    expect(fetch).toHaveBeenCalledWith('/t/abc.json');
    expect(writeText).toHaveBeenCalledWith(documentText);
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByRole('status').textContent).toBe('JSON copied');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
});

test('shows failure when the JSON document cannot be loaded', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
    render(<JsonCopyButton url="/t/missing.json" />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy build JSON' }));

    await waitFor(() =>
        expect(screen.getByRole('status').textContent).toBe('Copy failed'),
    );
    expect(writeText).not.toHaveBeenCalled();
});

test('shows failure when clipboard access is denied', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('{}'),
        }),
    );
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
    });
    render(<JsonCopyButton url="/t/abc.json" />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy build JSON' }));

    expect((await screen.findByRole('status')).textContent).toBe('Copy failed');
});
