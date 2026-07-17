import { describe, expect, test } from 'vitest';
import {
    nextFreePriority,
    priorityOptions,
    takenPriorities,
} from '@/lib/priority';
import { MAX_PRIORITY } from '@/types/planner';
import type { ItemPlan } from '@/types/planner';

/** A filled item carrying just the given priority. */
function item(priority: number | null): ItemPlan {
    return {
        rarity: 'rare',
        base: null,
        name: '',
        corrupted: false,
        itemLevel: null,
        props: { quality: 0, armour: 0, evasion: 0, energyShield: 0, block: 0 },
        stats: [],
        uniqueMods: [],
        sockets: [],
        priority,
    };
}

const slots: Record<string, ItemPlan> = {
    helmet: item(3),
    body: item(1),
    boots: item(null),
    gloves: item(7),
};

describe('takenPriorities', () => {
    test('collects the numbers other slots hold, skipping unset ones', () => {
        expect(takenPriorities(slots)).toEqual(new Set([3, 1, 7]));
    });

    test('excludes the slot under edit so it can keep its own number', () => {
        expect(takenPriorities(slots, 'helmet')).toEqual(new Set([1, 7]));
    });
});

describe('priorityOptions', () => {
    test('flags every number 1..MAX, taken when another slot holds it', () => {
        const options = priorityOptions(slots, 'helmet');

        expect(options).toHaveLength(MAX_PRIORITY);
        expect(options[0]).toEqual({ value: 1, taken: true });
        // 3 is the edited slot's own number, so it reads as free here.
        expect(options[2]).toEqual({ value: 3, taken: false });
        expect(options[6]).toEqual({ value: 7, taken: true });
        expect(options[1]).toEqual({ value: 2, taken: false });
    });
});

describe('nextFreePriority', () => {
    test('returns the lowest unused number', () => {
        expect(nextFreePriority(slots)).toBe(2);
    });

    test('returns null when every number is taken', () => {
        const full: Record<string, ItemPlan> = {};

        for (let value = 1; value <= MAX_PRIORITY; value++) {
            full[`s${value}`] = item(value);
        }

        expect(nextFreePriority(full)).toBeNull();
    });
});
