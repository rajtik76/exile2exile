import { modValuesValid } from '@/lib/modLines';
import type { ModMap } from '@/lib/modLines';
import type { PlanReference } from '@/lib/planReferences';
import { uniqueModValuesValid } from '@/lib/uniqueModLines';
import {
    MAX_ITEM_NAME_LENGTH,
    MAX_ITEM_QUALITY,
    MAX_ITEM_SOCKETS,
    MODS_PER_RARITY,
    NO_RARE_SLOTS,
    SLOT_MAX_SOCKETS,
} from '@/types/planner';
import type {
    ItemPlan,
    ItemRarity,
    ItemStat,
    UniqueModStat,
} from '@/types/planner';

/**
 * The per-item rules the paper-doll must hold before its slot editor may close. A client
 * mirror of the server's PlanSchema::itemErrors + ModCatalogue::modErrors so the author
 * sees the problem immediately; the backend re-checks the whole request on submit, so this
 * is a UX gate, not the security boundary.
 *
 * Shape rules: sockets stay within the slot's ceiling (jewellery and belts take none), and
 * a unique carries no author modifiers. Affix rules (from the mod
 * catalogue): per-rarity prefix/suffix counts (normal 0, magic 1+1, rare 3+3), one mod per
 * mutual-exclusion family, and every value inside its tier's range.
 *
 * @returns one message per broken rule, empty when the item is legal.
 */
export function itemErrors(
    slotKey: string,
    item: ItemPlan,
    mods: ModMap,
    reference?: PlanReference,
): string[] {
    const errors: string[] = [];

    if (item.name.length > MAX_ITEM_NAME_LENGTH) {
        errors.push(
            `Item name cannot exceed ${MAX_ITEM_NAME_LENGTH} characters.`,
        );
    }

    if (item.props.quality > MAX_ITEM_QUALITY) {
        errors.push(`Quality cannot exceed ${MAX_ITEM_QUALITY}%.`);
    }

    if (item.rarity === 'rare' && NO_RARE_SLOTS.has(slotKey)) {
        errors.push('A flask or charm cannot be rare.');
    }

    const slotSockets = SLOT_MAX_SOCKETS[slotKey] ?? 0;
    // A unique can carry more sockets than its slot's rares (Greymake wears four on
    // a helmet), so uniques take the global ceiling instead of the slot's.
    const maxSockets =
        item.rarity === 'unique' && slotSockets > 0
            ? MAX_ITEM_SOCKETS
            : slotSockets;

    if (item.sockets.length > maxSockets) {
        errors.push(
            maxSockets === 0
                ? 'This slot cannot hold rune sockets.'
                : `This slot holds at most ${maxSockets} rune sockets.`,
        );
    }

    // A unique's modifiers are fixed by the unique itself, so the author adds none; its
    // defensive properties (checked above) are legitimate to record. It may only carry the
    // rolled *value* of each mod the unique already has (uniqueMods).
    if (item.rarity === 'unique') {
        if (item.stats.length > 0) {
            errors.push(
                'A unique item carries its own modifiers and cannot add more.',
            );
        }

        return [...errors, ...uniqueModErrors(item.uniqueMods, reference)];
    }

    if (item.uniqueMods.length > 0) {
        errors.push(
            'Only a unique item can carry rolled unique-modifier values.',
        );
    }

    return [...errors, ...modErrors(item.rarity, item.stats, mods)];
}

/**
 * The rolled-value-range messages for a unique item's own mods, mirroring the server's
 * `PlanRequest::uniqueModErrors`. Skips validation entirely while the reference hasn't
 * resolved yet (unresolved ⇒ nothing to check against client-side; the server still
 * validates the whole request on submit), same leniency {@link modErrors} gives an
 * unresolved authored mod.
 */
function uniqueModErrors(
    uniqueMods: UniqueModStat[],
    reference: PlanReference | undefined,
): string[] {
    if (uniqueMods.length === 0 || !reference) {
        return [];
    }

    const lines = [
        ...(reference.implicitLines ?? []),
        ...(reference.modLines ?? []),
    ];
    const byKey = new Map(lines.map((line) => [line.key, line]));
    const errors: string[] = [];

    for (const stat of uniqueMods) {
        const line = byKey.get(stat.key);

        if (!line) {
            errors.push(
                'A unique item modifier does not match one of its known mods.',
            );

            continue;
        }

        if (!uniqueModValuesValid(line, stat.values)) {
            errors.push(
                "A unique item modifier's value is outside its rolled range.",
            );
        }
    }

    return [...new Set(errors)];
}

/** The affix-rule messages for a non-unique item, mirroring ModCatalogue::modErrors. */
function modErrors(
    rarity: ItemRarity,
    stats: ItemStat[],
    mods: ModMap,
): string[] {
    if (stats.length === 0) {
        return [];
    }

    const errors: string[] = [];
    const counts = { prefix: 0, suffix: 0 };
    const families: string[] = [];
    const maxPerType = MODS_PER_RARITY[rarity];

    for (const stat of stats) {
        const mod = mods[stat.modId];

        // An unresolved mod can't be classified client-side; the server still validates it.
        if (!mod) {
            continue;
        }

        counts[mod.type] += 1;
        families.push(...mod.families);

        if (!modValuesValid(mod, stat.values)) {
            errors.push("A modifier's value is outside its tier's range.");
        }
    }

    if (rarity === 'normal') {
        errors.push('A normal item cannot carry modifiers.');
    } else {
        for (const type of ['prefix', 'suffix'] as const) {
            if (counts[type] > maxPerType) {
                const noun = `${type} modifier${maxPerType === 1 ? '' : 's'}`;
                const label = rarity[0].toUpperCase() + rarity.slice(1);
                errors.push(
                    `${label} items carry at most ${maxPerType} ${noun}.`,
                );
            }
        }
    }

    if (new Set(families).size !== families.length) {
        errors.push('Two modifiers share a mutual-exclusion group.');
    }

    return [...new Set(errors)];
}
