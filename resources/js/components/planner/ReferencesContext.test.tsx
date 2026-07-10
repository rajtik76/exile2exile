import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import {
    ReferencesProvider,
    useReferences,
} from '@/components/planner/ReferencesContext';
import { refKey } from '@/lib/planReferences';
import type { PlanReference } from '@/lib/planReferences';

const ICE_NOVA: PlanReference = {
    type: 'gem',
    id: 'SkillGemIceNova',
    name: 'Ice Nova',
    icon: '/icons/poe2/ice.png',
    tooltip: 'boom',
};

function Reader() {
    const { map, addReference } = useReferences();
    const ref = map[refKey('gem', 'SkillGemIceNova')];

    return (
        <button type="button" onClick={() => addReference(ICE_NOVA)}>
            {ref?.icon ?? 'MISSING'}
        </button>
    );
}

test('the provider exposes its map and forwards addReference', () => {
    const onAdd = vi.fn();

    render(
        <ReferencesProvider
            map={{ 'gem:SkillGemIceNova': ICE_NOVA }}
            addReference={onAdd}
        >
            <Reader />
        </ReferencesProvider>,
    );

    const button = screen.getByRole('button');
    expect(button.textContent).toBe('/icons/poe2/ice.png');

    button.click();
    expect(onAdd).toHaveBeenCalledWith(ICE_NOVA);
});
