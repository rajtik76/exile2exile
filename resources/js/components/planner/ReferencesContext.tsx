import { createContext, useContext } from 'react';
import type { PlanReference, ReferenceMap } from '@/lib/planReferences';

interface ReferencesValue {
    map: ReferenceMap;
    addReference: (reference: PlanReference) => void;
}

const ReferencesCtx = createContext<ReferencesValue>({
    map: {},
    addReference: () => {},
});

/**
 * Provides the resolved reference map so chips can render icon + tooltip. Fully
 * controlled: the editor owns the map (and persists it inside the plan draft, so a
 * chip survives a hard refresh before the plan is saved); the read-only viewer just
 * passes the server-resolved map with no `addReference`.
 */
export function ReferencesProvider({
    map,
    addReference,
    children,
}: {
    map: ReferenceMap;
    addReference?: (reference: PlanReference) => void;
    children: React.ReactNode;
}) {
    return (
        <ReferencesCtx.Provider
            value={{ map, addReference: addReference ?? (() => {}) }}
        >
            {children}
        </ReferencesCtx.Provider>
    );
}

export function useReferences(): ReferencesValue {
    return useContext(ReferencesCtx);
}
