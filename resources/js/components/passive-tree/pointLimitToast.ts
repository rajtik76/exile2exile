import { toast } from 'sonner';
import { INPUT_FONT } from './chrome';

/**
 * One bronze-plaque toast for every passive-point cap (basic tree and each
 * weapon set), so the planner gives the same feedback whichever budget a click
 * would overspend. A fixed toast id means spamming clicks at the cap refreshes a
 * single toast instead of stacking a column of them. The font matches the tree
 * chrome but stays plain Fontin - SmallCaps reads poorly small and light here.
 *
 * @param label  what is full, e.g. "Passive point" or "Weapon set I"
 * @param limit  the cap that was reached, shown to the player
 */
export function notifyPointLimit(label: string, limit: number): void {
    toast(`${label} limit reached (${limit})`, {
        id: 'point-limit',
        description: 'Deallocate elsewhere to free up points for this path.',
        style: {
            background: 'linear-gradient(to bottom, #15100a, #0b0805)',
            border: '1px solid #6e5526',
            color: '#f5ecd8',
            boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
            ...INPUT_FONT,
        },
        classNames: {
            title: 'text-[15px] font-semibold text-[#f5d98a]',
            description: 'text-[13px] text-[#cbb888]',
        },
    });
}
