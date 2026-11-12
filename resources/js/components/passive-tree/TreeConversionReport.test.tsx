import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TreeConversionReport } from '@/components/passive-tree/TreeConversionReport';
import type { TreeMigrationReport } from '@/lib/treeMigration';

const report: TreeMigrationReport = {
    classMissing: false,
    ascendancyMissing: false,
    unchanged: 40,
    changed: [
        {
            id: 4,
            name: 'Heavy Blade',
            previousName: 'Sharp Blade',
            before: ['10% increased Damage'],
            after: ['8% increased Damage'],
        },
    ],
    removed: [{ id: 2, name: 'Old Notable' }],
    disconnected: [{ id: 9, name: 'Stranded' }],
};

function renderReport(overrides: Partial<TreeMigrationReport> = {}) {
    render(
        <TreeConversionReport
            source={{ gameEra: '0.4', eraName: 'The Third Edict' }}
            className="Witch"
            report={{ ...report, ...overrides }}
        />,
    );
}

test('tallies the conversion and keeps the node lists behind a toggle', () => {
    renderReport();

    expect(
        screen.getByText('Converted from PoE2 0.4 (The Third Edict)'),
    ).toBeTruthy();
    expect(
        screen.getByText(
            /40 unchanged · 1 changed · 1 no longer exist · 1 lost their path/,
        ),
    ).toBeTruthy();
    expect(screen.queryByText('Old Notable')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByText('Old Notable')).toBeTruthy();
    expect(screen.getByText('Stranded')).toBeTruthy();
    expect(screen.getByText('(was Sharp Blade)')).toBeTruthy();
    expect(screen.getByText('10% increased Damage')).toBeTruthy();
    expect(screen.getByText('8% increased Damage')).toBeTruthy();
});

test('says so when the class is gone and nothing could be carried over', () => {
    renderReport({ classMissing: true });

    expect(
        screen.getByText(/The Witch class is not in the current tree/),
    ).toBeTruthy();
});

test('can be dismissed', () => {
    renderReport();

    fireEvent.click(
        screen.getByRole('button', { name: 'Dismiss the conversion report' }),
    );

    expect(screen.queryByText(/Converted from PoE2/)).toBeNull();
});
