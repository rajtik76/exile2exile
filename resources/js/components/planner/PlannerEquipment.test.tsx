import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import PlannerEquipment from '@/components/planner/PlannerEquipment';
import { ReferencesProvider } from '@/components/planner/ReferencesContext';
import type { ReferenceMap } from '@/lib/planReferences';
import type { ItemPlan } from '@/types/planner';

const references: ReferenceMap = {
    'unique:Bramblejack': {
        type: 'unique',
        id: 'Bramblejack',
        name: 'Bramblejack',
        icon: '/icons/poe2/bramblejack.png',
        category: 'Unique Body Armour',
        flavour: 'It is safer to be feared than to be loved.',
    },
};

test('renders a filled slot with the resolved item icon', () => {
    const slots: Record<string, ItemPlan> = {
        body: {
            rarity: 'unique',
            base: { type: 'unique', id: 'Bramblejack' },
            name: '',
            corrupted: false,
            props: {
                quality: 0,
                armour: 0,
                evasion: 0,
                energyShield: 0,
                block: 0,
            },
            stats: [],
            uniqueMods: [],
            sockets: [],
            priority: null,
        },
    };

    const { container } = render(
        <ReferencesProvider map={references}>
            <PlannerEquipment editable={false} slots={slots} />
        </ReferencesProvider>,
    );

    const icon = container.querySelector('img');
    expect(icon?.getAttribute('src')).toBe('/icons/poe2/bramblejack.png');
    // Empty slots still show their labels.
    expect(screen.getByText('Helmet')).toBeTruthy();
});

test('a unique item shows its flavour text in the tooltip', () => {
    const slots: Record<string, ItemPlan> = {
        body: {
            rarity: 'unique',
            base: { type: 'unique', id: 'Bramblejack' },
            name: '',
            corrupted: false,
            props: {
                quality: 0,
                armour: 0,
                evasion: 0,
                energyShield: 0,
                block: 0,
            },
            stats: [],
            uniqueMods: [],
            sockets: [],
            priority: null,
        },
    };

    render(
        <ReferencesProvider map={references}>
            <PlannerEquipment editable={false} slots={slots} />
        </ReferencesProvider>,
    );

    // The flavour appears in both the paper-doll tile tooltip and the priority-strip
    // miniature tooltip, so there may be more than one.
    expect(
        screen.getAllByText('It is safer to be feared than to be loved.')
            .length,
    ).toBeGreaterThan(0);
});

test('an empty doll shows a label for every slot', () => {
    render(
        <ReferencesProvider map={{}}>
            <PlannerEquipment editable={false} slots={{}} />
        </ReferencesProvider>,
    );

    expect(screen.getByText('Body Armour')).toBeTruthy();
    expect(screen.getByText('Boots')).toBeTruthy();
});

/** Open the slot editor for the tile carrying the given label. */
function openSlotEditor(label: string): void {
    render(
        <ReferencesProvider map={{}}>
            <PlannerEquipment editable slots={{}} onChange={() => {}} />
        </ReferencesProvider>,
    );

    // "Ring" labels two tiles (ring1/ring2); the first is enough to open one.
    fireEvent.click(screen.getAllByText(label)[0]);
}

test('a socketable slot offers rune sockets in the editor', () => {
    openSlotEditor('Weapon');

    expect(screen.getByText('Rune sockets')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Socket' })).toBeTruthy();
});

test.each(['Amulet', 'Ring', 'Belt'])(
    'a %s slot hides rune sockets in the editor',
    (label) => {
        openSlotEditor(label);

        expect(screen.queryByText('Rune sockets')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Socket' })).toBeNull();
    },
);

// A no-icon reference so the filled tile renders its name as clickable text.
const textRefs: ReferenceMap = {
    'unique:Bramblejack': {
        type: 'unique',
        id: 'Bramblejack',
        name: 'Bramblejack',
        category: 'Unique Body Armour',
    },
};

test('the editor refuses to close on an illegal item', () => {
    // A unique carrying an author modifier is illegal - opening its slot and trying
    // to close must keep the editor up with the reason shown.
    const slots: Record<string, ItemPlan> = {
        body: {
            rarity: 'unique',
            base: { type: 'unique', id: 'Bramblejack' },
            name: '',
            corrupted: false,
            props: {
                quality: 0,
                armour: 0,
                evasion: 0,
                energyShield: 0,
                block: 0,
            },
            stats: [{ modId: 'IncreasedLife1', values: [100] }],
            uniqueMods: [],
            sockets: [],
            priority: null,
        },
    };

    render(
        <ReferencesProvider map={textRefs}>
            <PlannerEquipment editable slots={slots} onChange={() => {}} />
        </ReferencesProvider>,
    );

    fireEvent.click(screen.getAllByText('Bramblejack')[0]);

    expect(
        screen.getByText(
            'A unique item carries its own modifiers and cannot add more.',
        ),
    ).toBeTruthy();

    const done = screen.getByText('Done').closest('button');
    expect(done?.disabled).toBe(true);

    // Clicking Done leaves the editor open (Properties section still present).
    fireEvent.click(screen.getByText('Done'));
    expect(screen.getByText('Properties')).toBeTruthy();
});

test('the editor closes on a legal item', () => {
    const slots: Record<string, ItemPlan> = {
        body: {
            rarity: 'rare',
            base: { type: 'unique', id: 'Bramblejack' },
            name: '',
            corrupted: false,
            props: {
                quality: 0,
                armour: 0,
                evasion: 0,
                energyShield: 0,
                block: 0,
            },
            stats: [],
            uniqueMods: [],
            sockets: [],
            priority: null,
        },
    };

    render(
        <ReferencesProvider map={textRefs}>
            <PlannerEquipment editable slots={slots} onChange={() => {}} />
        </ReferencesProvider>,
    );

    fireEvent.click(screen.getAllByText('Bramblejack')[0]);
    expect(screen.getByText('Properties')).toBeTruthy();

    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Properties')).toBeNull();
});
