import type { TreeData } from '@poe2-toolkit/tree-core';
import { classPortrait } from '@/components/build/classPortrait';
import { withAssetVersion } from '@/lib/assetVersion';
import { treeAssetBase } from '@/lib/tree-scene';

/**
 * The class catalog: the one place that joins the GGG tree's class topology
 * (id + ascendancies, from `data.classes`) with the portrait-sheet presentation
 * (`classPortrait`). Every "class name ↔ GGG class id ↔ centre art" lookup goes
 * through here, so a GGG data reship is a single edit, not a hunt across the
 * planner, the comparison view and the dossier.
 *
 * Topology stays in `@poe2-toolkit/tree-core` and presentation in `classPortrait`; this
 * module is only their join, and it owns the one rule the renderer can't: a PoB
 * export's numeric `classId` is not stable across versions, so builds are keyed
 * by class *name* and the id is resolved from the live tree here.
 */

/**
 * Resolve a class *name* to its GGG class id (the index in `data.classes`), or
 * null when the tree carries no such class.
 *
 * The name is the only key stable across versions: an older Mercenary export
 * carries `classId` 3, which is Duelist in the live tree. Imported builds are
 * therefore keyed by name and resolved against the loaded tree here.
 */
export function resolveClassId(
    data: TreeData,
    name: string | null | undefined,
): number | null {
    if (!name) {
        return null;
    }

    const lower = name.toLowerCase();
    const cls = data.classes.find(
        (entry) => entry.name.toLowerCase() === lower,
    );

    return cls?.id ?? null;
}

/**
 * Centre artwork (class portrait + ring) for a class id + ascendancy, sized by
 * the renderer to the hub radii. Undefined when the class is unknown.
 *
 * The portrait crop follows each class's sheet layout - the Witch sheet is 3
 * frames wide, every other class 2 - so the frame rect comes from
 * {@link classPortrait}, which owns that geometry. A hardcoded 2-wide crop lands
 * on an empty tile for the Witch's ascendancy frames (the portrait "vanishes").
 */
export function centreSprites(
    data: TreeData,
    classId: number | null,
    ascendancy: string | null,
) {
    const activeClass = data.classes.find((cls) => cls.id === classId);

    if (!activeClass) {
        return undefined;
    }

    const frame = classPortrait(activeClass.name, ascendancy);
    const centre = `${treeAssetBase}/centre`;

    return {
        ...(frame && {
            portrait: {
                url: frame.src,
                sx: frame.rect.x,
                sy: frame.rect.y,
                sw: frame.rect.w,
                sh: frame.rect.h,
            },
        }),
        // The hub ring is two GGPK sprites (4000²): the static ornate circle and
        // the active-class marker the renderer rotates to the chosen class.
        ringActive: {
            url: withAssetVersion(`${centre}/ring-active.webp`),
            sx: 0,
            sy: 0,
            sw: 4000,
            sh: 4000,
        },
        ringStatic: {
            url: withAssetVersion(`${centre}/ring-static.webp`),
            sx: 0,
            sy: 0,
            sw: 4000,
            sh: 4000,
        },
    };
}
