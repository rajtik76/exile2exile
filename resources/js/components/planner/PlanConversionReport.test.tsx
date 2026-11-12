import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import PlanConversionReport from '@/components/planner/PlanConversionReport';

const tree = {
    classMissing: false,
    ascendancyMissing: false,
    unchanged: 30,
    changed: [],
    removed: [{ id: 2, name: 'Old Notable', phases: ['Act III'] }],
    disconnected: [],
};

const gear = {
    removed: [
        { kind: 'gem' as const, name: 'Beta', phases: ['Act I', 'Act II'] },
    ],
    changed: [
        {
            kind: 'mod' as const,
            name: 'Hale',
            before: '+7 to maximum Life',
            after: '+10 to maximum Life',
            phases: ['Act I'],
        },
    ],
};

test('tallies the trees and the gear, with the lists behind a toggle', () => {
    render(
        <PlanConversionReport
            source={{ gameEra: '0.4', eraName: null }}
            gear={gear}
            tree={tree}
        />,
    );

    expect(screen.getByText('Converted from PoE2 0.4')).toBeTruthy();
    expect(screen.getByText(/30 unchanged · 0 changed · 1 no/)).toBeTruthy();
    expect(screen.getByText(/Gear: 1 removed · 1/)).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByText('- Act I, Act II')).toBeTruthy();
    expect(screen.getByText('+7 to maximum Life')).toBeTruthy();
    expect(screen.getByText('+10 to maximum Life')).toBeTruthy();
    expect(screen.getByText(/Old Notable/)).toBeTruthy();
    expect(screen.getByText('- Act III')).toBeTruthy();
});
