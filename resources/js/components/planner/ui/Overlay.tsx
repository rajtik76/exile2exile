import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Shared overlay surfaces: the full-screen Modal (slot editor) and the floating
 * PopoverCard (item/mod pickers, priority menu). Both take their panel colour,
 * border, radius and shadow from --pl-* tokens. Positioning of the popover is left
 * to the caller (it only styles the card); the modal owns its own backdrop.
 */

export function Modal({
    onClose,
    children,
    className,
}: {
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
}) {
    // Lock page scroll while the modal is open, so the background can't scroll behind
    // it (including middle-click autoscroll). Restored to its previous value on close.
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    // Escape closes the same way the backdrop/✕ do - callers that need Escape to do
    // something other than an unconditional close (e.g. the slot editor's revert/clear
    // while an unresolved invalid value is being typed) implement that inside the
    // `onClose` they pass in, not here; Modal itself stays a dumb, reusable shell.
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    // Portalled to <body> so the modal escapes the planner's stacking context
    // (the wrapper sits at z-10 for the class backdrop) and layers above the
    // sticky site header - otherwise its top slides behind the nav.
    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div
            className="planner-reading fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4 pt-12"
            style={{ background: 'rgba(0,0,0,0.72)' }}
            onClick={onClose}
        >
            <div
                className={cn(
                    'w-full max-w-3xl border border-[var(--pl-panel-border)] bg-[var(--pl-panel)]',
                    className,
                )}
                style={{
                    borderRadius: 'var(--pl-radius-lg)',
                    boxShadow: 'var(--pl-shadow)',
                }}
                onClick={(event) => event.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}

export function PopoverCard({
    className,
    children,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'border border-[var(--pl-panel-border)] bg-[var(--pl-panel)]',
                className,
            )}
            style={{
                borderRadius: 'var(--pl-radius)',
                boxShadow: 'var(--pl-shadow)',
            }}
            {...props}
        >
            {children}
        </div>
    );
}
