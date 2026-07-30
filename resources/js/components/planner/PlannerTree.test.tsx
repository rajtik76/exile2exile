import type { TreeData } from '@poe2-toolkit/tree-core';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { PlanBuild } from '@/types/planner';
import type { TreeAllocation } from '@/types/tree';

/**
 * Two invariants live here.
 *
 * 1. `onFullscreenChange` passthrough: the page hides its own `ScrollToTop` waypoint
 *    while the tree is fullscreen (see `PassiveTreeView`'s unmount-cleanup fix and
 *    this prop's own doc comment) - that only works if `PlannerTree` forwards the
 *    callback instead of swallowing it.
 * 2. Deferred loading: the tree is the page's heaviest asset by far (the normalised
 *    tree JSON plus the GGG sprite atlases) and sits far below the fold on both
 *    planner pages, so nothing about it may be fetched until its frame nears the
 *    viewport. This regressed once already - a page-level `useTreeData()` call starts
 *    the download on mount and makes the deferral meaningless, which is invisible in
 *    the UI and only shows up in a network trace.
 */

// Hoisted so the mock factory below can reach the spies.
const mocks = vi.hoisted(() => ({
    loadTreeData: vi.fn(),
    loadTreeResources: vi.fn(),
    loadPointBudget: vi.fn(),
}));

// The loaders are mocked, not `useTreeData` itself: the point is to observe whether the
// fetches happen at all, which a mocked hook would hide.
vi.mock('@/lib/tree-scene', () => ({
    treeAssetBase: '/tree/current/assets',
    treeAssetUrl: (name: string) => `/tree/current/assets/${name}.webp`,
    loadTreeData: () => mocks.loadTreeData(),
    loadTreeResources: () => mocks.loadTreeResources(),
    loadPointBudget: () => mocks.loadPointBudget(),
}));

let latestPassiveTreeViewProps: {
    onFullscreenChange?: (fullscreen: boolean) => void;
} = {};

// The real canvas boots a WebGL renderer, which jsdom has none of; these tests only
// care about whether it got mounted and what it was handed.
vi.mock('@/components/passive-tree/PassiveTreeView', () => ({
    default: (props: typeof latestPassiveTreeViewProps) => {
        latestPassiveTreeViewProps = props;

        return <div>tree canvas</div>;
    },
}));

const { default: PlannerTree } = await import('./PlannerTree');

const TREE = {
    classes: [
        {
            id: 3,
            name: 'Mercenary',
            ascendancies: [
                {
                    id: 'Witchhunter',
                    name: 'Witchhunter',
                    internalId: 'Mercenary2',
                },
            ],
        },
    ],
} as unknown as TreeData;

/** A controllable IntersectionObserver stub, as in {@link LazyMount}'s own tests. */
class FakeIntersectionObserver {
    static instances: FakeIntersectionObserver[] = [];

    disconnect = vi.fn();
    observe = vi.fn();

    constructor(private callback: IntersectionObserverCallback) {
        FakeIntersectionObserver.instances.push(this);
    }

    intersect(): void {
        this.callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
        );
    }
}

let originalIntersectionObserver: typeof IntersectionObserver | undefined;

beforeEach(() => {
    latestPassiveTreeViewProps = {};
    FakeIntersectionObserver.instances = [];
    mocks.loadTreeData.mockResolvedValue(TREE);
    mocks.loadTreeResources.mockResolvedValue({
        manifest: { frames: {} },
        atlases: {},
    });
    mocks.loadPointBudget.mockResolvedValue({ basic: 123, weaponSet: 0 });
    originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
        FakeIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
    globalThis.IntersectionObserver =
        originalIntersectionObserver as typeof IntersectionObserver;
    vi.clearAllMocks();
});

const build: PlanBuild = { className: 'Mercenary', ascendId: 'Witchhunter' };
const allocation: TreeAllocation = {
    allocated: [],
    attributeChoices: {},
    weaponSets: {},
    jewels: {},
    treeVersion: null,
};

/** Bring the frame into view and let the loaders' promises settle. */
async function scrollIntoView(): Promise<void> {
    await act(async () => {
        FakeIntersectionObserver.instances[0]?.intersect();
    });
}

test('it fetches nothing until the frame nears the viewport', () => {
    const { container } = render(
        <PlannerTree editable={false} build={build} allocation={allocation} />,
    );

    expect(mocks.loadTreeData).not.toHaveBeenCalled();
    expect(mocks.loadTreeResources).not.toHaveBeenCalled();
    expect(mocks.loadPointBudget).not.toHaveBeenCalled();
    expect(screen.queryByText('tree canvas')).toBeNull();
    // A skeleton stands in meanwhile, so the frame keeps its height and the page does
    // not shift when the canvas arrives.
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
});

test('it loads the tree and mounts the canvas once the frame nears the viewport', async () => {
    render(
        <PlannerTree editable={false} build={build} allocation={allocation} />,
    );

    await scrollIntoView();

    expect(mocks.loadTreeData).toHaveBeenCalledTimes(1);
    expect(screen.getByText('tree canvas')).toBeTruthy();
    // The sprite atlases are the canvas's own business (it is the only thing that blits
    // them, and it is stubbed here) - this wrapper never asks for them.
    expect(mocks.loadTreeResources).not.toHaveBeenCalled();
});

test('forwards onFullscreenChange to the underlying PassiveTreeView', async () => {
    const onFullscreenChange = vi.fn();

    render(
        <PlannerTree
            build={build}
            allocation={allocation}
            editable={false}
            onFullscreenChange={onFullscreenChange}
        />,
    );

    await scrollIntoView();

    expect(latestPassiveTreeViewProps.onFullscreenChange).toBe(
        onFullscreenChange,
    );
});
