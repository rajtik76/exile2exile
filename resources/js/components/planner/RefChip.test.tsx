import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ReferencesProvider } from '@/components/planner/ReferencesContext';
import RichText from '@/components/planner/RichText';
import type { ReferenceMap } from '@/lib/planReferences';

const BRAMBLEJACK: ReferenceMap = {
    'unique:Bramblejack': {
        type: 'unique',
        id: 'Bramblejack',
        name: 'Bramblejack',
        icon: '/icons/poe2/bramblejack.png',
        category: 'Unique Body Armour',
        flavour: 'It is safer to be feared than to be loved.',
    },
};

test('hovering a unique reference shows its flavour text in the tooltip', () => {
    render(
        <ReferencesProvider map={BRAMBLEJACK}>
            <RichText text="Aim for {{unique:Bramblejack|Bramblejack}}." />
        </ReferencesProvider>,
    );

    // The chip is visible; the tooltip (and its flavour) only appears on hover.
    const chip = screen.getByText('Bramblejack');
    fireEvent.mouseEnter(chip);

    expect(
        screen.getByText('It is safer to be feared than to be loved.'),
    ).toBeTruthy();
});
