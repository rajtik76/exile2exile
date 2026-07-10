import { useEffect, useState } from 'react';
import { xsrfToken } from '@/lib/csrf';
import { refKey } from '@/lib/planReferences';
import type { PlanReference, ReferenceMap } from '@/lib/planReferences';
import { resolve as resolveReferences } from '@/routes/planner/references';

/**
 * Resolve notable/keystone display data (name, sprite icon, tooltip) by name via the
 * GGPK-backed reference endpoint - the same source the reference picker uses. Module
 * cached across mounts so a phase revisit never refetches. Feeds the tree priority list
 * its round icons; the passive tree only hands us skill ids, so the caller maps those to
 * names first.
 */
const cache = new Map<string, PlanReference>();

export function useNotableReferences(
    names: string[],
): Record<string, PlanReference> {
    // Append-only store of freshly fetched refs; its identity change is what re-renders
    // once a fetch lands. The module cache is the durable copy read at render time.
    const [fetched, setFetched] = useState<Record<string, PlanReference>>({});

    // Fetch whenever the requested set changes. Keyed on the sorted-unique join so a
    // reorder (same names, new order) doesn't trigger a refetch.
    const key = [...new Set(names)].filter(Boolean).sort().join('|');

    useEffect(() => {
        const missing = [...new Set(names)].filter(
            (name) => name !== '' && !cache.has(name),
        );

        if (missing.length === 0) {
            return;
        }

        let cancelled = false;

        void fetch(resolveReferences.url(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': xsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                refs: missing.map((name) => ({ type: 'notable', id: name })),
            }),
        })
            .then((response) =>
                response.ok
                    ? (response.json() as Promise<{
                          references?: ReferenceMap;
                      }>)
                    : { references: {} },
            )
            .then((body) => {
                if (cancelled || !body.references) {
                    return;
                }

                const added: Record<string, PlanReference> = {};

                for (const name of missing) {
                    const reference = body.references[refKey('notable', name)];

                    if (reference) {
                        cache.set(name, reference);
                        added[name] = reference;
                    }
                }

                if (Object.keys(added).length > 0) {
                    setFetched((previous) => ({ ...previous, ...added }));
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
        // `names` order is irrelevant to the fetch; the sorted-unique key covers content.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    // Read-through: the durable cache first (covers names resolved by another mount),
    // then this render's fetched additions. `fetched` in the deps re-renders on a landing.
    const resolved: Record<string, PlanReference> = {};

    for (const name of names) {
        const hit = cache.get(name) ?? fetched[name];

        if (hit) {
            resolved[name] = hit;
        }
    }

    return resolved;
}
