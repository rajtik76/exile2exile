import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

const page = { props: {} as Record<string, unknown> };

vi.mock('@inertiajs/react', () => ({
    usePage: () => page,
    usePoll: vi.fn(),
}));

import { PatchStatusPanel, PatchStatusWidget } from './patch-status';

const PATCH = {
    version: '0.5.5.10',
    releasedAt: '2026-07-07T12:00:00Z',
    checkedAt: '2026-07-10T11:58:00Z',
};

beforeEach(() => {
    page.props = {};
});

test('the footer widget shows the latest patch and flags stale data', () => {
    page.props = { patch: PATCH, dataVersion: '0.5.5.4.2' };

    render(<PatchStatusWidget />);

    expect(screen.getByText(/0\.5\.5\.10/)).toBeTruthy();
    expect(screen.getByText('0.5.5.4.2')).toBeTruthy();
    expect(screen.getByText('behind')).toBeTruthy();
});

test('the footer widget flags data built from the latest patch as current', () => {
    page.props = { patch: PATCH, dataVersion: PATCH.version };

    render(<PatchStatusWidget />);

    expect(screen.getByText('current')).toBeTruthy();
});

test('the footer widget stays up before the first patch poll', () => {
    page.props = { dataVersion: '0.5.5.4.2' };

    render(<PatchStatusWidget />);

    expect(screen.getByText('PoE2 patch not checked yet')).toBeTruthy();
    expect(screen.getByText('0.5.5.4.2')).toBeTruthy();
    // Nothing to compare the data with yet, so it carries no flag.
    expect(screen.queryByText('behind')).toBeNull();
    expect(screen.queryByText('current')).toBeNull();
});

test('the footer widget shows a dash when the data version is unknown too', () => {
    render(<PatchStatusWidget />);

    expect(screen.getByText('PoE2 patch not checked yet')).toBeTruthy();
    expect(screen.getByText('-')).toBeTruthy();
});

test('the status strip renders nothing before the first patch poll', () => {
    page.props = { dataVersion: '0.5.5.4.2' };

    const { container } = render(<PatchStatusPanel />);

    expect(container.firstChild).toBeNull();
});
