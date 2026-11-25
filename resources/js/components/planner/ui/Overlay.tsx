import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Shared overlay surfaces: the full-screen Modal (slot editor) and the floating
 * PopoverCard (item/mod pickers, priority menu). Both are floating layers, so they
 * carry the pewter frame and a shadow. Positioning of the popover is left to the
 * caller (it only styles the card); the modal owns its own backdrop.
 */

export function Modal({
    onClose,
    children,
    className,
    fullScreenMobile = false,
}: {
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    /** Below `sm`, fill the viewport edge-to-edge (a sheet) instead of a floating card. */
    fullScreenMobile?: boolean;
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
            className={cn(
                'planner-reading fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto',
                fullScreenMobile ? 'sm:p-4 sm:pt-12' : 'p-4 pt-12',
            )}
            style={{ background: 'rgba(5,8,12,0.78)' }}
            onClick={onClose}
        >
            <div
                className={cn(
                    'dialog w-full max-w-3xl',
                    fullScreenMobile &&
                        'max-sm:min-h-dvh max-sm:max-w-none max-sm:border-0',
                    className,
                )}
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
                'border border-pewter-700 bg-[var(--pl-panel)] shadow-[0_18px_40px_-12px_#000]',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}
