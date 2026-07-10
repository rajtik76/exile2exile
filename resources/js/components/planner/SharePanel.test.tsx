import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import SharePanel from '@/components/planner/SharePanel';

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
});

test('shows the public link, edit link and the secret token', () => {
    render(
        <SharePanel
            publicUrl="/t/abc123"
            editUrl="/build-planner/abc123/edit"
            editToken="s3cr3t-token"
        />,
    );

    expect(screen.getByText('Public link')).toBeTruthy();
    expect(screen.getByText('Edit link')).toBeTruthy();
    expect(screen.getByText('Edit token')).toBeTruthy();
    // The token is rendered verbatim so the author can copy it.
    expect(screen.getByText('s3cr3t-token')).toBeTruthy();
});

test('hides the edit link and token when they are absent', () => {
    render(
        <SharePanel publicUrl="/t/abc123" editUrl={null} editToken={null} />,
    );

    expect(screen.getByText('Public link')).toBeTruthy();
    expect(screen.queryByText('Edit link')).toBeNull();
    expect(screen.queryByText('Edit token')).toBeNull();
});

test('copies the token verbatim (no origin prefix) to the clipboard', () => {
    render(
        <SharePanel
            publicUrl="/t/abc123"
            editUrl="/build-planner/abc123/edit"
            editToken="s3cr3t-token"
        />,
    );

    // The three Copy buttons, in row order: public, edit link, token.
    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    fireEvent.click(copyButtons[2]);

    expect(writeText).toHaveBeenCalledWith('s3cr3t-token');
});

test('copies a link as an absolute URL', () => {
    render(
        <SharePanel publicUrl="/t/abc123" editUrl={null} editToken={null} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/t/abc123`,
    );
});
