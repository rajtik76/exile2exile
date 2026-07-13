import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ItemCard } from '@/components/build/ItemDisplay';
import type { Item } from '@/components/build/ItemDisplay';

function item(overrides: Partial<Item> = {}): Item {
    return {
        slot: 'Body Armour',
        rarity: 'rare',
        name: 'Doom Shell',
        baseType: 'Expert Plate Vest',
        icon: null,
        twoHanded: false,
        corrupted: false,
        runes: [],
        implicitMods: [],
        explicitMods: [],
        ...overrides,
    };
}

test('the tooltip shows the item defensive and quality properties', () => {
    render(
        <ItemCard
            item={item({
                quality: 20,
                armour: 640,
                energyShield: 120,
                block: 25,
            })}
        />,
    );

    expect(screen.getByText('Quality:')).toBeTruthy();
    expect(screen.getByText('+20%')).toBeTruthy();
    expect(screen.getByText('Armour:')).toBeTruthy();
    expect(screen.getByText('640')).toBeTruthy();
    expect(screen.getByText('Energy Shield:')).toBeTruthy();
    expect(screen.getByText('Block:')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
});

test('a property at 0 or absent is hidden', () => {
    render(<ItemCard item={item({ armour: 500, evasion: 0 })} />);

    expect(screen.getByText('Armour:')).toBeTruthy();
    // Evasion is 0 and quality/ES/block absent, so those lines don't render.
    expect(screen.queryByText('Evasion Rating:')).toBeNull();
    expect(screen.queryByText('Quality:')).toBeNull();
});

test('holding Alt swaps the summed lines for the per-affix P/S-tier breakdown', () => {
    render(
        <ItemCard
            item={item({
                explicitMods: ['135% increased Armour and Evasion'],
                modDetails: [
                    {
                        type: 'prefix',
                        tier: 7,
                        lines: ['94(92-100)% increased Armour and Evasion'],
                    },
                    {
                        type: 'suffix',
                        tier: 6,
                        lines: ['+34(31-35)% to Cold Resistance'],
                    },
                ],
            })}
        />,
    );

    // Default: the summed line shows.
    expect(screen.getByText('135% increased Armour and Evasion')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Alt' });

    // Alt held: per-affix breakdown with P<tier>/S<tier> badges.
    expect(screen.getByText('P7')).toBeTruthy();
    expect(screen.getByText('S6')).toBeTruthy();
    expect(
        screen.getByText('94(92-100)% increased Armour and Evasion'),
    ).toBeTruthy();

    fireEvent.keyUp(window, { key: 'Alt' });
    expect(screen.queryByText('P7')).toBeNull();
});

test('a corrupted item shows the red Corrupted footer', () => {
    render(<ItemCard item={item({ corrupted: true })} />);

    expect(screen.getByText('Corrupted')).toBeTruthy();
});

test('a non-corrupted item shows no Corrupted footer', () => {
    render(<ItemCard item={item({ corrupted: false })} />);

    expect(screen.queryByText('Corrupted')).toBeNull();
});
