import type { TreeData } from '@poe2-toolkit/tree-core';
import { expect, test } from 'vitest';
import { compileNodeMatcher, searchTreeNodes } from './nodeSearch';

/** A minimal tree holding one node of every shape the search has to handle. */
const DATA = {
    nodes: {
        1: { skill: 1, name: 'Heavy Buffer', stats: ['10% increased Armour'] },
        2: {
            skill: 2,
            name: 'Mystic',
            stats: ['20% increased Mana Regeneration Rate'],
        },
        3: {
            skill: 3,
            name: 'Attribute',
            stats: [],
            isAttribute: true,
            options: [
                {
                    id: 30,
                    name: 'Strength',
                    stats: ['+5 to Strength'],
                    icon: '',
                },
                {
                    id: 31,
                    name: 'Intelligence',
                    stats: ['+5 to Intelligence'],
                    icon: '',
                },
            ],
        },
        4: {
            skill: 4,
            name: 'Gathering Storm',
            stats: [],
            ascendancyName: 'Deadeye',
        },
        5: {
            skill: 5,
            name: 'Storm Rider',
            stats: [],
            ascendancyName: 'Stormweaver',
        },
        // No name - only the stat line can match it.
        6: { skill: 6, stats: ['Regenerate 2% of Life per second'] },
        // No stats - only the name can match it.
        7: { skill: 7, name: 'Bare Socket' },
        // Attribute node whose only option carries no stats.
        8: {
            skill: 8,
            name: 'Blank Attribute',
            stats: [],
            isAttribute: true,
            options: [{ id: 80, name: 'Dexterity', icon: '' }],
        },
        9: { skill: 9, name: 'Empowered Attacks (Melee)', stats: [] },
        10: { skill: 10, name: 'Sponge', stats: ['25% more Life Recovery'] },
        11: { skill: 11, name: 'Patient', stats: ['0.6 seconds of Duration'] },
        12: { skill: 12, name: 'Hardy', stats: ['016 seconds of Fortify'] },
    },
} as unknown as TreeData;

test('matches by node name and by stat text, case-insensitively', function () {
    expect(searchTreeNodes(DATA, 'heavy', null, null)).toEqual(new Set([1]));
    expect(searchTreeNodes(DATA, 'mana regen', null, null)).toEqual(
        new Set([2]),
    );
});

test('a node with no name, or no stats, still matches on the half it has', function () {
    expect(searchTreeNodes(DATA, 'regenerate 2%', null, null)).toEqual(
        new Set([6]),
    );
    expect(searchTreeNodes(DATA, 'bare socket', null, null)).toEqual(
        new Set([7]),
    );
});

test('a query shorter than the minimum, or no tree data, matches nothing', function () {
    expect(searchTreeNodes(DATA, 'h', null, null).size).toBe(0);
    expect(searchTreeNodes(DATA, '   ', null, null).size).toBe(0);
    expect(searchTreeNodes(null, 'heavy', null, null).size).toBe(0);
    expect(compileNodeMatcher('h')).toBeNull();
});

test("only the active ascendancy's nodes can match", function () {
    // Both carry "Storm"; Stormweaver's node is off-canvas, so it must not ring.
    expect(searchTreeNodes(DATA, 'storm', 'Deadeye', null)).toEqual(
        new Set([4]),
    );
    expect(searchTreeNodes(DATA, 'storm', null, null).size).toBe(0);
});

test("an allocated attribute node matches by its chosen option's text", function () {
    const allocation = {
        classId: 0,
        allocated: [3],
        attributeChoices: { 3: 'int' as const },
    };

    expect(searchTreeNodes(DATA, 'intelligence', null, allocation)).toEqual(
        new Set([3]),
    );
    // Matching the option's stat line, not its name.
    expect(searchTreeNodes(DATA, '+5 to int', null, allocation)).toEqual(
        new Set([3]),
    );
    // The un-chosen option's text must not match.
    expect(searchTreeNodes(DATA, 'strength', null, allocation).size).toBe(0);
    // Without the pick there is no option text at all.
    expect(searchTreeNodes(DATA, 'intelligence', null, null).size).toBe(0);
});

test('a chosen option with no stat lines matches on its name only', function () {
    const allocation = {
        classId: 0,
        allocated: [8],
        attributeChoices: { 8: 'dex' as const },
    };

    expect(searchTreeNodes(DATA, 'dexterity', null, allocation)).toEqual(
        new Set([8]),
    );
    expect(searchTreeNodes(DATA, 'dexterous', null, allocation).size).toBe(0);
});

test('a query holding pattern syntax searches as a regular expression', function () {
    // The point of the feature: one query, several stat pools.
    expect(searchTreeNodes(DATA, 'armour|mana regen', null, null)).toEqual(
        new Set([1, 2]),
    );
    expect(searchTreeNodes(DATA, 'ARMOUR|MANA REGEN', null, null)).toEqual(
        new Set([1, 2]),
    );
    // Anchors bite on each name and stat line individually.
    expect(searchTreeNodes(DATA, '^Heavy', null, null)).toEqual(new Set([1]));
    expect(searchTreeNodes(DATA, '^Buffer', null, null).size).toBe(0);
    expect(searchTreeNodes(DATA, 'mana.*rate', null, null)).toEqual(
        new Set([2]),
    );
    expect(searchTreeNodes(DATA, '\\d+% increased', null, null)).toEqual(
        new Set([1, 2]),
    );
    expect(searchTreeNodes(DATA, 'Regenerat{1,1}ion', null, null)).toEqual(
        new Set([2]),
    );
});

test('an unfinished or invalid pattern falls back to a literal search', function () {
    // Unterminated group, so it searches as the typed text a node name holds.
    expect(searchTreeNodes(DATA, 's (Melee', null, null)).toEqual(new Set([9]));
    // Matches nothing, but must never throw.
    expect(() => searchTreeNodes(DATA, 'ar[', null, null)).not.toThrow();
    expect(searchTreeNodes(DATA, 'ar[', null, null).size).toBe(0);
});

test('a bare + or . in a query stays literal', function () {
    // As patterns these would match "more Life" and "016 s"; as text neither does.
    expect(searchTreeNodes(DATA, 'e+ Life', null, null).size).toBe(0);
    expect(searchTreeNodes(DATA, '0.6 s', null, null)).toEqual(new Set([11]));
});

test('a dot quantified into .+ is the one pairing that does compile', function () {
    // The exception to the rule above: neither character alone is a hint,
    // the pair is.
    expect(searchTreeNodes(DATA, 'mana.+rate', null, null)).toEqual(
        new Set([2]),
    );
    expect(searchTreeNodes(DATA, 'mana+rate', null, null).size).toBe(0);
});

test('a pattern that also matches the empty string rings every node', function () {
    // A half-typed alternation ("ailment|") is a valid regex matching
    // anything. Pinned, not guarded against: the hit count already reports it,
    // and a two-letter literal query matches hundreds of nodes anyway.
    const onScreen = new Set(
        Object.values(DATA.nodes)
            .filter((node) => !node.ascendancyName)
            .map((node) => node.skill),
    );

    expect(searchTreeNodes(DATA, 'armour|', null, null)).toEqual(onScreen);
    expect(searchTreeNodes(DATA, '.*', null, null)).toEqual(onScreen);
});

test('compileNodeMatcher returns a reusable predicate', function () {
    const literal = compileNodeMatcher('  Armour  ');
    const pattern = compileNodeMatcher('armour|evasion');

    expect(literal?.('10% increased Armour')).toBe(true);
    expect(literal?.('10% increased Evasion')).toBe(false);
    expect(pattern?.('10% increased Evasion')).toBe(true);
    expect(pattern?.('10% increased Life')).toBe(false);
});
