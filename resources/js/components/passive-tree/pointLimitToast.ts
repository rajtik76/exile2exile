import { toast } from 'sonner';
import { COLOR } from '@/components/brand';

/**
 * One toast for every passive-point cap (basic tree and each weapon set), so
 * the planner gives the same feedback whichever budget a click would overspend.
 * A fixed toast id means spamming clicks at the cap refreshes a single toast
 * instead of stacking a column of them. It wears the notice look: stone, a line
 * border and the ember edge on the left.
 *
 * @param label  what is full, e.g. "Passive point" or "Weapon set I"
 * @param limit  the cap that was reached, shown to the player
 */
export function notifyPointLimit(label: string, limit: number): void {
    toast(`${label} limit reached (${limit})`, {
        id: 'point-limit',
        description: 'Deallocate elsewhere to free up points for this path.',
        style: {
            background: COLOR.stone800,
            border: `1px solid ${COLOR.line}`,
            borderLeft: `3px solid ${COLOR.ember500}`,
            borderRadius: 2,
            color: COLOR.paper,
            boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
        },
        classNames: {
            title: 'font-display text-base font-normal text-paper',
            description: 'font-ui text-[13px] text-slate',
        },
    });
}
