import type { TreeData } from '@poe2-toolkit/tree-core';
import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { PlanBuild } from '@/types/planner';

/**
 * Regression coverage for `onFullscreenChange` passthrough: the page hides its
 * own `ScrollToTop` waypoint while the tree is fullscreen (see
 * `PassiveTreeView`'s unmount-cleanup fix and this prop's own doc comment) -
 * that only works if `PlannerTree` actually forwards the callback instead of
 * swallowing it.
 */

let latestPassiveTreeViewProps: {
    onFullscreenChange?: (fullscreen: boolean) => void;
} = {};

vi.mock('@/components/passive-tree/PassiveTreeView', () => ({
    default: (props: typeof latestPassiveTreeViewProps) => {
        latestPassiveTreeViewProps = props;

        return null;
    },
}));

vi.mock('@/lib/useTreeData', () => ({
    useTreeData: () => ({
        data: { classes: [{ id: 0, name: 'Warrior' }] } as unknown as TreeData,
    }),
}));

vi.mock('@/lib/classCatalog', () => ({
    resolveClassId: () => 0,
    resolveAscendancyName: () => null,
}));

const { default: PlannerTree } = await import('./PlannerTree');

test('forwards onFullscreenChange to the underlying PassiveTreeView', () => {
    const onFullscreenChange = vi.fn();

    render(
        <PlannerTree
            build={{ className: 'Warrior' } as PlanBuild}
            allocation={{
                allocated: [],
                attributeChoices: {},
                weaponSets: {},
                jewels: {},
                treeVersion: null,
            }}
            editable={false}
            onFullscreenChange={onFullscreenChange}
        />,
    );

    expect(latestPassiveTreeViewProps.onFullscreenChange).toBe(
        onFullscreenChange,
    );
});
