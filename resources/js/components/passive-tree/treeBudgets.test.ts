import { expect, test } from 'vitest';
import { exceededCap, hexColor, pointUsage } from './treeBudgets';

const LIMITS = { basic: 5, weaponSet: 2 };
const noAscendancy = () => false;

test('counts basic nodes, weapon-set tags and skips ascendancy nodes', function () {
    // Node 4 is ascendancy (separate pool); set I nodes count toward basic too,
    // set II is the additive divergence with its own cap.
    const usage = pointUsage(
        [1, 2, 3, 4, 5, 6],
        { 2: 1, 3: 1, 5: 2 },
        (id) => id === 4,
    );

    expect(usage).toEqual({ basic: 4, setI: 2, setII: 1 });
});

test('an empty allocation uses nothing', function () {
    expect(pointUsage([], {}, noAscendancy)).toEqual({
        basic: 0,
        setI: 0,
        setII: 0,
    });
});

test('names the first budget a step would overspend', function () {
    const within = { basic: 5, setI: 0, setII: 0 };

    expect(
        exceededCap(within, { basic: 6, setI: 0, setII: 0 }, LIMITS),
    ).toEqual({ label: 'Passive point', limit: 5 });
    expect(
        exceededCap(
            { basic: 2, setI: 2, setII: 0 },
            { basic: 3, setI: 3, setII: 0 },
            LIMITS,
        ),
    ).toEqual({ label: 'Weapon set I', limit: 2 });
    expect(
        exceededCap(
            { basic: 2, setI: 0, setII: 2 },
            { basic: 2, setI: 0, setII: 3 },
            LIMITS,
        ),
    ).toEqual({ label: 'Weapon set II', limit: 2 });
});

test('a step within every budget passes', function () {
    expect(
        exceededCap(
            { basic: 1, setI: 0, setII: 0 },
            { basic: 2, setI: 1, setII: 1 },
            LIMITS,
        ),
    ).toBeNull();
});

test('a build already over a cap stays editable - only growth is stopped', function () {
    // Before is already past the basic limit, so the step is not blamed on it.
    expect(
        exceededCap(
            { basic: 7, setI: 0, setII: 0 },
            { basic: 8, setI: 0, setII: 0 },
            LIMITS,
        ),
    ).toBeNull();
});

test('formats a numeric colour as a padded CSS hex string', function () {
    expect(hexColor(0xecc878)).toBe('#ecc878');
    expect(hexColor(0x00ff00)).toBe('#00ff00');
    expect(hexColor(0x0000ff)).toBe('#0000ff');
});
