import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ReferencesProvider } from '@/components/planner/ReferencesContext';
import RichText from '@/components/planner/RichText';
import { insertToken } from '@/lib/planReferences';
import type { ReferenceMap } from '@/lib/planReferences';

const iceNova: ReferenceMap = {
    'gem:SkillGemIceNova': {
        type: 'gem',
        id: 'SkillGemIceNova',
        name: 'Ice Nova',
        icon: '/icons/poe2/ice.png',
        tooltip: 'A wave of ice.',
    },
};

function renderText(text: string, references: ReferenceMap = {}) {
    return render(
        <ReferencesProvider map={references}>
            <RichText text={text} />
        </ReferencesProvider>,
    );
}

test('renders a reference token as a chip with the resolved name and icon', () => {
    const { container } = renderText(
        'Open with {{gem:SkillGemIceNova|Ice Nova}} for clear.',
        iceNova,
    );

    // The name appears in the chip and again in the hover tooltip.
    expect(screen.getAllByText('Ice Nova').length).toBeGreaterThan(0);
    // The icon is decorative (empty alt), so query it directly rather than by role.
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
        '/icons/poe2/ice.png',
    );
    // Surrounding prose still renders.
    expect(screen.getByText(/Open with/)).toBeTruthy();
});

test('falls back to the token name when the reference is unknown', () => {
    renderText('Socket {{gem:Missing|Fallback Gem}} later.');

    expect(screen.getByText('Fallback Gem')).toBeTruthy();
});

test('renders Markdown formatting alongside chips', () => {
    const { container } = renderText('**Bold** and {{rune:Reach|Reach}}', {});

    expect(container.querySelector('strong')?.textContent).toBe('Bold');
    expect(screen.getByText('Reach')).toBeTruthy();
});

test('insertToken splices a token at the selection and returns the caret', () => {
    const { text, caret } = insertToken('ab cd', 3, 3, {
        type: 'gem',
        id: 'SkillGemIceNova',
        name: 'Ice Nova',
    });

    expect(text).toBe('ab {{gem:SkillGemIceNova|Ice Nova}}cd');
    expect(text.slice(0, caret)).toBe('ab {{gem:SkillGemIceNova|Ice Nova}}');
});
