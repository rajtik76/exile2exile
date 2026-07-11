import { expect, test } from 'vitest';
import { isNumberArray, isRecord } from '@/lib/guards';

test('isRecord accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);

    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(1)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
});

test('isNumberArray accepts arrays of numbers only', () => {
    expect(isNumberArray([])).toBe(true);
    expect(isNumberArray([1, 2, 3])).toBe(true);

    expect(isNumberArray([1, '2'])).toBe(false);
    expect(isNumberArray('1,2')).toBe(false);
    expect(isNumberArray(null)).toBe(false);
    expect(isNumberArray({ 0: 1 })).toBe(false);
});
