import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { HoverTooltip, ItemCard } from '@/components/build/ItemDisplay';
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

/**
 * A centre-column paper-doll slot (helmet, body armour, belt, the middle
 * charm) has no `align`, so its tooltip falls into HoverTooltip's own
 * side-detection - which used to only ever choose left or right. On a phone,
 * where the panel's 26rem floor is wider than the whole viewport, neither
 * side ever fit; it now falls back to above/below instead.
 */
function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: height,
    });
}

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

test('HoverTooltip falls back to below the trigger when neither side has room', () => {
    setViewport(375, 700);
    Element.prototype.getBoundingClientRect = () =>
        ({
            top: 300,
            bottom: 340,
            left: 170,
            right: 205,
            width: 35,
            height: 40,
            x: 170,
            y: 300,
            toJSON() {},
        }) as DOMRect;

    render(
        <div className="group">
            <HoverTooltip show="group-hover:block">Tooltip body</HoverTooltip>
        </div>,
    );

    const panel = screen.getByText('Tooltip body');

    expect(panel?.className).toContain('top-full');
    expect(panel?.className).not.toContain('left-full');
    expect(panel?.className).not.toContain('right-full');
});

test('HoverTooltip still opens to the side with room when one flank has space', () => {
    setViewport(1200, 800);
    Element.prototype.getBoundingClientRect = () =>
        ({
            top: 300,
            bottom: 340,
            left: 900,
            right: 935,
            width: 35,
            height: 40,
            x: 900,
            y: 300,
            toJSON() {},
        }) as DOMRect;

    render(
        <div className="group">
            <HoverTooltip show="group-hover:block">Tooltip body</HoverTooltip>
        </div>,
    );

    const panel = screen.getByText('Tooltip body');

    expect(panel?.className).toContain('right-full');
});
