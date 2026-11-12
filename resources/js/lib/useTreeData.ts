import type { TreeData } from '@poe2-toolkit/tree-core';
import type { RenderResources } from '@poe2-toolkit/tree-react';
import { useEffect, useState } from 'react';
import {
    loadPointBudget,
    loadTreeData,
    loadTreeResources,
} from '@/lib/tree-scene';
import { treeSourceKey } from '@/lib/tree-scene';
import type { PointBudget } from '@/lib/tree-scene';
import { useTreeSource } from '@/lib/treeSource';

/**
 * Load the normalised tree, shared across every place that reads or draws it. The
 * loaders are module-memoised ({@link loadTreeData}), so calling this hook from the
 * planner page, the comparison view and the {@link PassiveTreeView} canvas all resolve
 * the same single fetch - no duplicate network or parse.
 *
 * The sprite atlases are opt-in (`resources: true`) because they are the expensive half
 * by an order of magnitude - several MB of GGG webp sheets against ~400 kB of gzipped
 * JSON - and only a component that actually blits pixels needs them. A caller that just
 * reads node names or the class list (the notable-priority list, the class gallery, the
 * tooltip mini-map) would otherwise pull the whole atlas set to show text.
 *
 * `resources` resolves to null and stays null if the atlases fail; the renderer falls
 * back to its vector draw in that case.
 */
export function useTreeData({
    resources: wantsResources = false,
}: { resources?: boolean } = {}): {
    data: TreeData | null;
    resources: RenderResources | null;
    budget: PointBudget | null;
    error: string | null;
} {
    const [data, setData] = useState<TreeData | null>(null);
    const [resources, setResources] = useState<RenderResources | null>(null);
    const [budget, setBudget] = useState<PointBudget | null>(null);
    const [error, setError] = useState<string | null>(null);
    const source = useTreeSource();
    const sourceKey = treeSourceKey(source);
    const [loadedKey, setLoadedKey] = useState(sourceKey);

    // A different tree must not be drawn with what was loaded for the previous one.
    if (loadedKey !== sourceKey) {
        setLoadedKey(sourceKey);
        setData(null);
        setResources(null);
        setBudget(null);
        setError(null);
    }

    useEffect(() => {
        let cancelled = false;

        loadTreeData(source)
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

        loadPointBudget(source)
            .then((loaded) => {
                if (!cancelled) {
                    setBudget(loaded);
                }
            })
            .catch(() => {
                // Budget gauge simply waits; the raw fetch error already
                // surfaces through loadTreeData above.
            });

        if (wantsResources) {
            loadTreeResources(source)
                .then((loaded) => {
                    if (!cancelled) {
                        setResources(loaded);
                    }
                })
                .catch(() => {
                    // Falls back to the vector render if the atlases fail to load.
                });
        }

        return () => {
            cancelled = true;
        };
    }, [source, wantsResources]);

    return { data, resources, budget, error };
}
