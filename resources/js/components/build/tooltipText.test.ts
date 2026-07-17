import { expect, test } from 'vitest';
import {
    cappedLevels,
    combineStatLines,
    combineStatText,
    formatStatNumber,
    minMax,
    rarityFrame,
    rarityTone,
    splitNumberedText,
} from './tooltipText';

test('maps a rarity to its accent and header banner, defaulting to normal/white', function () {
    expect(rarityTone('unique').text).toBe('#ef6916');
    expect(rarityTone('MAGIC').text).toBe('#8888ff');
    expect(rarityTone('anything else').text).toBe('#f7f7f3');

    expect(rarityFrame('magic')).toBe('magic');
    expect(rarityFrame('rare')).toBe('rare');
    expect(rarityFrame('UNIQUE')).toBe('unique');
    expect(rarityFrame('normal')).toBe('white');
});

test("leaves the text alone when the level's number never appears in it", function () {
    // The rendered line does not carry the raw min token at all (a formatting
    // mismatch) - nothing must be wrapped rather than mangling the wrong digits.
    const first = { text: 'Deals massive Damage', min: 1, max: 1 };
    const last = { text: 'Deals massive Damage', min: 5, max: 5 };

    expect(combineStatText(first, last)).toBe('Deals massive Damage');
});

test('combines matched per-level stat sets line by line', function () {
    const first = [
        { text: 'Deals 3 Damage', min: 3, max: 3 },
        { text: '10% increased Area', min: 10, max: 10 },
    ];
    const last = [
        { text: 'Deals 9 Damage', min: 9, max: 9 },
        { text: '10% increased Area', min: 10, max: 10 },
    ];

    expect(combineStatLines(first, last)).toEqual([
        'Deals (3—9) Damage',
        '10% increased Area',
    ]);
});

test('caps the displayed gem levels at 20', function () {
    const levels = [1, 20, 21, 40].map((level) => ({ level }));

    expect(cappedLevels(levels as never).map((l) => l.level)).toEqual([1, 20]);
});

test('minMax spans the present values and skips nulls', function () {
    expect(minMax([3, null, 9])).toEqual([3, 9]);
    expect(minMax([5, 5])).toEqual([5, 5]);
    expect(minMax([null, null])).toBeNull();
});

test('formats stat numbers exactly as rendered lines do', function () {
    expect(formatStatNumber(15)).toBe('15');
    expect(formatStatNumber(0.8)).toBe('0.80');
});

test('combines a scaling stat across two levels into range notation', function () {
    const first = { text: 'Deals 1 to 13 Lightning Damage', min: 1, max: 13 };
    const last = {
        text: 'Deals 20 to 386 Lightning Damage',
        min: 20,
        max: 386,
    };

    expect(combineStatText(first, last)).toBe(
        'Deals (1—20) to (13—386) Lightning Damage',
    );
});

test('a stat that does not scale keeps its plain single numbers', function () {
    const stat = {
        text: '50% increased Magnitude of Shock inflicted',
        min: 50,
        max: 50,
    };

    expect(combineStatText(stat, stat)).toBe(stat.text);
});

test('never wraps a token found inside an unrelated larger number', function () {
    // The min token "1" must not match inside "10%".
    const first = { text: '10% chance to gain 1 Charge', min: 1, max: 1 };
    const last = { text: '10% chance to gain 5 Charges', min: 5, max: 5 };

    expect(combineStatText(first, last)).toBe(
        '10% chance to gain (1—5) Charge',
    );
});

test('mismatched per-level stat sets fall back to the highest level lines', function () {
    const first = [{ text: 'A 1', min: 1, max: 1 }];
    const last = [
        { text: 'A 5', min: 5, max: 5 },
        { text: 'B 9', min: 9, max: 9 },
    ];

    expect(combineStatLines(first, last)).toEqual(['A 5', 'B 9']);
});

test('splits a line into text, number and range segments', function () {
    expect(splitNumberedText('Deals (1—20) to 13 Damage, +5% more')).toEqual([
        { kind: 'text', text: 'Deals ' },
        { kind: 'range', low: '1', high: '20' },
        { kind: 'text', text: ' to ' },
        { kind: 'number', text: '13' },
        { kind: 'text', text: ' Damage, ' },
        { kind: 'number', text: '+5' },
        { kind: 'text', text: '% more' },
    ]);
});

test('a line with no numbers stays one text segment', function () {
    expect(splitNumberedText('Cannot be Frozen')).toEqual([
        { kind: 'text', text: 'Cannot be Frozen' },
    ]);
});
