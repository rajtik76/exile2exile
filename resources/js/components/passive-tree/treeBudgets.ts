import type { WeaponSet } from '@poe2-toolkit/tree-core';

/** Per-mode main-tree usage: basic points plus each weapon set's tagged nodes. */
export interface PointUsage {
    basic: number;
    setI: number;
    setII: number;
}

/** The caps the usage is gauged against (GGPK-derived, with fallbacks). */
export interface PointLimits {
    basic: number;
    weaponSet: number;
}

/** A number colour as the CSS hex string the chrome paints it with. */
export const hexColor = (color: number): string =>
    `#${color.toString(16).padStart(6, '0')}`;

/**
 * Per-mode main-tree usage. Ascendancy nodes draw from a separate pool and
 * never count here (the caller says which ids those are). Set I nodes are basic
 * nodes tagged for a weapon set, so they count toward both the basic budget and
 * the set I cap; set II is the additive divergence with its own cap.
 */
export function pointUsage(
    allocated: Iterable<number>,
    sets: Record<number, WeaponSet>,
    isAscendancyNode: (id: number) => boolean,
): PointUsage {
    let basic = 0;
    let setI = 0;
    let setII = 0;

    for (const id of allocated) {
        if (isAscendancyNode(id)) {
            continue;
        }

        const mode = sets[id];

        if (mode === 1) {
            setI++;
        } else if (mode === 2) {
            setII++;
        } else {
            basic++;
        }
    }

    return { basic: basic + setI, setI, setII };
}

/**
 * The first budget a step would overspend (so the toast names it), comparing
 * before/after counts - a build already over a cap stays editable, only growth
 * is stopped.
 */
export function exceededCap(
    before: PointUsage,
    after: PointUsage,
    limits: PointLimits,
): { label: string; limit: number } | null {
    if (before.basic <= limits.basic && after.basic > limits.basic) {
        return { label: 'Passive point', limit: limits.basic };
    }

    if (before.setI <= limits.weaponSet && after.setI > limits.weaponSet) {
        return { label: 'Weapon set I', limit: limits.weaponSet };
    }

    if (before.setII <= limits.weaponSet && after.setII > limits.weaponSet) {
        return { label: 'Weapon set II', limit: limits.weaponSet };
    }

    return null;
}
