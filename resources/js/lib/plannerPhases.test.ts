import { describe, expect, it } from 'vitest';
import { clonePlanSection, emptySection, nextPhaseTab } from '@/lib/planner';
import { BASE_PHASES } from '@/types/planner';
import type { PlanTab } from '@/types/planner';

function base(id: string, label: string): PlanTab {
    return { id, label, kind: 'base' };
}

describe('nextPhaseTab', () => {
    it('reveals the next base phase in fixed order', () => {
        const next = nextPhaseTab([base('act-1', 'Act I')]);

        expect(next).toEqual({ id: 'act-2', label: 'Act II', kind: 'base' });
    });

    it('offers a custom phase once every base phase is shown', () => {
        const all = BASE_PHASES.map((phase) => base(phase.id, phase.label));
        const next = nextPhaseTab(all);

        expect(next?.kind).toBe('custom');
    });

    it('stops once the custom cap is reached', () => {
        const tabs: PlanTab[] = [
            ...BASE_PHASES.map((phase) => base(phase.id, phase.label)),
            { id: 'c-1', label: 'A', kind: 'custom' },
            { id: 'c-2', label: 'B', kind: 'custom' },
            { id: 'c-3', label: 'C', kind: 'custom' },
            { id: 'c-4', label: 'D', kind: 'custom' },
        ];

        expect(nextPhaseTab(tabs)).toBeNull();
    });
});

describe('clonePlanSection', () => {
    it('deep-copies a section so edits do not leak back', () => {
        const section = emptySection();
        section.items.notes = 'wear this';
        section.tree.notablePriority = [7, 12];
        section.tree.allocation = {
            allocated: [1, 2, 3],
            attributeChoices: {},
            weaponSets: {},
            jewels: {},
            treeVersion: null,
        };

        const copy = clonePlanSection(section);
        copy.items.notes = 'changed';
        copy.tree.notablePriority?.push(99);

        expect(section.items.notes).toBe('wear this');
        expect(section.tree.notablePriority).toEqual([7, 12]);
        expect(copy.tree.allocation?.allocated).toEqual([1, 2, 3]);
    });
});
