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

test('a unique reference shows its flavour text via the same card an equipped item uses', () => {
    render(
        <ReferencesProvider map={BRAMBLEJACK}>
            <RichText text="Aim for {{unique:Bramblejack|Bramblejack}}." />
        </ReferencesProvider>,
    );

    // The tooltip is portalled and cursor-tracked (not always in the DOM like the
    // paper-doll's HoverTooltip) - see RefChip's own doc comment for why a unique's
    // text reference can't reuse HoverTooltip's in-place positioning.
    const chip = screen.getAllByText('Bramblejack')[0];
    fireEvent.mouseEnter(chip, { clientX: 10, clientY: 10 });

    expect(screen.getAllByText('Bramblejack')).toHaveLength(2);
    expect(
        screen.getByText('It is safer to be feared than to be loved.'),
    ).toBeTruthy();
});
