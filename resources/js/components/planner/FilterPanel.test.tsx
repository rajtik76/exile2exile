import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import FilterPanel from '@/components/planner/FilterPanel';

// The embedded live preview fetches /filter/preview; stub the network so the panel
// renders standalone.
vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
);

const themes = [{ value: 'default', label: 'Default', swatch: '#c8aa6e' }];

const strictness = [
    { value: '0-soft', label: 'Soft', level: 0 },
    { value: '1-regular', label: 'Regular', level: 1 },
    { value: '6-uber-plus-strict', label: 'Uber-plus strict', level: 6 },
];

// Regular still lists gold; the strictest level has nothing left to toggle for it.
const categories = {
    '0-soft': [
        { value: 'gold-piles', label: 'Gold (small & medium piles)' },
        { value: 'jewels', label: 'Jewels' },
    ],
    '1-regular': [
        { value: 'gold-piles', label: 'Gold (small & medium piles)' },
        { value: 'jewels', label: 'Jewels' },
    ],
    '6-uber-plus-strict': [{ value: 'jewels', label: 'Jewels' }],
};

const renderPanel = () =>
    render(
        <FilterPanel
            themes={themes}
            strictness={strictness}
            categories={categories}
            buildSlug="abc123"
        />,
    );

const downloadHref = (): string =>
    screen
        .getByRole('link', { name: 'Download filter' })
        .getAttribute('href') ?? '';

test('unchecking a category in Custom adds it to the download URL', () => {
    renderPanel();

    // No off param before Custom opens.
    expect(downloadHref()).not.toContain('off=');

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.click(
        screen.getByLabelText('Gold (small & medium piles)', { exact: false }),
    );

    expect(downloadHref()).toContain('off=gold-piles');
    expect(screen.getByText('1 hidden')).toBeTruthy();
});

test('closing Custom keeps the picks but drops them from the URL', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.click(
        screen.getByLabelText('Gold (small & medium piles)', { exact: false }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));

    expect(downloadHref()).not.toContain('off=');
});

test('only the categories of the chosen strictness are listed, and stale picks leave the URL', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.click(
        screen.getByLabelText('Gold (small & medium piles)', { exact: false }),
    );

    // The strictest level has no gold blocks left: the checkbox disappears and the
    // pick no longer reaches the URL.
    fireEvent.click(screen.getByRole('button', { name: 'Uber-plus strict' }));
    expect(
        screen.queryByLabelText('Gold (small & medium piles)', {
            exact: false,
        }),
    ).toBeNull();
    expect(downloadHref()).not.toContain('off=');

    // Back on a permissive level the pick transparently returns.
    fireEvent.click(screen.getByRole('button', { name: 'Regular' }));
    expect(downloadHref()).toContain('off=gold-piles');
});
