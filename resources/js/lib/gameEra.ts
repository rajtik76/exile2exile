import { usePage } from '@inertiajs/react';
import { useState } from 'react';

/** The game data an editor was opened on: its raw patch and that patch's era. */
export interface LoadedGameData {
    /** Raw GGG patch of the live data (shared `dataVersion` prop), e.g. "4.5.5.4". */
    patch: string | null;
    /** Its game era (shared `gameEra` prop), e.g. "0.5". */
    era: string | null;
}

/**
 * The game data this editor was opened on. The patch is sent back on save so the
 * server can refuse a save from a tab opened before the data moved to a new era;
 * the server only compares it and always stamps the build with its own live patch.
 * The era keys the local draft.
 *
 * Read once on mount, never live: a refused save hands the page fresh shared props
 * carrying the new data while the editor keeps its old-era content, and following
 * the props would let the very next save through.
 */
export function useLoadedGameData(): LoadedGameData {
    const { props } = usePage();
    const [loaded] = useState<LoadedGameData>(() => ({
        patch: typeof props.dataVersion === 'string' ? props.dataVersion : null,
        era: typeof props.gameEra === 'string' ? props.gameEra : null,
    }));

    return loaded;
}
