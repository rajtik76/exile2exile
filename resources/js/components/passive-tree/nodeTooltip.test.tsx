import type { JewelInfo, TreeNode } from '@poe2-toolkit/tree-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { NodeTooltip } from './nodeTooltip';

const NODE = {
    skill: 101,
    name: 'Heavy Buffer',
    stats: ['10% increased Armour', '+20 to Strength'],
    flavourText: 'Stand fast.',
} as unknown as TreeNode;

const POINTER = { x: 40, y: 40 };

test('renders the node title, stat lines and flavour text', function () {
    render(
        <NodeTooltip
            node={NODE}
            kind="notable"
            pointer={POINTER}
            stage={null}
            allocated={false}
        />,
    );

    expect(screen.getByText('Heavy Buffer')).toBeTruthy();
    // Numbers are split into their own highlighted spans, so match by fragment.
    expect(screen.getByText('% increased Armour')).toBeTruthy();
    expect(screen.getByText('Stand fast.')).toBeTruthy();
    expect(screen.queryByText('Allocated')).toBeNull();
});

test('a nameless node falls back to its skill id and marks allocation', function () {
    render(
        <NodeTooltip
            node={{ skill: 7, stats: [] } as unknown as TreeNode}
            kind="normal"
            pointer={POINTER}
            stage={null}
            allocated
        />,
    );

    expect(screen.getByText('#7')).toBeTruthy();
    expect(screen.getByText('Allocated')).toBeTruthy();
});

test("a chosen attribute option's stats replace the base node's", function () {
    render(
        <NodeTooltip
            node={NODE}
            kind="attribute"
            pointer={POINTER}
            stage={null}
            allocated
            attributeOption={{
                id: 102,
                name: 'Intelligence',
                stats: ['+5 to Intelligence'],
                icon: '',
            }}
        />,
    );

    expect(screen.getByText('to Intelligence')).toBeTruthy();
    expect(screen.queryByText('% increased Armour')).toBeNull();
});

test('the attribute picker offers every choice and clears the path', function () {
    const onPick = vi.fn();
    const onClear = vi.fn();

    render(
        <NodeTooltip
            node={NODE}
            kind="attribute"
            pointer={POINTER}
            stage={null}
            allocated
            anchor={{ x: 100, y: 100 }}
            pick={{ value: 'dex', onPick, onClear }}
        />,
    );

    // All four choices plus the clear-path action; "Allocated" yields to the picker.
    expect(screen.getByText('Any')).toBeTruthy();
    expect(screen.queryByText('Allocated')).toBeNull();

    fireEvent.click(screen.getByText('Strength'));
    expect(onPick).toHaveBeenCalledWith('str');

    fireEvent.click(screen.getByText('Clear path'));
    expect(onClear).toHaveBeenCalledTimes(1);
});

test('a socketed jewel shows its name, base and mod lines', function () {
    const jewel: JewelInfo = {
        name: 'Rift Prism',
        baseType: 'Ruby Jewel',
        rarity: 'RARE',
        icon: null,
        mods: ['8% increased Fire Damage'],
    } as unknown as JewelInfo;

    render(
        <NodeTooltip
            node={
                {
                    skill: 9,
                    name: 'Jewel Socket',
                    stats: [],
                } as unknown as TreeNode
            }
            kind="jewel"
            pointer={POINTER}
            stage={null}
            allocated
            jewel={jewel}
        />,
    );

    expect(screen.getByText('Rift Prism')).toBeTruthy();
    expect(screen.getByText('Ruby Jewel')).toBeTruthy();
    expect(screen.getByText('% increased Fire Damage')).toBeTruthy();
});
