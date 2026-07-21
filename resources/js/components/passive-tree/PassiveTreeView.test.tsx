import type { TreeData } from '@poe2-toolkit/tree-core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

/**
 * Regression coverage for a bug where the touch tap-to-inspect tooltip only
 * ever wired up when `editable` - so a read-only build view (or the /t
 * viewer) showed nothing when a node was tapped on a phone, even though
 * inspecting a node never edits anything. See PassiveTreeView's
 * `handleNodeInspect` and the `coarsePointer` gating on its detail tooltip.
 */

vi.mock('@/hooks/use-coarse-pointer', () => ({
    useCoarsePointer: () => true,
}));

const FIXTURE_DATA = {
    version: '0_5',
    constants: { centreInnerRadius: 0 },
    groups: {},
    nodes: {
        101: {
            skill: 101,
            group: 1,
            name: 'Test Notable',
            icon: 'Art/test.dds',
            stats: ['10% increased Life'],
            x: 0,
            y: 0,
            out: [],
            in: [],
            isNotable: true,
        },
    },
    classes: [
        {
            id: 0,
            name: 'Warrior',
            baseStr: 0,
            baseDex: 0,
            baseInt: 0,
            startNode: 999,
            centre: { image: 'Warrior', x: 0, y: 0 },
            ascendancies: [],
        },
    ],
    jewelSlots: [],
    bounds: { min_x: -100, min_y: -100, max_x: 100, max_y: 100 },
} as unknown as TreeData;

vi.mock('@/lib/useTreeData', () => ({
    useTreeData: () => ({
        data: FIXTURE_DATA,
        resources: null,
        budget: { basic: 100, weaponSet: 10 },
        error: null,
    }),
}));

let latestTreeViewProps: {
    onNodeClick?: (skill: number, screen: { x: number; y: number }) => void;
    onInteractStart?: () => void;
} = {};

vi.mock('@poe2-toolkit/tree-react', () => ({
    DEFAULT_TREE_COLORS: { weaponSet: { 1: 0xff0000, 2: 0x00ff00 } },
    TreeView: (props: typeof latestTreeViewProps) => {
        latestTreeViewProps = props;

        return <div data-testid="tree-view-stub" />;
    },
}));

vi.mock('@poe2-toolkit/tree-core', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    buildScene: (data: TreeData) => ({
        nodes: Object.values(data.nodes).map((node) => ({
            skill: node.skill,
            kind: 'notable',
        })),
        centre: {
            classes: data.classes.map((cls) => ({
                classId: cls.id,
                startNode: cls.startNode,
            })),
        },
    }),
    buildTreeGraph: vi.fn(),
    buildAscendancyGraph: vi.fn(),
    toggleAllocationInMode: vi.fn(),
    toggleAscendancyAllocation: vi.fn(),
    classOverrideNode: (
        _data: TreeData,
        _classId: number | null,
        node: unknown,
    ) => node,
    chosenAttributeOption: () => undefined,
    allocatedBoundsWithCentre: () => null,
    ascendancyStartNode: () => undefined,
}));

const { default: PassiveTreeView } = await import('./PassiveTreeView');

beforeEach(() => {
    latestTreeViewProps = {};
});

test('a mobile tap shows the node detail tooltip in read-only mode', () => {
    render(
        <PassiveTreeView
            editable={false}
            classId={0}
            ascendancy={null}
            showSearch={false}
            showPointsCounter={false}
            allocation={{ allocated: [] }}
        />,
    );

    expect(screen.queryByText('Test Notable')).toBeNull();

    act(() => {
        latestTreeViewProps.onNodeClick?.(101, { x: 10, y: 10 });
    });

    expect(screen.getByText('Test Notable')).toBeTruthy();
});

test('a mobile tap-away dismisses the read-only detail tooltip', () => {
    render(
        <PassiveTreeView
            editable={false}
            classId={0}
            ascendancy={null}
            showSearch={false}
            showPointsCounter={false}
            allocation={{ allocated: [] }}
        />,
    );

    act(() => {
        latestTreeViewProps.onNodeClick?.(101, { x: 10, y: 10 });
    });

    expect(screen.getByText('Test Notable')).toBeTruthy();

    act(() => {
        latestTreeViewProps.onInteractStart?.();
    });

    expect(screen.queryByText('Test Notable')).toBeNull();
});

/**
 * Regression guard: entering fullscreen must stay a plain className swap on
 * the same stage element (`relative h-full ...` -> `fixed inset-0 z-[120] ...`),
 * never a remount. An earlier attempt at fixing the fullscreen stage's z-index
 * getting trapped by a page ancestor's stacking context routed it through
 * `createPortal` instead - which, since the container argument changed between
 * windowed and fullscreen, tore the whole stage (including the PixiJS canvas
 * `TreeView` wraps) down and rebuilt it on every toggle, silently resetting
 * pan/zoom and reinitialising WebGL for nothing. The actual fix lives with the
 * page instead (it hides its own `ScrollToTop` while the tree is fullscreen -
 * see `PlannerTree`'s `onFullscreenChange` doc), so this component never
 * needs to move its own DOM.
 */
test('entering fullscreen swaps the stage class without remounting the canvas', () => {
    render(
        <PassiveTreeView
            editable={false}
            classId={0}
            ascendancy={null}
            showSearch={false}
            showPointsCounter={false}
            allocation={{ allocated: [] }}
        />,
    );

    const stubBefore = screen.getByTestId('tree-view-stub');
    expect(stubBefore.closest('.fixed.inset-0')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));

    const stubAfter = screen.getByTestId('tree-view-stub');
    expect(stubAfter).toBe(stubBefore);
    expect(stubAfter.closest('.fixed.inset-0')).not.toBeNull();
});

/**
 * Regression coverage for a bug where a caller hiding its own UI while the
 * tree is fullscreen (`ScrollToTop`, via `onFullscreenChange`) could get stuck
 * that way forever: if this component unmounts - or remounts under a fresh
 * `key`, e.g. the page switching phase tabs behind the overlay - while still
 * fullscreen, nothing ever told the caller fullscreen ended, since the only
 * two call sites for `onFullscreenChange(false)` are the toggle button and the
 * Escape-key handler. An unmount-only effect now fires it explicitly.
 */
test('unmounting while fullscreen tells the caller fullscreen ended', () => {
    const onFullscreenChange = vi.fn();

    const { unmount } = render(
        <PassiveTreeView
            editable={false}
            classId={0}
            ascendancy={null}
            showSearch={false}
            showPointsCounter={false}
            allocation={{ allocated: [] }}
            onFullscreenChange={onFullscreenChange}
        />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    expect(onFullscreenChange).toHaveBeenLastCalledWith(true);

    unmount();

    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
});

test('unmounting while windowed does not fire a spurious fullscreen-ended call', () => {
    const onFullscreenChange = vi.fn();

    const { unmount } = render(
        <PassiveTreeView
            editable={false}
            classId={0}
            ascendancy={null}
            showSearch={false}
            showPointsCounter={false}
            allocation={{ allocated: [] }}
            onFullscreenChange={onFullscreenChange}
        />,
    );

    unmount();

    expect(onFullscreenChange).not.toHaveBeenCalled();
});
