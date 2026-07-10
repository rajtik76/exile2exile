import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import PlannerGems from '@/components/planner/PlannerGems';
import { ReferencesProvider } from '@/components/planner/ReferencesContext';
import type { ReferenceMap } from '@/lib/planReferences';
import type { GemGroup } from '@/types/planner';

const references: ReferenceMap = {
    'gem:SkillGemIceNova': {
        type: 'gem',
        id: 'SkillGemIceNova',
        name: 'Ice Nova',
        icon: '/icons/poe2/ice.png',
        color: 'b',
    },
    'gem:SupportGemColdMastery': {
        type: 'gem',
        id: 'SupportGemColdMastery',
        name: 'Cold Mastery',
        icon: '/icons/poe2/cold.png',
        color: 'b',
    },
};

test('renders a gem group with the resolved active-gem icon', () => {
    const groups: GemGroup[] = [
        { id: 'g1', gems: [{ type: 'gem', id: 'SkillGemIceNova' }] },
    ];

    const { container } = render(
        <ReferencesProvider map={references}>
            <PlannerGems editable={false} groups={groups} />
        </ReferencesProvider>,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
        '/icons/poe2/ice.png',
    );
});

test('the read-only panel shows nothing extra for an empty group list', () => {
    render(
        <ReferencesProvider map={{}}>
            <PlannerGems editable={false} groups={[]} />
        </ReferencesProvider>,
    );

    // No "Gem group" button when not editable.
    expect(screen.queryByRole('button', { name: 'Gem group' })).toBeNull();
});

test('the list view shows gem names for the skill and its supports', () => {
    const groups: GemGroup[] = [
        {
            id: 'g1',
            gems: [
                { type: 'gem', id: 'SkillGemIceNova' },
                { type: 'gem', id: 'SupportGemColdMastery' },
            ],
        },
    ];

    render(
        <ReferencesProvider map={references}>
            <PlannerGems editable={false} view="list" groups={groups} />
        </ReferencesProvider>,
    );

    // The grid view hides names in a tooltip; the list view spells them out.
    // getByText throws when absent, so a returned node is the assertion.
    expect(screen.getByText('Ice Nova')).toBeTruthy();
    expect(screen.getByText('Cold Mastery')).toBeTruthy();
    expect(screen.getByText('Skill')).toBeTruthy();
});
