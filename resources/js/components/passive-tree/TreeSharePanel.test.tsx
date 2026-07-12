import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import TreeSharePanel from '@/components/passive-tree/TreeSharePanel';

// The panel reads page-level errors (a failed delete after a full reload); outside a
// real Inertia page there is none, so stub an empty error bag.
vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    usePage: () => ({ props: { errors: {} } }),
}));

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
});

function renderPanel(onClose = vi.fn()) {
    render(
        <TreeSharePanel
            slug="abc123XYZ789"
            editToken="s3cr3t-token"
            onClose={onClose}
        />,
    );

    return onClose;
}

test('shows the public link, edit link, masked token and the danger zone', () => {
    renderPanel();

    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Token')).toBeTruthy();
    // Both links resolve to absolute URLs of the saved build.
    expect(
        screen.getByText(`${window.location.origin}/t/abc123XYZ789`),
    ).toBeTruthy();
    expect(
        screen.getByText(`${window.location.origin}/t/abc123XYZ789/edit`),
    ).toBeTruthy();
    // The token starts masked - shoulder-surf safe - and reveals on click.
    expect(screen.queryByText('s3cr3t-token')).toBeNull();
    fireEvent.click(screen.getByTitle('Reveal token'));
    expect(screen.getByText('s3cr3t-token')).toBeTruthy();
    // The delete action lives in the panel's danger footer.
    expect(screen.getByRole('button', { name: 'Delete build' })).toBeTruthy();
});

test('copies a link as an absolute URL and the token verbatim', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Copy public link' }));
    expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/t/abc123XYZ789`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy edit link' }));
    expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/t/abc123XYZ789/edit`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy edit token' }));
    expect(writeText).toHaveBeenCalledWith('s3cr3t-token');
});

test('falls back to execCommand when the clipboard API is unavailable', () => {
    // Insecure origins and older embeds have no navigator.clipboard at all.
    Object.assign(navigator, { clipboard: undefined });
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand as never;

    renderPanel();

    const button = screen.getByRole('button', { name: 'Copy public link' });

    fireEvent.click(button);

    expect(execCommand).toHaveBeenCalledWith('copy');
    // The button reports success, so the author knows the link is in hand.
    expect(button.textContent).toBe('Copied ✓');
});

test('closes from its header button', () => {
    const onClose = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Close build links' }));

    expect(onClose).toHaveBeenCalledOnce();
});

test('deleting asks for the token before it can be confirmed', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Delete build' }));

    // The confirm button stays disabled until the token is re-typed.
    const confirm = screen.getByRole('button', {
        name: 'Delete for good',
    }) as HTMLButtonElement;

    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Edit token…'), {
        target: { value: 's3cr3t-token' },
    });
    expect(confirm.disabled).toBe(false);

    // The typed token can be revealed to check for paste mistakes.
    const input = screen.getByPlaceholderText(
        'Edit token…',
    ) as HTMLInputElement;

    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(input.type).toBe('text');

    // A declined native confirm is the final stop - nothing is deleted.
    const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(confirm);
    expect(nativeConfirm).toHaveBeenCalledOnce();
    nativeConfirm.mockRestore();

    // Cancel folds the confirm back into the quiet danger strip.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete build' })).toBeTruthy();
});
