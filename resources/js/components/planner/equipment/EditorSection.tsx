import { useState } from 'react';
import { LABEL_CLASS } from '@/components/planner/ui/Text';

/**
 * One collapsible section of the slot editor. The header is the section label
 * (same label style the editor uses for its plain labels) plus an optional
 * right-aligned meta hint that stays visible while collapsed (e.g. the affix
 * counts), so a folded section still says what it holds. Sections default open
 * on desktop; the editor passes `defaultOpen={false}` for secondary sections on
 * mobile, where the full form would otherwise be one long scroll.
 */
export default function EditorSection({
    label,
    meta,
    defaultOpen = true,
    children,
}: {
    label: string;
    meta?: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                className="mb-1.5 flex w-full items-center justify-between gap-2 text-left"
            >
                <span className={`${LABEL_CLASS} flex items-center gap-1.5`}>
                    <span
                        aria-hidden
                        className="inline-block w-2 transition-transform"
                        style={{
                            transform: open ? 'rotate(90deg)' : undefined,
                        }}
                    >
                        ▸
                    </span>
                    {label}
                </span>
                {meta !== undefined && (
                    <span className="pl-text-xs text-[var(--pl-faint)]">
                        {meta}
                    </span>
                )}
            </button>
            {open && children}
        </div>
    );
}
