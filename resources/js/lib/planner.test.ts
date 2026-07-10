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
    loadDraft,
    makeCustomTab,
    nextPhaseTab,
    reindex,
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
});
