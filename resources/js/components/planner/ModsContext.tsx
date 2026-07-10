import { createContext, useContext } from 'react';
import type { ModInfo, ModMap } from '@/lib/modLines';

interface ModsValue {
    map: ModMap;
    addMod: (mod: ModInfo) => void;
}

const ModsCtx = createContext<ModsValue>({
    map: {},
    addMod: () => {},
});

/**
 * Provides the resolved mod map so a planned item's affixes render their live tier line
 * (and the editor knows each mod's prefix/suffix type and family for the rarity limits).
 * Mirrors {@link ReferencesProvider}: the editor owns the map and adds a mod as it is
 * picked; the read-only viewer just passes the server-resolved map with no `addMod`. Only
 * the `Mods.Id` and rolled values are ever stored - the wording resolves fresh.
 */
export function ModsProvider({
    map,
    addMod,
    children,
}: {
    map: ModMap;
    addMod?: (mod: ModInfo) => void;
    children: React.ReactNode;
}) {
    return (
        <ModsCtx.Provider value={{ map, addMod: addMod ?? (() => {}) }}>
            {children}
        </ModsCtx.Provider>
    );
}

export function useMods(): ModsValue {
    return useContext(ModsCtx);
}
