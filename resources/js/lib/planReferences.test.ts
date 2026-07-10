import { expect, test } from 'vitest';
import { collectTokens, insertToken } from '@/lib/planReferences';

test('collectTokens gathers every distinct token across texts', () => {
    const tokens = collectTokens([
        'Open with {{gem:SkillGemIceNova|Ice Nova}} then {{gem:SkillGemIceNova|Ice Nova}}.',
        'Grab {{unique:Evergrasping Ring|Evergrasping Ring}} and {{rune:Desert Rune|Desert Rune}}.',
    ]);

    expect(tokens).toEqual([
        { type: 'gem', id: 'SkillGemIceNova' },
        { type: 'unique', id: 'Evergrasping Ring' },
        { type: 'rune', id: 'Desert Rune' },
    ]);
});

test('collectTokens ignores malformed tokens', () => {
    expect(collectTokens(['no {{gem}} bare, {{gem:|empty}} id'])).toEqual([]);
});

test('insertToken splices a token at the selection', () => {
    const { text } = insertToken('ab cd', 3, 3, {
        type: 'gem',
        id: 'X',
        name: 'X',
    });

    expect(text).toBe('ab {{gem:X|X}}cd');
});
