import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import SlotEditor from '@/components/planner/equipment/SlotEditor';
import { ModsProvider } from '@/components/planner/ModsContext';
import { ReferencesProvider } from '@/components/planner/ReferencesContext';
import { refKey } from '@/lib/planReferences';
import type { ReferenceMap } from '@/lib/planReferences';
import { EQUIPMENT_SLOTS } from '@/types/planner';
import type { ItemPlan } from '@/types/planner';

const slot = EQUIPMENT_SLOTS.find((s) => s.key === 'body')!;

const references: ReferenceMap = {
    [refKey('unique', 'Constricting Command')]: {
        type: 'unique',
        id: 'Constricting Command',
        name: 'Constricting Command',
        category: 'Unique Body Armour',
        implicits: [],
        implicitLines: [],
        modLines: [
            {
                key: '+# to maximum Life',
                template: '+(80-120) to maximum Life',
                rolls: [{ min: 80, max: 120 }],
            },
        ],
    },
    [refKey('base', 'Strider Vest')]: {
        type: 'base',
        id: 'Strider Vest',
        name: 'Strider Vest',
        category: 'Body Armour',
        implicits: [],
        armour: {
            armour: 0,
            evasion: 366,
            energyShield: 0,
            ward: 0,
            block: 0,
        },
    },
    [refKey('base', 'Makeshift Crossbow')]: {
        type: 'base',
        id: 'Makeshift Crossbow',
        name: 'Makeshift Crossbow',
        category: 'Crossbow',
        implicits: [],
        weapon: {
            damageMin: 7,
            damageMax: 12,
            critical: 500,
            attackTime: 625,
            rangeMax: 120,
            reloadTime: 800,
        },
        spirit: 0,
    },
};

function itemWith(overrides: Partial<ItemPlan> = {}): ItemPlan {
    return {
        rarity: 'unique',
        base: { type: 'unique', id: 'Constricting Command' },
        name: '',
        corrupted: false,
        itemLevel: null,
        props: { quality: 0, armour: 0, evasion: 0, energyShield: 0, block: 0 },
        stats: [],
        uniqueMods: [{ key: '+# to maximum Life', values: [100] }],
        sockets: [],
        priority: null,
        ...overrides,
    };
}

function renderEditor(
    item: ItemPlan,
    handlers: {
        onChange?: (item: ItemPlan) => void;
        onClear?: () => void;
        onClose?: () => void;
    } = {},
) {
    return render(
        <ReferencesProvider map={references}>
            <ModsProvider map={{}}>
                <SlotEditor
                    slot={slot}
                    item={item}
                    onChange={handlers.onChange ?? vi.fn()}
                    onClear={handlers.onClear ?? vi.fn()}
                    onClose={handlers.onClose ?? vi.fn()}
                />
            </ModsProvider>
        </ReferencesProvider>,
    );
}

test('Done is enabled and the lock fieldsets are open while every value is valid', () => {
    renderEditor(itemWith());

    expect(screen.getByText('Done').closest('button')?.disabled).toBe(false);

    // Modal portals its content to document.body, not the render container - query
    // there for anything outside the returned `container`.
    for (const fieldset of document.querySelectorAll('fieldset')) {
        expect(fieldset.disabled).toBe(false);
    }
});

test('an invalid unique-mod value disables Done and locks both fieldsets', () => {
    renderEditor(itemWith());

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9' } });

    expect(screen.getByText('Done').closest('button')?.disabled).toBe(true);

    // jsdom doesn't implement the fieldset-disables-descendants cascade (real browsers
    // do - see the comment on SlotEditor's fieldsets), so this asserts the fieldsets'
    // own `disabled` state - the thing that actually locks Corrupted/Change/sockets/etc.
    const fieldsets = document.querySelectorAll('fieldset');
    expect(fieldsets.length).toBe(2);

    for (const fieldset of fieldsets) {
        expect(fieldset.disabled).toBe(true);
    }

    // The field the author is actively trying to fix must never itself be inside a
    // locked fieldset - that would trap them with no way to correct it.
    expect(input.closest('fieldset')).toBeNull();
    expect(input.disabled).toBe(false);
});

test('Clear slot always works, even with an invalid value pending', () => {
    const onClear = vi.fn();
    renderEditor(itemWith(), { onClear });

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9' } });

    fireEvent.click(screen.getByText('Clear slot'));

    expect(onClear).toHaveBeenCalled();
});

test('closing (✕) with an invalid value on an already-configured item just closes, does not clear', () => {
    const onClose = vi.fn();
    const onClear = vi.fn();
    renderEditor(itemWith(), { onClose, onClear });

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9' } });

    fireEvent.click(screen.getByTitle('Close editor'));

    expect(onClose).toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
});

test('closing (✕) with an invalid value on a freshly opened empty slot clears instead', () => {
    const onClose = vi.fn();
    const onClear = vi.fn();

    // No base picked yet when this editor session first mounted - `openedEmpty` captures
    // that once, at mount, and keeps it even as `item` is later updated by the parent
    // (exactly what pickBase() does: it flows a new item back down as a prop, it never
    // remounts the editor) - so re-rendering with a base now set must still count as
    // "opened empty" for the purposes of what closing does next.
    const { rerender } = renderEditor(
        itemWith({ base: null, uniqueMods: [] }),
        {
            onClose,
            onClear,
        },
    );

    rerender(
        <ReferencesProvider map={references}>
            <ModsProvider map={{}}>
                <SlotEditor
                    slot={slot}
                    item={itemWith({ uniqueMods: [] })}
                    onChange={vi.fn()}
                    onClear={onClear}
                    onClose={onClose}
                />
            </ModsProvider>
        </ReferencesProvider>,
    );

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.click(screen.getByTitle('Close editor'));

    expect(onClear).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
});

test('a pure-evasion base only shows the Evasion property field, not Armour or Energy Shield', () => {
    renderEditor(
        itemWith({
            rarity: 'normal',
            base: { type: 'base', id: 'Strider Vest' },
            uniqueMods: [],
        }),
    );

    expect(screen.getByText('Quality')).toBeTruthy();
    expect(screen.getByText('Evasion')).toBeTruthy();
    expect(screen.queryByText('Armour')).toBeNull();
    expect(screen.queryByText('Energy Shield')).toBeNull();
});

test('an unresolved/unique base shows every property field (no defensive data to gate on)', () => {
    renderEditor(itemWith());

    expect(screen.getByText('Quality')).toBeTruthy();
    expect(screen.getByText('Armour')).toBeTruthy();
    expect(screen.getByText('Evasion')).toBeTruthy();
    expect(screen.getByText('Energy Shield')).toBeTruthy();
});

test('a weapon base shows its derived weapon-stat lines, read-only', () => {
    renderEditor(
        itemWith({
            rarity: 'normal',
            base: { type: 'base', id: 'Makeshift Crossbow' },
            uniqueMods: [],
        }),
    );

    expect(screen.getByText('Physical Damage')).toBeTruthy();
    expect(screen.getByText('7-12')).toBeTruthy();
    expect(screen.getByText('Critical Hit Chance')).toBeTruthy();
    expect(screen.getByText('5.00%')).toBeTruthy();
    expect(screen.getByText('Reload Time')).toBeTruthy();
    expect(screen.getByText('0.80 sec')).toBeTruthy();
});

test('a non-weapon base shows no weapon-stat section', () => {
    renderEditor(
        itemWith({
            rarity: 'normal',
            base: { type: 'base', id: 'Strider Vest' },
            uniqueMods: [],
        }),
    );

    expect(screen.queryByText('Physical Damage')).toBeNull();
    expect(screen.queryByText('Critical Hit Chance')).toBeNull();
});

test('the Item lvl field commits a clamped item level, and clearing it unsets it', () => {
    const onChange = vi.fn();
    renderEditor(itemWith(), { onChange });

    const input = screen
        .getByText('Item lvl')
        .closest('label')!
        .querySelector('input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '82' } });
    expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ itemLevel: 82 }),
    );

    // Above the cap the committed value clamps to 100.
    fireEvent.change(input, { target: { value: '250' } });
    expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ itemLevel: 100 }),
    );
});

test('clearing the Item lvl field stores null, not 0', () => {
    const onChange = vi.fn();
    renderEditor(itemWith({ itemLevel: 82 }), { onChange });

    const input = screen
        .getByText('Item lvl')
        .closest('label')!
        .querySelector('input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ itemLevel: null }),
    );
});

afterEach(() => vi.unstubAllGlobals());

test('switching to a pure-evasion base clears a stale Armour value the old base had, immediately - not just at save time', async () => {
    // A defence value the new base doesn't have would otherwise survive as a stale,
    // now-hidden number (propFields gates its input out, so there'd be no way to fix
    // it in the editor) until the next save silently clamps it server-side - pickBase
    // must clear it itself, the moment the base changes, so the editor never shows a
    // wrong value even transiently.
    vi.stubGlobal(
        'fetch',
        vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        results: [
                            {
                                type: 'base',
                                id: 'Strider Vest',
                                name: 'Strider Vest',
                                category: 'Body Armour',
                                implicits: [],
                                armour: {
                                    armour: 0,
                                    evasion: 366,
                                    energyShield: 0,
                                    ward: 0,
                                    block: 0,
                                },
                            },
                        ],
                    }),
            } as Response),
        ),
    );

    const onChange = vi.fn();

    renderEditor(
        itemWith({
            rarity: 'normal',
            base: { type: 'base', id: 'Some Hybrid Base' },
            uniqueMods: [],
            props: {
                quality: 0,
                armour: 40,
                evasion: 10,
                energyShield: 0,
                block: 0,
            },
        }),
        { onChange },
    );

    fireEvent.click(screen.getByText('Change'));
    fireEvent.change(screen.getByPlaceholderText(/find a/i), {
        target: { value: 'Strider' },
    });

    const option = await screen.findByText('Strider Vest');
    fireEvent.click(option);

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const committed = onChange.mock.calls.at(-1)![0] as ItemPlan;

    expect(committed.props).toEqual({
        quality: 0,
        armour: 0,
        evasion: 10,
        energyShield: 0,
        block: 0,
    });
});
