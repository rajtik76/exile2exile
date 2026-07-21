import { render, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TooltipCard } from './tooltip';
import type { TooltipRarityFrame } from './tooltipText';

/**
 * Regression coverage for a bug where a passive tree node's tooltip (frame
 * `normal`) rendered its stat/flavour text in FontinSmallCaps - a real distinct
 * font file, not a CSS text-transform, so lowercase prose in it reads as
 * shouting. `notable`/`keystone` already got the regular face for their body;
 * `normal` needed the same treatment (its title keeps the small `normal` face
 * either way - only the body text was wrong).
 */

const ACCENT = { text: '#fff', edge: '#fff', glow: 'rgba(0,0,0,0)' };

// Each call renders into its own container and is queried via `within` that
// container, so back-to-back calls in one test (no `render` in between) don't
// collide over multiple "Body text" matches across the whole document - render's
// own bound queries default to `document.body`, not the call's own container.
function renderCard(frame: TooltipRarityFrame) {
    const { container } = render(
        <TooltipCard accent={ACCENT} title="Title" frame={frame}>
            Body text
        </TooltipCard>,
    );

    return within(container).getByText('Body text');
}

test('a normal-frame (passive tree node) tooltip renders its body in the regular face, not small caps', () => {
    const body = renderCard('normal');

    expect(body.style.fontFamily).toContain('Fontin');
    expect(body.style.fontFamily).not.toContain('SmallCaps');
});

test('notable and keystone frames keep the regular body face', () => {
    expect(renderCard('notable').style.fontFamily).not.toContain('SmallCaps');
    expect(renderCard('keystone').style.fontFamily).not.toContain('SmallCaps');
});

test('an item rarity frame still renders its body in the small-caps face', () => {
    const body = renderCard('rare');

    expect(body.style.fontFamily).toContain('SmallCaps');
});
