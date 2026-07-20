import { beforeEach, describe, expect, it, test } from 'vitest';
import {
    activeSectionKey,
    clearDraft,
    clonePlanSection,
    draftKeyFor,
    emptyAllocation,
    emptyBuild,
    emptyEntry,
    emptyGroup,
    emptySection,
    fallbackActiveTabId,
    loadDraft,
    makeCustomTab,
    moveTab,
    nextPhaseTab,
    reindex,
    removeTab,
    saveDraft,
    sectionFor,
    SINGLE_KEY,
} from '@/lib/planner';
import type { PlanDraft } from '@/lib/planner';
import { BASE_PHASES, MAX_CUSTOM_TABS } from '@/types/planner';
import type { PlanData, PlanEntry, PlanTab } from '@/types/planner';

describe('empty factories', () => {
    it('stamps a fresh entry with a client id and default priority', () => {
        const entry = emptyEntry('items');

        expect(entry.id).toMatch(/^e-/);
        expect(entry.priority).toBe(1);
        expect(entry.kind).toBeUndefined();
    });

    it('marks a gems entry as an active gem', () => {
        expect(emptyEntry('gems').kind).toBe('active');
    });

    it('builds an empty allocation and build shell', () => {
        expect(emptyAllocation()).toEqual({
            allocated: [],
            attributeChoices: {},
            weaponSets: {},
            jewels: {},
            treeVersion: null,
        });
        expect(emptyBuild()).toEqual({ className: null, ascendId: null });
        expect(emptyGroup()).toEqual({ notes: '', entries: [] });
    });

    it('assembles a full section set', () => {
        const section = emptySection();

        expect(section.items.slots).toEqual({});
        expect(section.gems.groups).toEqual([]);
        expect(section.tree.allocation).toEqual(emptyAllocation());
    });

    it('labels a custom tab with a client id', () => {
        const tab = makeCustomTab('Endgame');

        expect(tab).toMatchObject({ label: 'Endgame', kind: 'custom' });
        expect(tab.id).toMatch(/^c-/);
    });
});

describe('nextPhaseTab', () => {
    it('reveals base phases one at a time in fixed order', () => {
        expect(nextPhaseTab([])).toMatchObject({
            id: BASE_PHASES[0].id,
            kind: 'base',
        });

        const withFirst: PlanTab[] = [{ ...BASE_PHASES[0], kind: 'base' }];
        expect(nextPhaseTab(withFirst)).toMatchObject({
            id: BASE_PHASES[1].id,
            kind: 'base',
        });
    });

    it('offers a custom phase once every base phase is present', () => {
        const allBase = BASE_PHASES.map((phase): PlanTab => ({
            ...phase,
            kind: 'base',
        }));

        expect(nextPhaseTab(allBase)).toMatchObject({
            kind: 'custom',
            label: 'New phase',
        });
    });

    it('returns null when the custom cap is reached', () => {
        const allBase = BASE_PHASES.map((phase): PlanTab => ({
            ...phase,
            kind: 'base',
        }));
        const customs = Array.from(
            { length: MAX_CUSTOM_TABS },
            (_, index): PlanTab => ({
                id: `c-${index}`,
                label: `Custom ${index}`,
                kind: 'custom',
            }),
        );

        expect(nextPhaseTab([...allBase, ...customs])).toBeNull();
    });
});

describe('moveTab', () => {
    const tabs: PlanTab[] = [
        { id: 'a', label: 'A', kind: 'base' },
        { id: 'b', label: 'B', kind: 'base' },
        { id: 'c', label: 'C', kind: 'custom' },
    ];

    it('swaps a tab with its left neighbour', () => {
        expect(moveTab(tabs, 'b', 'left')).toEqual([
            { id: 'b', label: 'B', kind: 'base' },
            { id: 'a', label: 'A', kind: 'base' },
            { id: 'c', label: 'C', kind: 'custom' },
        ]);
    });

    it('swaps a tab with its right neighbour', () => {
        expect(moveTab(tabs, 'b', 'right')).toEqual([
            { id: 'a', label: 'A', kind: 'base' },
            { id: 'c', label: 'C', kind: 'custom' },
            { id: 'b', label: 'B', kind: 'base' },
        ]);
    });

    it('returns the same reference when the first tab tries to move left', () => {
        expect(moveTab(tabs, 'a', 'left')).toBe(tabs);
    });

    it('returns the same reference when the last tab tries to move right', () => {
        expect(moveTab(tabs, 'c', 'right')).toBe(tabs);
    });

    it('returns the same reference for an unknown id', () => {
        expect(moveTab(tabs, 'ghost', 'left')).toBe(tabs);
    });
});

describe('removeTab', () => {
    const tabs: PlanTab[] = [
        { id: 'a', label: 'A', kind: 'base' },
        { id: 'b', label: 'B', kind: 'base' },
        { id: 'c', label: 'C', kind: 'custom' },
    ];

    it('drops the named tab', () => {
        expect(removeTab(tabs, 'b')).toEqual([
            { id: 'a', label: 'A', kind: 'base' },
            { id: 'c', label: 'C', kind: 'custom' },
        ]);
    });

    it('returns the same reference for an unknown id', () => {
        expect(removeTab(tabs, 'ghost')).toBe(tabs);
    });

    it('returns the same reference when only one tab remains', () => {
        const single: PlanTab[] = [{ id: 'a', label: 'A', kind: 'base' }];

        expect(removeTab(single, 'a')).toBe(single);
    });
});

describe('fallbackActiveTabId', () => {
    const tabs: PlanTab[] = [
        { id: 'a', label: 'A', kind: 'base' },
        { id: 'b', label: 'B', kind: 'base' },
        { id: 'c', label: 'C', kind: 'custom' },
    ];

    it("lands on the tab that took the removed one's place", () => {
        const remaining = removeTab(tabs, 'b');

        expect(fallbackActiveTabId(tabs, remaining, 'b')).toBe('c');
    });

    it('falls back to the new last tab when the last one was removed', () => {
        const remaining = removeTab(tabs, 'c');

        expect(fallbackActiveTabId(tabs, remaining, 'c')).toBe('b');
    });
});

describe('clonePlanSection', () => {
    it('deep copies so edits to the clone never touch the source', () => {
        const source = emptySection();
        source.items.entries.push({
            id: 'e-1',
            name: 'Boots',
            note: '',
            priority: 1,
        });

        const clone = clonePlanSection(source);
        clone.items.entries[0].name = 'Gloves';

        expect(source.items.entries[0].name).toBe('Boots');
    });
});

describe('reindex', () => {
    it('renumbers priorities to match list order', () => {
        const entries: PlanEntry[] = [
            { id: 'a', name: '', note: '', priority: 9 },
            { id: 'b', name: '', note: '', priority: 4 },
        ];

        expect(reindex(entries).map((entry) => entry.priority)).toEqual([1, 2]);
    });
});

describe('activeSectionKey', () => {
    it('uses the reserved key in single mode and the tab id otherwise', () => {
        expect(activeSectionKey('single', 'tab-7')).toBe(SINGLE_KEY);
        expect(activeSectionKey('phases', 'tab-7')).toBe('tab-7');
    });
});

describe('sectionFor', () => {
    it('falls back to an empty section for an unknown key', () => {
        const plan = { sections: {} } as unknown as PlanData;

        expect(sectionFor(plan, 'missing')).toEqual(emptySection());
    });

    it('returns the stored section when present', () => {
        const section = emptySection();
        const plan = { sections: { keep: section } } as unknown as PlanData;

        expect(sectionFor(plan, 'keep')).toBe(section);
    });
});

describe('drafts', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('keys a draft per slug, sharing one key for a brand-new plan', () => {
        expect(draftKeyFor('fire-sorc')).toBe('planner-draft:fire-sorc');
        expect(draftKeyFor(null)).toBe('planner-draft:new');
    });

    test('round-trips a saved draft and clears it', () => {
        const draft: PlanDraft = {
            title: 'Draft',
            description: '',
            mode: 'single',
            build: emptyBuild(),
            tabs: [],
            sections: {},
            activeTabId: SINGLE_KEY,
        };
        const key = draftKeyFor('slug');

        saveDraft(key, draft);
        expect(loadDraft(key)).toEqual(draft);

        clearDraft(key);
        expect(loadDraft(key)).toBeNull();
    });

    test('returns null for a missing or corrupt draft', () => {
        expect(loadDraft('planner-draft:none')).toBeNull();

        window.localStorage.setItem('planner-draft:bad', '{not json');
        expect(loadDraft('planner-draft:bad')).toBeNull();
    });

    test('round-trips a draft with populated sections', () => {
        const draft: PlanDraft = {
            title: 'Draft',
            description: '',
            mode: 'phases',
            build: emptyBuild(),
            tabs: [{ id: 'act-1', label: 'Act I', kind: 'base' }],
            sections: { 'act-1': emptySection() },
            activeTabId: 'act-1',
        };
        const key = draftKeyFor('full');

        saveDraft(key, draft);
        expect(loadDraft(key)).toEqual(draft);
    });

    test('drops a draft whose shape no longer matches', () => {
        const key = draftKeyFor('stale');

        // Valid JSON, wrong shape: a pre-schema-change or hand-edited value.
        window.localStorage.setItem(key, JSON.stringify({ title: 'x' }));
        expect(loadDraft(key)).toBeNull();

        window.localStorage.setItem(
            key,
            JSON.stringify({
                title: 'x',
                description: '',
                mode: 'nope',
                build: emptyBuild(),
                tabs: [],
                sections: {},
                activeTabId: SINGLE_KEY,
            }),
        );
        expect(loadDraft(key)).toBeNull();
    });

    test('drops a draft carrying a malformed section group', () => {
        const key = draftKeyFor('broken');

        window.localStorage.setItem(
            key,
            JSON.stringify({
                title: 'x',
                description: '',
                mode: 'single',
                build: emptyBuild(),
                tabs: [],
                // The items group lost its entries array.
                sections: {
                    [SINGLE_KEY]: {
                        items: { notes: '' },
                        gems: emptyGroup(),
                        tree: emptyGroup(),
                    },
                },
                activeTabId: SINGLE_KEY,
            }),
        );
        expect(loadDraft(key)).toBeNull();
    });
});
