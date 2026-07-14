import { expect, test } from 'vitest';
import type { UniqueModLine } from '@/lib/planReferences';
import {
    renderUniqueModLine,
    uniqueModTokens,
    uniqueModValuesValid,
} from '@/lib/uniqueModLines';

function line(overrides: Partial<UniqueModLine> = {}): UniqueModLine {
    return {
        key: '+# to maximum Life',
        template: '+(80-120) to maximum Life',
        rolls: [{ min: 80, max: 120 }],
        ...overrides,
    };
}

test('renderUniqueModLine substitutes a rolled value into its (min-max) token', () => {
    expect(renderUniqueModLine(line(), [110])).toBe('+110 to maximum Life');
});

test('renderUniqueModLine keeps decimal values as typed, not rounded', () => {
    const decimalLine = line({
        key: '# Life Regeneration per second',
        template: '(8-12) Life Regeneration per second',
        rolls: [{ min: 8, max: 12 }],
    });

    expect(renderUniqueModLine(decimalLine, [11.9])).toBe(
        '11.9 Life Regeneration per second',
    );
});

test('renderUniqueModLine falls back to the roll minimum when no value is stored yet', () => {
    expect(renderUniqueModLine(line(), [])).toBe('+80 to maximum Life');
});

test('renderUniqueModLine passes a flavour-text line through unchanged', () => {
    const flavour = line({
        key: 'Unwavering Stance',
        template: 'Unwavering Stance',
        rolls: [],
    });

    expect(renderUniqueModLine(flavour, [])).toBe('Unwavering Stance');
});

test('uniqueModValuesValid accepts a value inside its range, decimals included', () => {
    const decimalLine = line({ rolls: [{ min: 3.1, max: 6 }] });

    expect(uniqueModValuesValid(decimalLine, [4.5])).toBe(true);
});

test('uniqueModValuesValid rejects a value outside its range', () => {
    expect(uniqueModValuesValid(line(), [500])).toBe(false);
});

test('uniqueModValuesValid rejects a mismatched value count', () => {
    expect(uniqueModValuesValid(line(), [])).toBe(false);
    expect(uniqueModValuesValid(line(), [90, 100])).toBe(false);
});

test('uniqueModTokens splits a ranged line into text and value tokens', () => {
    expect(uniqueModTokens(line())).toEqual([
        { kind: 'text', text: '+' },
        { kind: 'value', rollIndex: 0, min: 80, max: 120 },
        { kind: 'text', text: ' to maximum Life' },
    ]);
});

test('uniqueModTokens returns a single text token for a flavour-text line', () => {
    const flavour = line({ template: 'Unwavering Stance', rolls: [] });

    expect(uniqueModTokens(flavour)).toEqual([
        { kind: 'text', text: 'Unwavering Stance' },
    ]);
});
