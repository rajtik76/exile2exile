import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { LIVE_TREE, patchTree } from '@/lib/tree-scene';
import type { TreeSource } from '@/lib/tree-scene';

const TreeSourceContext = createContext<TreeSource>(LIVE_TREE);

/** A tree snapshot of an older patch, as the server hands it to a page. */
export interface TreeSnapshotRef {
    treePatch: string;
    treeVersion: string;
}

export function TreeSourceProvider({
    snapshot,
    children,
}: {
    snapshot: TreeSnapshotRef | null;
    children: ReactNode;
}) {
    const patch = snapshot?.treePatch ?? null;
    const version = snapshot?.treeVersion ?? null;
    const source = useMemo(
        () =>
            patch === null || version === null
                ? LIVE_TREE
                : patchTree(patch, version),
        [patch, version],
    );

    return (
        <TreeSourceContext.Provider value={source}>
            {children}
        </TreeSourceContext.Provider>
    );
}

export function useTreeSource(): TreeSource {
    return useContext(TreeSourceContext);
}
