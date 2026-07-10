import type { TreeData } from '@poe2-toolkit/tree-core';
import type { RenderResources } from '@poe2-toolkit/tree-react';
import { useEffect, useState } from 'react';
import {
    loadPointBudget,
    loadTreeData,
    loadTreeResources,
} from '@/lib/tree-scene';
import type { PointBudget } from '@/lib/tree-scene';

/**
 * Load the normalised tree and its sprite atlases, shared across every place
 * that renders or drives the tree. Both loaders are module-memoised
 * ({@link loadTreeData}), so calling this hook from the planner page, the
 * comparison view and the {@link PassiveTreeView} canvas all resolve the same
 * single fetch - no duplicate network or parse.
 *
 * `resources` resolves to null and stays null if the atlases fail; the renderer
 * falls back to its vector draw in that case.
 */
export function useTreeData(): {
    data: TreeData | null;
    resources: RenderResources | null;
    budget: PointBudget | null;
    error: string | null;
} {
    const [data, setData] = useState<TreeData | null>(null);
    const [resources, setResources] = useState<RenderResources | null>(null);
    const [budget, setBudget] = useState<PointBudget | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        loadTreeData()
            .then((loaded) => {
                if (!cancelled) {
                    setData(loaded);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to load tree',
                    );
                }
            });

        loadPointBudget()
            .then((loaded) => {
                if (!cancelled) {
                    setBudget(loaded);
                }
            })
            .catch(() => {
                // Budget gauge simply waits; the raw fetch error already
                // surfaces through loadTreeData above.
            });

        loadTreeResources()
            .then((loaded) => {
                if (!cancelled) {
                    setResources(loaded);
                }
            })
            .catch(() => {
                // Falls back to the vector render if the atlases fail to load.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { data, resources, budget, error };
}
