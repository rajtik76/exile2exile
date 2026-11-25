import { render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import RelicCube from '@/components/relic-cube';

afterEach(() => {
    vi.restoreAllMocks();
});

test('shows a still render of the cube when WebGL is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const { container } = render(<RelicCube />);
    const canvas = container.querySelector('canvas');

    expect(canvas?.style.backgroundImage).toContain('relic-still');
});
