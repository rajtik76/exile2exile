import { render, screen } from '@testing-library/react';
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

test('a unique reference shows its flavour text via the same tooltip an equipped item uses', () => {
    render(
        <ReferencesProvider map={BRAMBLEJACK}>
            <RichText text="Aim for {{unique:Bramblejack|Bramblejack}}." />
        </ReferencesProvider>,
    );

    // The chip label and the tooltip's own title both read "Bramblejack" - the tooltip
    // is always in the DOM (CSS-hidden until hover/focus, same as the paper-doll's
    // ItemTooltip), so both are already present without simulating a hover.
    expect(screen.getAllByText('Bramblejack')).toHaveLength(2);
    expect(
        screen.getByText('It is safer to be feared than to be loved.'),
    ).toBeTruthy();
});
