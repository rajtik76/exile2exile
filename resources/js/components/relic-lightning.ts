/*
 * When the relic cube discharges: a short spark now and then, occasionally a
 * second one right after. Kept apart from the renderer so the timing can be
 * tested without WebGL.
 */

/** A spark as the shader draws it. */
export type Spark = {
    /** Direction it leaves the cube, radians in screen space. */
    angle: number;
    /** Picks the zigzag of its path. */
    seed: number;
    /** How bright it is right now, 0 to 1. */
    strength: number;
};

type Discharge = {
    angle: number;
    seed: number;
    bornAt: number;
    life: number;
};

/** The shader draws at most this many sparks at once. */
export const MAX_SPARKS = 2;

/** Quiet time between discharges, in milliseconds. */
export const PAUSE = { min: 1500, max: 3500 };

/** How long one spark lives, in milliseconds. */
export const LIFE = { min: 250, max: 450 };

/** Chance that a spark is followed right away by a second one. */
const FOLLOW_UP_CHANCE = 0.35;

/** Delay before such a follow-up, in milliseconds. */
const FOLLOW_UP = { min: 80, max: 200 };

export class LightningSchedule {
    private discharges: Discharge[] = [];

    private nextAt: number | null = null;

    constructor(private readonly random: () => number = Math.random) {}

    /** Advances to the given moment and returns the sparks to draw. */
    sparksAt(now: number): Spark[] {
        if (this.nextAt === null) {
            this.nextAt = now + this.between(PAUSE);
        }

        if (now >= this.nextAt) {
            this.discharges.push({
                angle: this.random() * Math.PI * 2,
                seed: this.random() * 100,
                bornAt: now,
                life: this.between(LIFE),
            });
            this.nextAt =
                now +
                (this.random() < FOLLOW_UP_CHANCE
                    ? this.between(FOLLOW_UP)
                    : this.between(PAUSE));
        }

        this.discharges = this.discharges
            .filter((discharge) => now - discharge.bornAt < discharge.life)
            .slice(-MAX_SPARKS);

        return this.discharges.map((discharge) => {
            const lived = now - discharge.bornAt;
            // A quick flicker on a fading arc, like a struck spark.
            const flicker =
                0.6 + 0.4 * Math.abs(Math.sin(lived * 0.06 + discharge.seed));

            return {
                angle: discharge.angle,
                seed: discharge.seed,
                strength: Math.pow(1 - lived / discharge.life, 1.2) * flicker,
            };
        });
    }

    private between(range: { min: number; max: number }): number {
        return range.min + this.random() * (range.max - range.min);
    }
}
