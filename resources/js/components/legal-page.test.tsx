import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { LegalPage } from '@/components/legal-page';

vi.mock('@inertiajs/react', () => ({ Head: () => null }));

afterEach(() => {
    vi.useRealTimers();
});

test('a dated page shows today as its last update', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-03-04T12:00:00Z'));

    render(
        <LegalPage title="Privacy Policy" dated>
            body
        </LegalPage>,
    );

    screen.getByText('Last updated March 4, 2027');
});

test('an undated page shows no update line', () => {
    render(<LegalPage title="PoE2 patch webhook">body</LegalPage>);

    expect(screen.queryByText(/Last updated/)).toBeNull();
});
