import type { CSSProperties } from 'react';

/** Modifier text colour, matching the blue item mods on tools like mobalytics. */
export const MOD_COLOR = '#8aa0c8';

/** Prefix/suffix badge colours, shared by the editor and the mod rows. */
export const MOD_TYPE_STYLE: Record<'prefix' | 'suffix', CSSProperties> = {
    prefix: { color: '#8fb3ff', backgroundColor: '#8fb3ff20' },
    suffix: { color: '#e0b070', backgroundColor: '#e0b07020' },
};
