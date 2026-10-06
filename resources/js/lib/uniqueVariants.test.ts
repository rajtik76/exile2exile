import { expect, test } from 'vitest';
import type { UniqueModLine } from '@/lib/planReferences';
import {
    activeUniqueLines,
    normaliseVariantSelection,
} from '@/lib/uniqueVariants';
import type { UniqueVariantModel } from '@/lib/uniqueVariants';

/*
 * Same cases as the server's PobItemVariantsTest: the client filters a unique's lines
 * exactly the way the server validates them.
 */

function line(
    template: string,
    tags: Partial<Pick<UniqueModLine, 'variants' | 'versions' | 'groups'>> = {},
): UniqueModLine {
    return { key: template, template, rolls: [], ...tags };
}

function texts(lines: UniqueModLine[]): string[] {
    return lines.map((entry) => entry.template);
}

const guidingPalm: UniqueVariantModel = {
    variants: ['Fire', 'Cold', 'Lightning'],
    versions: [],
    altSlots: [],
    groups: [],
    defaults: { variant: 3 },
};
const guidingPalmLines = [
    line('Purity of Fire', { variants: [1] }),
    line('Purity of Ice', { variants: [2] }),
    line('Purity of Lightning', { variants: [3] }),
    line('+(5-10) to all Attributes'),
];

test('without a variant model every line applies', () => {
    expect(texts(activeUniqueLines(guidingPalmLines, null, undefined))).toEqual(
        texts(guidingPalmLines),
    );
});

test('a classic unique shows its default variant, or the picked one', () => {
    expect(texts(activeUniqueLines(guidingPalmLines, guidingPalm, []))).toEqual(
        ['Purity of Lightning', '+(5-10) to all Attributes'],
    );
    expect(
        texts(activeUniqueLines(guidingPalmLines, guidingPalm, { variant: 2 })),
    ).toEqual(['Purity of Ice', '+(5-10) to all Attributes']);
});

test('alt variants each add their own lines', () => {
    const model: UniqueVariantModel = {
        variants: ['Spirit', 'Life', 'Mana'],
        versions: [],
        altSlots: [1],
        groups: [],
        defaults: { variant: 1, alts: { '1': 2 } },
    };
    const lines = [
        line('Spirit per Socket', { variants: [1] }),
        line('Life per Socket', { variants: [2] }),
        line('Mana per Socket', { variants: [3] }),
    ];

    expect(texts(activeUniqueLines(lines, model, undefined))).toEqual([
        'Spirit per Socket',
        'Life per Socket',
    ]);
    expect(
        texts(
            activeUniqueLines(lines, model, { variant: 3, alts: { '1': 1 } }),
        ),
    ).toEqual(['Spirit per Socket', 'Mana per Socket']);
});

test('a versioned unique defaults to its latest version', () => {
    const model: UniqueVariantModel = {
        variants: [],
        versions: ['Pre 0.5.0', 'Current'],
        altSlots: [],
        groups: [],
        defaults: { version: 2 },
    };
    const lines = [
        line('+(60-80) to maximum Life'),
        line('(10-15)% increased Spirit', { versions: [2] }),
        line('Old roll', { versions: [1] }),
    ];

    expect(texts(activeUniqueLines(lines, model, undefined))).toEqual([
        '+(60-80) to maximum Life',
        '(10-15)% increased Spirit',
    ]);
    expect(texts(activeUniqueLines(lines, model, { version: 1 }))).toEqual([
        '+(60-80) to maximum Life',
        'Old roll',
    ]);
});

test('variant groups never pick the same variant twice', () => {
    const model: UniqueVariantModel = {
        variants: ['Helmet', 'Gloves', 'Armour', 'Evasion'],
        versions: [],
        altSlots: [],
        groups: { '1': { '1': [0], '2': [0] }, '2': { '3': [0], '4': [0] } },
        defaults: { groups: { '1': 1, '2': 3 } },
    };
    const lines = [
        line('also a Helmet', { variants: [1], groups: [1] }),
        line('also Gloves', { variants: [2], groups: [1] }),
        line('increased Armour', { variants: [3], groups: [2] }),
        line('increased Evasion Rating', { variants: [4], groups: [2] }),
    ];

    expect(texts(activeUniqueLines(lines, model, undefined))).toEqual([
        'also a Helmet',
        'increased Armour',
    ]);
    expect(
        texts(activeUniqueLines(lines, model, { groups: { '1': 2, '2': 4 } })),
    ).toEqual(['also Gloves', 'increased Evasion Rating']);
    // A pick from another group's options is not valid for this one.
    expect(
        normaliseVariantSelection(model, { groups: { '1': 3 } }).groups,
    ).toEqual({ 1: 1, 2: 3 });
});
