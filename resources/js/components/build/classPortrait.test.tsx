import { describe, expect, it, vi } from 'vitest';

// Keep the catalog under test free of the tree-scene asset plumbing.
vi.mock('@/lib/tree-scene', () => ({
    treeAssetUrl: (name: string) => `/tree/current/assets/${name}.webp`,
}));

import { ascendancyLabel } from '@/components/build/classPortrait';

/**
 * `ascendancyLabel` is what lets the planner pages label a build without downloading
 * the passive tree first. It knows display names from the static class sheet and takes
 * anything else pre-resolved from the server, so the one thing it must never do is put
 * a raw internal id in front of a reader.
 */
describe('ascendancyLabel', () => {
    it('recognises a display name the class carries', () => {
        // What the class gallery stores, so no server resolution is needed at all.
        expect(ascendancyLabel('Mercenary', 'Witchhunter', null)).toBe(
            'Witchhunter',
        );
    });

    it('matches a display name loosely, ignoring case and spacing', () => {
        expect(ascendancyLabel('witch', 'bloodmage', null)).toBe('Blood Mage');
    });

    it('falls back to the server resolution for a GGG internal id', () => {
        // What a PoB import stores; only the GGPK tree knows this maps to Witchhunter.
        expect(ascendancyLabel('Mercenary', 'Mercenary2', 'Witchhunter')).toBe(
            'Witchhunter',
        );
    });

    it('returns null rather than echoing an unresolved id', () => {
        expect(ascendancyLabel('Mercenary', 'Mercenary2', null)).toBeNull();
    });

    it('returns null for an unknown class or a missing ascendancy', () => {
        // Templar is one of GGPK's PoE1 placeholder classes - no released ascendancy.
        expect(ascendancyLabel('Templar', 'Templar1', 'Guardian')).toBeNull();
        expect(ascendancyLabel('Mercenary', null, 'Witchhunter')).toBeNull();
        expect(ascendancyLabel(null, 'Witchhunter', 'Witchhunter')).toBeNull();
    });

    it('does not resolve another class ascendancy', () => {
        expect(ascendancyLabel('Mercenary', 'Blood Mage', null)).toBeNull();
    });

    it('skips the sheet frames that carry no named ascendancy', () => {
        // Ranger's middle frame is empty in the sheet, and loose matching strips every
        // non-alphanumeric character - so an id like "-" normalises to the same empty
        // string that frame does. Without the guard against empty frames it would match
        // and hand back '' as the label; the server's resolution must win instead.
        expect(ascendancyLabel('Ranger', '-', 'Deadeye')).toBe('Deadeye');
    });

    it('treats an empty ascendancy id as no ascendancy at all', () => {
        expect(ascendancyLabel('Ranger', '', 'Deadeye')).toBeNull();
    });
});
