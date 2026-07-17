import { expect, test } from 'vitest';
import { clampPos, placeTooltip } from './tooltipPlacement';

const TIP = { w: 200, h: 100 };
const STAGE = { w: 800, h: 600 };

test('clamps a position inside the extent with the standard margin', function () {
    expect(clampPos(-50, 200, 800)).toBe(8);
    expect(clampPos(700, 200, 800)).toBe(800 - 200 - 8);
    expect(clampPos(300, 200, 800)).toBe(300);
});

test('a tooltip larger than the stage pins to the margin instead of a negative offset', function () {
    expect(clampPos(10, 900, 800)).toBe(8);
});

test('follows the cursor with an offset while there is room', function () {
    const placed = placeTooltip({
        tip: TIP,
        stage: STAGE,
        pointer: { x: 100, y: 100 },
    });

    expect(placed).toEqual({ left: 118, top: 118 });
});

test('flips to the other side of the cursor before spilling off the stage', function () {
    const placed = placeTooltip({
        tip: TIP,
        stage: STAGE,
        pointer: { x: 700, y: 550 },
    });

    // 700 + 18 + 200 > 792 and 550 + 18 + 100 > 592, so both axes flip.
    expect(placed).toEqual({ left: 700 - 18 - 200, top: 550 - 18 - 100 });
});

test('pins above an anchored node, centred on it', function () {
    const placed = placeTooltip({
        tip: TIP,
        stage: STAGE,
        pointer: { x: 0, y: 0 },
        anchor: { x: 400, y: 300 },
    });

    expect(placed).toEqual({ left: 400 - 100, top: 300 - 14 - 100 });
});

test('flips below the anchor when there is no room above', function () {
    const placed = placeTooltip({
        tip: TIP,
        stage: STAGE,
        pointer: { x: 0, y: 0 },
        anchor: { x: 400, y: 50 },
    });

    // 50 - 14 - 100 < margin, so the tooltip opens under the node instead.
    expect(placed).toEqual({ left: 300, top: 50 + 14 });
});

test('an anchored tooltip near the stage edge stays fully on screen', function () {
    const placed = placeTooltip({
        tip: TIP,
        stage: STAGE,
        pointer: { x: 0, y: 0 },
        anchor: { x: 10, y: 300 },
    });

    expect(placed.left).toBe(8);
});
