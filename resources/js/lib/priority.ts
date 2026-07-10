/**
 * Gearing priority: each filled equipment slot may carry one number (1..{@link MAX_PRIORITY}),
 * and the number is unique within a phase's paper-doll - so the badges read off as the whole
 * gearing order. The picker offers only the numbers no other slot has taken; the rest show
 * greyed and unpickable. These pure helpers drive that, mirroring the server's uniqueness rule.
 */
import { MAX_PRIORITY } from '@/types/planner';
import type { ItemPlan } from '@/types/planner';

/** The priority numbers already assigned to slots other than `exceptKey`. */
export function takenPriorities(
    slots: Record<string, ItemPlan>,
    exceptKey?: string,
): Set<number> {
    const taken = new Set<number>();

    for (const [key, item] of Object.entries(slots)) {
        if (key !== exceptKey && item?.priority != null) {
            taken.add(item.priority);
        }
    }

    return taken;
}

/** One entry per priority number (1..MAX), each flagged whether another slot holds it. */
export function priorityOptions(
    slots: Record<string, ItemPlan>,
    exceptKey?: string,
): Array<{ value: number; taken: boolean }> {
    const taken = takenPriorities(slots, exceptKey);

    return Array.from({ length: MAX_PRIORITY }, (_, index) => {
        const value = index + 1;

        return { value, taken: taken.has(value) };
    });
}

/** The lowest priority number no slot has taken, or null when all are used. */
export function nextFreePriority(
    slots: Record<string, ItemPlan>,
    exceptKey?: string,
): number | null {
    const taken = takenPriorities(slots, exceptKey);

    for (let value = 1; value <= MAX_PRIORITY; value++) {
        if (!taken.has(value)) {
            return value;
        }
    }

    return null;
}
