import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import SharePanel from '@/components/planner/SharePanel';

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

test('shows the public link, edit link, masked token and the danger zone', () => {
    render(
        <SharePanel
            publicUrl="/t/abc123"
            editUrl="/build-planner/abc123/edit"
            editToken="s3cr3t-token"
            slug="abc123"
        />,
    );

    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Token')).toBeTruthy();
    // The token starts masked - shoulder-surf safe - and reveals on click.
    expect(screen.queryByText('s3cr3t-token')).toBeNull();
    fireEvent.click(screen.getByTitle('Reveal token'));
    expect(screen.getByText('s3cr3t-token')).toBeTruthy();
    // The delete action lives in the panel's danger footer.
    expect(screen.getByRole('button', { name: 'Delete build' })).toBeTruthy();
});

test('hides the edit link, token and danger zone when they are absent', () => {
    render(
        <SharePanel
            publicUrl="/t/abc123"
            editUrl={null}
            editToken={null}
            slug={null}
        />,
    );

    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Token')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete build' })).toBeNull();
});

test('copies the token verbatim (no origin prefix) to the clipboard', () => {
    render(
        <SharePanel
            publicUrl="/t/abc123"
            editUrl="/build-planner/abc123/edit"
            editToken="s3cr3t-token"
            slug="abc123"
        />,
    );

    // The three Copy buttons, in row order: public, edit link, token.
    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    fireEvent.click(copyButtons[2]);

    expect(writeText).toHaveBeenCalledWith('s3cr3t-token');
});

test('copies a link as an absolute URL', () => {
    render(
        <SharePanel
            publicUrl="/t/abc123"
            editUrl={null}
            editToken={null}
            slug={null}
        />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/t/abc123`,
    );
});

test('deleting asks for the token before it can be confirmed', () => {
    render(
        <SharePanel
            publicUrl="/t/abc123"
            editUrl="/build-planner/abc123/edit"
            editToken="s3cr3t-token"
            slug="abc123"
        />,
    );

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
