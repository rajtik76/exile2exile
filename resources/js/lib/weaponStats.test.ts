import { expect, test } from 'vitest';
import type { ModMap } from '@/lib/modLines';
import type { PlanReference } from '@/lib/planReferences';
import { weaponStatLines } from '@/lib/weaponStats';
import type { ItemPlan } from '@/types/planner';

function item(overrides: Partial<ItemPlan> = {}): ItemPlan {
    return {
        rarity: 'rare',
        base: { type: 'base', id: 'Crude Bow' },
        name: '',
        corrupted: false,
        itemLevel: null,
        props: { quality: 0, armour: 0, evasion: 0, energyShield: 0, block: 0 },
        stats: [],
        uniqueMods: [],
        sockets: [],
        priority: null,
        ...overrides,
    };
}

function reference(overrides: Partial<PlanReference> = {}): PlanReference {
    return {
        type: 'base',
        id: 'Crude Bow',
        name: 'Crude Bow',
        category: 'Bow',
        weapon: {
            damageMin: 6,
            damageMax: 9,
            critical: 500,
            attackTime: 833,
            rangeMax: 120,
            reloadTime: 0,
        },
        spirit: 0,
        ...overrides,
    };
}

const mods = {
    AddedCold: {
        rolls: [
            { stat: 'local_minimum_added_cold_damage', min: 10, max: 12 },
            { stat: 'local_maximum_added_cold_damage', min: 18, max: 22 },
        ],
    },
    IncPhys: {
        rolls: [{ stat: 'local_physical_damage_+%', min: 40, max: 60 }],
    },
    AttackSpeed: {
        rolls: [{ stat: 'local_attack_speed_+%', min: 20, max: 25 }],
    },
    IncCrit: {
        rolls: [{ stat: 'local_critical_strike_chance_+%', min: 20, max: 30 }],
    },
    ReloadSpeed: {
        rolls: [{ stat: 'local_reload_speed_+%', min: 25, max: 25 }],
    },
    GlobalCold: {
        rolls: [
            { stat: 'attack_minimum_added_cold_damage', min: 10, max: 12 },
            { stat: 'attack_maximum_added_cold_damage', min: 18, max: 22 },
        ],
    },
    SpiritInc: {
        rolls: [{ stat: 'local_spirit_+%', min: 20, max: 20 }],
    },
} as unknown as ModMap;

function lineMap(lines: ReturnType<typeof weaponStatLines>) {
    return Object.fromEntries(lines.map((line) => [line.label, line]));
}

test('returns nothing for a non-weapon reference', () => {
    expect(weaponStatLines(undefined, item(), {})).toEqual([]);
    expect(
        weaponStatLines(reference({ weapon: null, spirit: 0 }), item(), {}),
    ).toEqual([]);
});

test('renders the bare base stats, unmodified', () => {
    const lines = lineMap(weaponStatLines(reference(), item(), {}));

    expect(lines['Physical Damage']).toEqual({
        label: 'Physical Damage',
        value: '6-9',
        modified: false,
    });
    expect(lines['Critical Hit Chance'].value).toBe('5.00%');
    expect(lines['Attacks per Second'].value).toBe('1.20');
    // Projectile weapons show no Weapon Range line, and a 0 reload shows no reload.
    expect(lines['Weapon Range']).toBeUndefined();
    expect(lines['Reload Time']).toBeUndefined();
});

test('local added elemental damage becomes its own line; global added does not', () => {
    const local = lineMap(
        weaponStatLines(
            reference(),
            item({ stats: [{ modId: 'AddedCold', values: [11, 20] }] }),
            mods,
        ),
    );

    expect(local['Cold Damage']).toEqual({
        label: 'Cold Damage',
        value: '11-20',
        modified: true,
    });

    const global = lineMap(
        weaponStatLines(
            reference(),
            item({ stats: [{ modId: 'GlobalCold', values: [11, 20] }] }),
            mods,
        ),
    );

    expect(global['Cold Damage']).toBeUndefined();
});

test('quality and local increased physical damage scale the physical line', () => {
    const lines = lineMap(
        weaponStatLines(
            reference(),
            item({
                props: {
                    quality: 20,
                    armour: 0,
                    evasion: 0,
                    energyShield: 0,
                    block: 0,
                },
                stats: [{ modId: 'IncPhys', values: [50] }],
            }),
            mods,
        ),
    );

    // (6..9) * (1 + (50 + 20) / 100) = 10.2..15.3 -> rounded.
    expect(lines['Physical Damage']).toEqual({
        label: 'Physical Damage',
        value: '10-15',
        modified: true,
    });
});

test('local attack speed and crit chance modifiers scale their lines', () => {
    const lines = lineMap(
        weaponStatLines(
            reference(),
            item({
                stats: [
                    { modId: 'AttackSpeed', values: [25] },
                    { modId: 'IncCrit', values: [20] },
                ],
            }),
            mods,
        ),
    );

    // 1000/833 * 1.25 = 1.5006; 5.00% * 1.2 = 6.00%.
    expect(lines['Attacks per Second']).toEqual({
        label: 'Attacks per Second',
        value: '1.50',
        modified: true,
    });
    expect(lines['Critical Hit Chance']).toEqual({
        label: 'Critical Hit Chance',
        value: '6.00%',
        modified: true,
    });
});

test('a crossbow shows its reload time, sped up by local reload speed', () => {
    const crossbow = reference({
        category: 'Crossbow',
        weapon: {
            damageMin: 7,
            damageMax: 12,
            critical: 500,
            attackTime: 625,
            rangeMax: 120,
            reloadTime: 800,
        },
    });

    const bare = lineMap(weaponStatLines(crossbow, item(), {}));
    expect(bare['Reload Time']).toEqual({
        label: 'Reload Time',
        value: '0.80 sec',
        modified: false,
    });

    const faster = lineMap(
        weaponStatLines(
            crossbow,
            item({ stats: [{ modId: 'ReloadSpeed', values: [25] }] }),
            mods,
        ),
    );
    expect(faster['Reload Time'].value).toBe('0.64 sec');
});

test('a melee weapon shows its range in metres', () => {
    const spear = reference({
        category: 'Spear',
        weapon: {
            damageMin: 5,
            damageMax: 10,
            critical: 500,
            attackTime: 769,
            rangeMax: 13,
            reloadTime: 0,
        },
    });

    const lines = lineMap(weaponStatLines(spear, item(), {}));

    expect(lines['Weapon Range']).toEqual({
        label: 'Weapon Range',
        value: '1.3 metres',
        modified: false,
    });
});

test('a sceptre has no weapon row but shows its Spirit, scaled by local spirit', () => {
    const sceptre = reference({
        category: 'Sceptre',
        weapon: null,
        spirit: 100,
    });

    const bare = weaponStatLines(sceptre, item(), {});
    expect(bare).toEqual([{ label: 'Spirit', value: '100', modified: false }]);

    const scaled = weaponStatLines(
        sceptre,
        item({ stats: [{ modId: 'SpiritInc', values: [20] }] }),
        mods,
    );
    expect(scaled).toEqual([{ label: 'Spirit', value: '120', modified: true }]);
});
