import { describe, expect, test } from 'vitest';
import {
    aggregateModLines,
    defaultModValues,
    modDisplayLines,
    modValuesValid,
    previewModLabel,
    rangedRollIndices,
    renderModDetail,
    renderModLines,
} from '@/lib/modLines';
import type { ModInfo } from '@/lib/modLines';

/** A single-range life prefix: +(10-19) to maximum Life. */
const life: ModInfo = {
    id: 'IncreasedLife1',
    name: 'Hale',
    group: 'IncreasedLife',
    type: 'prefix',
    tier: 1,
    level: 1,
    stats: ['+(10-19) to maximum Life'],
    rolls: [{ stat: 'base_maximum_life', min: 10, max: 19 }],
    families: ['IncreasedLife'],
};

/** A two-range added-damage line where both rolls are ranged. */
const addedCold: ModInfo = {
    id: 'AddedCold1',
    name: 'of Frost',
    group: 'AddedCold',
    type: 'suffix',
    tier: 1,
    level: 5,
    stats: ['Adds (3-5) to (8-12) Cold Damage'],
    rolls: [
        { stat: 'added_cold_min', min: 3, max: 5 },
        { stat: 'added_cold_max', min: 8, max: 12 },
    ],
    families: ['AddedCold'],
};

/** A fixed roll renders as a plain number with no editable token. */
const fixed: ModInfo = {
    id: 'ExtraBolt1',
    name: '',
    group: null,
    type: 'suffix',
    tier: null,
    level: 1,
    stats: ['Loads an additional bolt'],
    rolls: [{ stat: 'extra_bolt', min: 1, max: 1 }],
    families: [],
};

test('rangedRollIndices skips fixed rolls', () => {
    expect(rangedRollIndices(life)).toEqual([0]);
    expect(rangedRollIndices(addedCold)).toEqual([0, 1]);
    expect(rangedRollIndices(fixed)).toEqual([]);
});

test('defaultModValues rolls every value to its minimum', () => {
    expect(defaultModValues(life)).toEqual([10]);
    expect(defaultModValues(addedCold)).toEqual([3, 8]);
    expect(defaultModValues(fixed)).toEqual([1]);
});

test('renderModLines substitutes the rolled value into each range', () => {
    expect(renderModLines(life, [15])).toEqual(['+15 to maximum Life']);
    expect(renderModLines(addedCold, [4, 10])).toEqual([
        'Adds 4 to 10 Cold Damage',
    ]);
    // A fixed roll is already concrete, so the text passes through unchanged.
    expect(renderModLines(fixed, [1])).toEqual(['Loads an additional bolt']);
});

describe('modValuesValid', () => {
    test('accepts values inside every range', () => {
        expect(modValuesValid(life, [15])).toBe(true);
        expect(modValuesValid(addedCold, [3, 12])).toBe(true);
    });

    test('rejects an out-of-range or mis-counted value', () => {
        expect(modValuesValid(life, [20])).toBe(false);
        expect(modValuesValid(life, [])).toBe(false);
        expect(modValuesValid(addedCold, [4, 99])).toBe(false);
    });
});

test('modDisplayLines yields a value token per ranged roll', () => {
    const [line] = modDisplayLines(addedCold);
    const values = line.filter((token) => token.kind === 'value');

    expect(values).toEqual([
        { kind: 'value', rollIndex: 0, min: 3, max: 5 },
        { kind: 'value', rollIndex: 1, min: 8, max: 12 },
    ]);
    // A fixed-roll line has no value tokens - nothing to edit.
    expect(
        modDisplayLines(fixed)[0].every((token) => token.kind === 'text'),
    ).toBe(true);
});

test('previewModLabel blanks every number to a #', () => {
    expect(previewModLabel(life.stats)).toBe('+# to maximum Life');
    expect(previewModLabel(addedCold.stats)).toBe('Adds # to # Cold Damage');
});

describe('aggregateModLines', () => {
    test('sums lines that share the same wording into one, as the game does', () => {
        expect(
            aggregateModLines([
                '94% increased Armour and Evasion',
                '41% increased Armour and Evasion',
                '+103 to maximum Life',
                '+46 to maximum Life',
            ]),
        ).toEqual([
            '135% increased Armour and Evasion',
            '+149 to maximum Life',
        ]);
    });

    test('passes a unique line through and keeps fractional sums', () => {
        expect(
            aggregateModLines([
                '+30% to Lightning Resistance',
                'Leech 7.24% of Physical Attack Damage as Life',
            ]),
        ).toEqual([
            '+30% to Lightning Resistance',
            'Leech 7.24% of Physical Attack Damage as Life',
        ]);
    });

    test('sums both positions of a two-number line', () => {
        expect(
            aggregateModLines([
                'Adds 3 to 8 Cold Damage',
                'Adds 2 to 5 Cold Damage',
            ]),
        ).toEqual(['Adds 5 to 13 Cold Damage']);
    });
});

test('renderModDetail shows value(min-max) for ranged rolls', () => {
    expect(renderModDetail(life, [15])).toEqual(['+15(10-19) to maximum Life']);
    expect(renderModDetail(addedCold, [4, 10])).toEqual([
        'Adds 4(3-5) to 10(8-12) Cold Damage',
    ]);
    // A fixed roll stays a plain number.
    expect(renderModDetail(fixed, [1])).toEqual(['Loads an additional bolt']);
});
