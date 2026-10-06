/**
 * A unique's Path of Building variants on the client: the same rules as the server's
 * `App\Pob\Uniques\PobItemVariants` (a port of PathOfBuilding-PoE2's `Classes/Item.lua`),
 * so the editor shows exactly the lines the server validates and the import matched.
 *
 * A unique's lines carry PoB's `{variant:}`, `{version:}` and `{group:}` tags; only the
 * lines active for the item's pick are its mods. Ids are PoB's own 1-based indexes. An
 * item with a `versions` list or variant groups uses the versioned/grouped rules;
 * anything else the classic main + alt variant rules.
 */

import type { UniqueModLine } from '@/lib/planReferences';

/** Map keyed by a numeric id; PHP's JSON gives `[]` when it's empty. */
type IdMap<T> = Record<string, T> | T[];

/** An item's variant pick (PoB's `Selected Variant`, `Selected Alt Variant`, ...). */
export interface UniqueVariantSelection {
    variant?: number;
    /** Alt slot (1-5) => variant id. */
    alts?: IdMap<number>;
    version?: number;
    /** Group id => variant id. */
    groups?: IdMap<number>;
}

/** A unique's variant model, as the server's `PobItemVariants::toArray` sends it. */
export interface UniqueVariantModel {
    variants: string[];
    versions: string[];
    /** Enabled alt slots (1 = `Has Alt Variant`, 2 = `Two`, ...). */
    altSlots: number[];
    /** Group id => variant id => eligible version ids (0 = every version). */
    groups: IdMap<IdMap<number[]>>;
    defaults: UniqueVariantSelection | [];
}

/** A pick with every axis valid for its model. */
export interface NormalisedVariantSelection {
    variant: number | null;
    alts: Record<number, number>;
    version: number | null;
    groups: Record<number, number>;
}

function idMap<T>(map: IdMap<T> | undefined): Map<number, T> {
    const result = new Map<number, T>();

    for (const [key, value] of Object.entries(map ?? {})) {
        result.set(Number(key), value);
    }

    return result;
}

function selectionOf(
    selection: UniqueVariantSelection | [] | undefined,
): UniqueVariantSelection {
    return Array.isArray(selection) || !selection ? {} : selection;
}

function clamp(value: number, count: number): number {
    return Math.max(1, Math.min(count, value));
}

export function usesVersionedOrGroupedVariants(
    model: UniqueVariantModel,
): boolean {
    return model.versions.length > 0 || idMap(model.groups).size > 0;
}

export function hasIndependentVariants(model: UniqueVariantModel): boolean {
    return (
        model.versions.length > 0 &&
        model.variants.length > 0 &&
        idMap(model.groups).size === 0
    );
}

/** The variant ids a group can pick under a version (PoB's `GetVariantGroupOptions`). */
export function groupOptions(
    model: UniqueVariantModel,
    groupId: number,
    version: number | null,
): number[] {
    const options: number[] = [];

    for (const [variantId, versionIds] of idMap(
        idMap(model.groups).get(groupId),
    )) {
        if (
            versionIds.includes(0) ||
            (version !== null && versionIds.includes(version))
        ) {
            options.push(variantId);
        }
    }

    return options.sort((a, b) => a - b);
}

/** Group ids in ascending order. */
export function groupIds(model: UniqueVariantModel): number[] {
    return [...idMap(model.groups).keys()].sort((a, b) => a - b);
}

/**
 * A valid pick: every axis clamped into range, anything missing filled with PoB's
 * default (the item's own selected variant, else the last one) - `PobItemVariants::normalise`.
 */
export function normaliseVariantSelection(
    model: UniqueVariantModel,
    rawSelection?: UniqueVariantSelection | [],
): NormalisedVariantSelection {
    const selection = selectionOf(rawSelection);
    const defaults = selectionOf(model.defaults);
    const variantCount = model.variants.length;

    if (!usesVersionedOrGroupedVariants(model)) {
        const picked = idMap(selection.alts);
        const defaultAlts = idMap(defaults.alts);
        const alts: Record<number, number> = {};

        for (const slot of model.altSlots) {
            alts[slot] = clamp(
                picked.get(slot) ?? defaultAlts.get(slot) ?? variantCount,
                variantCount,
            );
        }

        return {
            variant:
                variantCount > 0
                    ? clamp(
                          selection.variant ?? defaults.variant ?? variantCount,
                          variantCount,
                      )
                    : null,
            alts,
            version: null,
            groups: {},
        };
    }

    const versionCount = model.versions.length;
    const version =
        versionCount > 0
            ? clamp(
                  selection.version ?? defaults.version ?? versionCount,
                  versionCount,
              )
            : null;
    const variant = hasIndependentVariants(model)
        ? clamp(
              selection.variant ?? defaults.variant ?? variantCount,
              variantCount,
          )
        : null;
    const picks = idMap(selection.groups);

    return {
        variant,
        alts: {},
        version,
        groups: normaliseGroups(
            model,
            picks.size > 0 ? picks : idMap(defaults.groups),
            version,
        ),
    };
}

/**
 * PoB's group pass: a still-valid pick no other group holds is kept, then each
 * remaining group takes its first eligible variant nobody uses yet.
 */
function normaliseGroups(
    model: UniqueVariantModel,
    picks: Map<number, number>,
    version: number | null,
): Record<number, number> {
    const used = new Set<number>();
    const selected: Record<number, number> = {};
    const needsSelection: number[] = [];

    for (const groupId of groupIds(model)) {
        const options = groupOptions(model, groupId, version);

        if (options.length === 0) {
            continue;
        }

        const pick = picks.get(groupId);

        if (pick !== undefined && options.includes(pick) && !used.has(pick)) {
            used.add(pick);
            selected[groupId] = pick;
        } else {
            needsSelection.push(groupId);
        }
    }

    for (const groupId of needsSelection) {
        const free = groupOptions(model, groupId, version).find(
            (variantId) => !used.has(variantId),
        );

        if (free !== undefined) {
            selected[groupId] = free;
            used.add(free);
        }
    }

    return selected;
}

/** Whether a line applies to a (normalised) pick - PoB's `CheckModLineVariant`. */
export function isLineActive(
    model: UniqueVariantModel,
    line: Pick<UniqueModLine, 'variants' | 'versions' | 'groups'>,
    selection: NormalisedVariantSelection,
): boolean {
    if (usesVersionedOrGroupedVariants(model)) {
        if (
            line.versions &&
            (selection.version === null ||
                !line.versions.includes(selection.version))
        ) {
            return false;
        }

        if (line.groups) {
            if (!line.variants) {
                return false;
            }

            return line.groups.some((groupId) => {
                const picked = selection.groups[groupId];

                return picked !== undefined && line.variants!.includes(picked);
            });
        }

        if (hasIndependentVariants(model) && line.variants) {
            return (
                selection.variant !== null &&
                line.variants.includes(selection.variant)
            );
        }

        return !line.variants;
    }

    if (!line.variants) {
        return true;
    }

    return [selection.variant, ...Object.values(selection.alts)].some(
        (picked) => picked !== null && line.variants!.includes(picked),
    );
}

/**
 * The lines of a unique that apply to the item's pick, in order. Without a variant
 * model every line applies.
 */
export function activeUniqueLines(
    lines: UniqueModLine[],
    model: UniqueVariantModel | null | undefined,
    selection: UniqueVariantSelection | [] | undefined,
): UniqueModLine[] {
    if (!model) {
        return lines;
    }

    const normalised = normaliseVariantSelection(model, selection);

    return lines.filter((line) => isLineActive(model, line, normalised));
}
