import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import DroppedModsNotice from '@/components/planner/DroppedModsNotice';

test('lists dropped mods grouped by item label, line by line', () => {
    render(
        <DroppedModsNotice
            dropped={{
                gloves: ['135% increased Armour and Evasion'],
                helmet: ['+34% to Cold Resistance', '+12 to Dexterity'],
            }}
            onDismiss={() => {}}
        />,
    );

    // Slot keys render as their paper-doll labels, each line shown verbatim.
    expect(screen.getByText('Gloves')).toBeTruthy();
    expect(screen.getByText('Helmet')).toBeTruthy();
    expect(screen.getByText('135% increased Armour and Evasion')).toBeTruthy();
    expect(screen.getByText('+34% to Cold Resistance')).toBeTruthy();
    // The count spans every item's lines.
    expect(
        screen.getByText(/3 unique modifiers couldn't be imported/),
    ).toBeTruthy();
});

test('dismiss button fires onDismiss', () => {
    const onDismiss = vi.fn();
    render(
        <DroppedModsNotice
            dropped={{ gloves: ['135% increased Armour and Evasion'] }}
            onDismiss={onDismiss}
        />,
    );

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledOnce();
});

test('renders nothing when there is nothing to report', () => {
    const { container } = render(
        <DroppedModsNotice dropped={{}} onDismiss={() => {}} />,
    );

    expect(container.firstChild).toBeNull();
});
