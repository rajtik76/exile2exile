import { expect, test } from 'vitest';
import { matchesTerms } from '@/components/planner/ModPicker';

// The tier filter must accept everything the server-side affix search offered: that
// search matches by words in any order, so a substring test would hide tiers of a
// group the author just picked ("to attack" finds "+# to Level of all Attack Skills").
test('matches when every term appears somewhere, in any order', () => {
    const line = '+3 to Level of all Attack Skills';

    expect(matchesTerms(line, 'to attack')).toBe(true);
    expect(matchesTerms(line, 'attack level')).toBe(true);
    expect(matchesTerms(line, 'ATTACK skills')).toBe(true);
    expect(matchesTerms(line, '')).toBe(true);
});

test('rejects when any term is missing', () => {
    const line = '+3 to Level of all Attack Skills';

    expect(matchesTerms(line, 'spell level')).toBe(false);
    expect(matchesTerms(line, 'attack speed')).toBe(false);
});
