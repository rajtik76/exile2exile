import { cn } from '@/lib/utils';

/**
 * Shared planner form controls. One input look (bg / border / focus / text) driven
 * by --pl-* tokens, reused by the title field, entry name/note inputs, mod value
 * boxes and number fields - so every input matches and re-skins with the design.
 */

/** The base input styling; exported so bespoke inputs (mod values) match exactly. */
export const INPUT_CLASS =
    'w-full rounded-[var(--pl-radius)] border border-[var(--pl-input-border)] bg-[var(--pl-input-bg)] text-[var(--pl-text)] outline-none transition placeholder:text-[var(--pl-faint)] focus-visible:border-[var(--pl-focus)]';

export function TextInput({
    className,
    ...props
}: React.ComponentProps<'input'>) {
    return (
        <input
            className={cn(INPUT_CLASS, 'pl-text-sm px-2.5 py-1.5', className)}
            {...props}
        />
    );
}

export function TextArea({
    className,
    ...props
}: React.ComponentProps<'textarea'>) {
    return (
        <textarea
            className={cn(INPUT_CLASS, 'pl-text-base resize-y p-3', className)}
            {...props}
        />
    );
}

export function NumberInput({
    className,
    ...props
}: React.ComponentProps<'input'>) {
    return (
        <input
            type="number"
            className={cn(INPUT_CLASS, 'pl-text-sm px-2 py-1', className)}
            {...props}
        />
    );
}
