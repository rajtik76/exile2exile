import type { PlanReference } from '@/lib/planReferences';
import type { ItemPlan } from '@/types/planner';

/**
 * The weapon-stat lines an item tooltip shows, derived the way the game derives
 * them: the base's own GGPK `WeaponTypes` row (physical damage, crit, attack time,
 * range, reload) modified by the item's LOCAL mods only. Local mods carry `local_`
 * stat ids ("Adds # to # Cold Damage" on a weapon rolls
 * `local_minimum_added_cold_damage`) and change the weapon's own stats; global
 * mods (`attack_*`, `spell_*`, bare ids) never touch these lines. Elemental and
 * chaos damage lines exist purely through local mods - a base weapon is physical
 * only. Quality raises physical damage, additively with `local_physical_damage_+%`.
 * Each stat's own frozen `rolls` (see {@link ItemMod}) drive the sums directly - an
 * unmatched stat carries none and contributes nothing.
 */

/** One derived tooltip line; `modified` marks a value local mods/quality changed. */
export interface WeaponStatLine {
    label: string;
    value: string;
    modified: boolean;
}

/** The local-mod sums that feed the derived weapon lines, keyed by concern. */
interface LocalSums {
    physMin: number;
    physMax: number;
    physInc: number;
    attackSpeedInc: number;
    critFlat: number;
    critInc: number;
    reloadSpeedInc: number;
    rangeFlat: number;
    spiritInc: number;
    elements: Record<ElementKey, { min: number; max: number }>;
}

const ELEMENTS = [
    ['fire', 'Fire Damage'],
    ['cold', 'Cold Damage'],
    ['lightning', 'Lightning Damage'],
    ['chaos', 'Chaos Damage'],
] as const;

type ElementKey = (typeof ELEMENTS)[number][0];

/**
 * Sum the item's local-mod rolls. Each authored value slots into its stat's own
 * frozen rolls by index (a missing value falls back to the roll's minimum, same as
 * the tooltip's own rendering in modLines.ts).
 */
function localSums(item: ItemPlan): LocalSums {
    const sums: LocalSums = {
        physMin: 0,
        physMax: 0,
        physInc: 0,
        attackSpeedInc: 0,
        critFlat: 0,
        critInc: 0,
        reloadSpeedInc: 0,
        rangeFlat: 0,
        spiritInc: 0,
        elements: {
            fire: { min: 0, max: 0 },
            cold: { min: 0, max: 0 },
            lightning: { min: 0, max: 0 },
            chaos: { min: 0, max: 0 },
        },
    };

    for (const stat of item.stats) {
        if (!stat.rolls) {
            continue;
        }

        stat.rolls.forEach((roll, index) => {
            const value = stat.values[index] ?? roll.min;

            switch (roll.stat) {
                case 'local_minimum_added_physical_damage':
                    sums.physMin += value;
                    break;
                case 'local_maximum_added_physical_damage':
                    sums.physMax += value;
                    break;
                case 'local_physical_damage_+%':
                    sums.physInc += value;
                    break;
                case 'local_attack_speed_+%':
                    sums.attackSpeedInc += value;
                    break;
                case 'local_critical_strike_chance':
                    sums.critFlat += value;
                    break;
                case 'local_critical_strike_chance_+%':
                    sums.critInc += value;
                    break;
                case 'local_reload_speed_+%':
                    sums.reloadSpeedInc += value;
                    break;
                case 'local_weapon_range_+':
                    sums.rangeFlat += value;
                    break;
                case 'local_spirit_+%':
                    sums.spiritInc += value;
                    break;
                default: {
                    const match = roll.stat.match(
                        /^local_(minimum|maximum)_added_(fire|cold|lightning|chaos)_damage$/,
                    );

                    if (match) {
                        const bound = match[1] === 'minimum' ? 'min' : 'max';
                        sums.elements[match[2] as ElementKey][bound] += value;
                    }
                }
            }
        });
    }

    return sums;
}

/** Two-decimal display, the game's own format for crit/speed ("5.00", "1.20"). */
function fixed2(value: number): string {
    return value.toFixed(2);
}

/**
 * The derived weapon-stat lines for the item, in the game tooltip's order, or an
 * empty list when the resolved base has no weapon row and grants no Spirit
 * (armour, jewellery - and unresolved references). Sceptres have no weapon row
 * but do grant Spirit, so they still get their one line. Weapon Range is a melee
 * line - the game omits it on projectile weapons (bows, crossbows).
 */
export function weaponStatLines(
    reference: PlanReference | undefined,
    item: ItemPlan,
): WeaponStatLine[] {
    const weapon = reference?.weapon ?? null;
    const spirit = reference?.spirit ?? 0;

    if (!weapon && spirit <= 0) {
        return [];
    }

    const sums = localSums(item);
    const lines: WeaponStatLine[] = [];

    if (weapon) {
        const physScale = 1 + (sums.physInc + item.props.quality) / 100;
        const physMin = Math.round(
            (weapon.damageMin + sums.physMin) * physScale,
        );
        const physMax = Math.round(
            (weapon.damageMax + sums.physMax) * physScale,
        );

        lines.push({
            label: 'Physical Damage',
            value: `${physMin}-${physMax}`,
            modified: physScale !== 1 || sums.physMin > 0 || sums.physMax > 0,
        });

        for (const [key, label] of ELEMENTS) {
            const range = sums.elements[key];

            if (range.max > 0) {
                lines.push({
                    label,
                    value: `${range.min}-${range.max}`,
                    modified: true,
                });
            }
        }

        const crit =
            (weapon.critical / 100 + sums.critFlat) * (1 + sums.critInc / 100);

        lines.push({
            label: 'Critical Hit Chance',
            value: `${fixed2(crit)}%`,
            modified: sums.critFlat > 0 || sums.critInc > 0,
        });

        if (weapon.attackTime > 0) {
            const aps =
                (1000 / weapon.attackTime) * (1 + sums.attackSpeedInc / 100);

            lines.push({
                label: 'Attacks per Second',
                value: fixed2(aps),
                modified: sums.attackSpeedInc !== 0,
            });
        }

        if (weapon.reloadTime > 0) {
            const reload =
                weapon.reloadTime / 1000 / (1 + sums.reloadSpeedInc / 100);

            lines.push({
                label: 'Reload Time',
                value: `${fixed2(reload)} sec`,
                modified: sums.reloadSpeedInc !== 0,
            });
        }

        const projectile =
            reference?.category === 'Bow' || reference?.category === 'Crossbow';

        if (!projectile && weapon.rangeMax > 0) {
            const range = (weapon.rangeMax + sums.rangeFlat) / 10;

            lines.push({
                label: 'Weapon Range',
                value: `${range.toFixed(1)} metres`,
                modified: sums.rangeFlat !== 0,
            });
        }
    }

    if (spirit > 0) {
        const total = Math.round(spirit * (1 + sums.spiritInc / 100));

        lines.push({
            label: 'Spirit',
            value: String(total),
            modified: sums.spiritInc !== 0,
        });
    }

    return lines;
}
