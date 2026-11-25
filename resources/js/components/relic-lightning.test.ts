import { expect, test } from 'vitest';
import { LightningSchedule, MAX_SPARKS } from '@/components/relic-lightning';

test('a spark strikes once the pause is over and dies after its life', () => {
    // 0.5 everywhere: a 2500 ms pause, a 350 ms life, no follow-up.
    const lightning = new LightningSchedule(() => 0.5);

    expect(lightning.sparksAt(0)).toEqual([]);
    expect(lightning.sparksAt(2499)).toEqual([]);

    const [spark] = lightning.sparksAt(2500);
    expect(spark.angle).toBeCloseTo(Math.PI);
    expect(spark.strength).toBeGreaterThan(0);

    expect(lightning.sparksAt(2849)).toHaveLength(1);
    expect(lightning.sparksAt(2851)).toEqual([]);
});

test('never hands the shader more sparks than it draws', () => {
    // 0 everywhere: every spark is followed by another 80 ms later.
    const lightning = new LightningSchedule(() => 0);

    for (let now = 0; now <= 3000; now += 10) {
        expect(lightning.sparksAt(now).length).toBeLessThanOrEqual(MAX_SPARKS);
    }

    expect(lightning.sparksAt(3010)).toHaveLength(MAX_SPARKS);
});
