// Unit tests for the mod catalogue's pure transforms: display-scale roll derivation,
// the per-minute -> per-second render shim, essence class mapping and the craft-only
// (desecrated/essence) flags on catalogue entries. No CDN or table I/O.

import { describe, expect, it } from 'vitest';

import { buildEssenceClasses, buildModCatalogue, toDisplayRolls, toPerSecondStats } from './mod-catalogue.mjs';

describe('toPerSecondStats', () => {
    it('rescales per-minute rolls to the per-second display, two decimals', () => {
        const stats = ['Gains 15 Charges per Second'];
        const rolls = [{ stat: 'local_flask_gain_X_charges_every_minute', min: 15, max: 15 }];

        expect(toPerSecondStats(stats, rolls)).toEqual(['Gains 0.25 Charges per Second']);
    });

    it('rescales ranged tokens and leaves other stats untouched', () => {
        const stats = ['Gains (9-12) Charges per Second', '+(10-20) to maximum Life'];
        const rolls = [
            { stat: 'local_flask_gain_X_charges_every_minute', min: 9, max: 12 },
            { stat: 'base_maximum_life', min: 10, max: 20 },
        ];

        expect(toPerSecondStats(stats, rolls)).toEqual([
            'Gains (0.15-0.2) Charges per Second',
            '+(10-20) to maximum Life',
        ]);
    });

    it('returns the lines untouched without a per-minute roll or on a token mismatch', () => {
        const life = ['+(10-20) to maximum Life'];
        const lifeRolls = [{ stat: 'base_maximum_life', min: 10, max: 20 }];

        expect(toPerSecondStats(life, lifeRolls)).toBe(life);

        // A flavour line renders no number: token count differs from roll count.
        const flavour = ['Instant Recovery'];
        const flavourRolls = [{ stat: 'local_flask_gain_X_charges_every_minute', min: 9, max: 9 }];

        expect(toPerSecondStats(flavour, flavourRolls)).toBe(flavour);
    });

    it('rebuilds a token the renderer already mangled from the raw roll', () => {
        // The renderer's plain per_minute handler divided 60-120 by 100 and rounded
        // both ends to "1"; the raw roll still holds the exact per-minute range.
        const stats = ['1 Life Regeneration per second'];
        const rolls = [{ stat: 'base_life_regeneration_rate_per_minute', min: 60, max: 120 }];

        expect(toPerSecondStats(stats, rolls)).toEqual(['(1-2) Life Regeneration per second']);
    });

    it('leaves a per-minute roll alone when its line is not worded per second', () => {
        const stats = ['Regains 30 Charges per Minute'];
        const rolls = [{ stat: 'local_flask_gain_X_charges_every_minute', min: 30, max: 30 }];

        expect(toPerSecondStats(stats, rolls)).toEqual(stats);
    });

    it('feeds toDisplayRolls the rescaled ranges', () => {
        const stats = toPerSecondStats(
            ['Gains 15 Charges per Second'],
            [{ stat: 'local_flask_gain_X_charges_every_minute', min: 15, max: 15 }],
        );

        expect(toDisplayRolls(stats, [{ stat: 'local_flask_gain_X_charges_every_minute', min: 15, max: 15 }]))
            .toEqual([{ stat: 'local_flask_gain_X_charges_every_minute', min: 0.25, max: 0.25 }]);
    });
});

describe('buildEssenceClasses', () => {
    it('maps mods to item classes through their target categories, unioned across rows', () => {
        const modRows = [{ Id: 'EssenceColdA' }, { Id: 'EssenceColdB' }, { Id: 'OutcomeMod' }];
        const itemClassRows = [{ Id: 'Crossbow' }, { Id: 'Bow' }, { Id: 'Ring' }];
        const categoryRows = [
            { Id: 'TwoHand', ItemClasses: [0, 1] },
            { Id: 'Jewellery', ItemClasses: [2] },
        ];
        const essenceModRows = [
            { TargetItemCategory: 0, Mod: 0, DisplayMod: null, OutcomeMods: [2] },
            { TargetItemCategory: 1, Mod: 0, DisplayMod: 1, OutcomeMods: [] },
        ];

        expect(buildEssenceClasses(essenceModRows, categoryRows, itemClassRows, modRows)).toEqual({
            EssenceColdA: ['Bow', 'Crossbow', 'Ring'],
            EssenceColdB: ['Ring'],
            OutcomeMod: ['Bow', 'Crossbow'],
        });
    });
});

describe('buildModCatalogue craft-only flags', () => {
    const base = {
        name: null,
        group: 'G',
        tier: 1,
        level: 1,
        stats: ['+(1-10) to maximum Life'],
        rolls: [{ stat: 'base_maximum_life', min: 1, max: 10 }],
        families: [],
    };

    it('folds the desecrated domain into Item mods flagged desecrated', () => {
        const mods = buildModCatalogue({
            BoneMod: { ...base, domain: 'Unveiled', generationType: 'Suffix', spawnWeights: [{ tag: 'weapon', weight: 1 }, { tag: 'default', weight: 0 }] },
        });

        expect(mods).toHaveLength(1);
        expect(mods[0]).toMatchObject({ id: 'BoneMod', domain: 'Item', type: 'suffix', desecrated: true, essence: false });
    });

    it('flags essence-only mods (no positive weight) and carries their item classes', () => {
        const mods = buildModCatalogue(
            {
                EssenceOnly: { ...base, domain: 'Item', generationType: 'Prefix', spawnWeights: [{ tag: 'default', weight: 0 }] },
            },
            { EssenceOnly: ['Crossbow', 'Bow'] },
        );

        expect(mods[0]).toMatchObject({ essence: true, itemClasses: ['Crossbow', 'Bow'], desecrated: false });
    });

    it('keeps an essence-granted mod natural when it also rolls naturally', () => {
        const mods = buildModCatalogue(
            {
                NaturalTier: { ...base, domain: 'Item', generationType: 'Prefix', spawnWeights: [{ tag: 'ring', weight: 500 }, { tag: 'default', weight: 0 }] },
            },
            { NaturalTier: ['Body Armour'] },
        );

        expect(mods[0]).toMatchObject({ essence: false, itemClasses: [] });
    });

    it('still excludes foreign domains and non-affix generation types', () => {
        const mods = buildModCatalogue({
            MonsterMod: { ...base, domain: 'Monster', generationType: 'Prefix', spawnWeights: [] },
            UniqueMod: { ...base, domain: 'Item', generationType: 'Unique', spawnWeights: [] },
        });

        expect(mods).toEqual([]);
    });
});
