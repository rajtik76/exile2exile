import { useEffect, useRef, useState } from 'react';
import AddButton from '@/components/planner/AddButton';
import { SegmentedControl } from '@/components/planner/Button';
import ReferencePicker from '@/components/planner/ReferencePicker';
import { useReferences } from '@/components/planner/ReferencesContext';
import RichText from '@/components/planner/RichText';
import { TextArea } from '@/components/planner/ui/Field';
import { FieldLabel } from '@/components/planner/ui/Text';
import { insertToken } from '@/lib/planReferences';
import type { PlanReference } from '@/lib/planReferences';

/**
 * A Markdown text field for a plan: a textarea with a toolbar to insert inline
 * gem/rune references (at the caret) and an Edit/Preview toggle that renders the
 * Markdown with chips. The stored value is plain Markdown-with-tokens.
 */
export default function MarkdownField({
    label,
    value,
    onChange,
    placeholder,
    rows = 3,
    maxLength,
}: {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    maxLength?: number;
}) {
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');
    const [pickerOpen, setPickerOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pendingCaret = useRef<number | null>(null);
    const { addReference } = useReferences();

    // Restore the caret to just after an inserted token once the new value renders.
    useEffect(() => {
        if (pendingCaret.current !== null && textareaRef.current) {
            const caret = pendingCaret.current;
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(caret, caret);
            pendingCaret.current = null;
        }
    });

    function pick(reference: PlanReference): void {
        const element = textareaRef.current;
        const start = element ? element.selectionStart : value.length;
        const end = element ? element.selectionEnd : value.length;

        const { text, caret } = insertToken(value, start, end, reference);

        addReference(reference);
        pendingCaret.current = caret;
        onChange(text);
        setPickerOpen(false);
    }

    return (
        <div>
            {label && <FieldLabel className="mb-1.5 block">{label}</FieldLabel>}

            <div className="mb-1.5 flex items-center gap-1.5">
                <div className="relative">
                    <AddButton
                        leadingPlus
                        onClick={() => {
                            setMode('edit');
                            setPickerOpen((open) => !open);
                        }}
                    >
                        Reference
                    </AddButton>
                    {pickerOpen && (
                        <ReferencePicker
                            onPick={pick}
                            onClose={() => setPickerOpen(false)}
                        />
                    )}
                </div>

                <SegmentedControl
                    className="ml-auto"
                    value={mode}
                    onChange={setMode}
                    options={[
                        { value: 'edit', label: 'edit' },
                        { value: 'preview', label: 'preview' },
                    ]}
                />
            </div>

            {mode === 'edit' ? (
                <TextArea
                    ref={textareaRef}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    maxLength={maxLength}
                />
            ) : (
                <div className="min-h-[5rem] rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] p-3">
                    {value.trim() === '' ? (
                        <p className="pl-text-sm text-[var(--pl-muted)]">
                            Nothing to preview.
                        </p>
                    ) : (
                        <RichText text={value} />
                    )}
                </div>
            )}

            <p className="pl-text-xs mt-1 text-[var(--pl-faint)]">
                Markdown supported · use “+ Reference” to link a gem, rune or
                unique
            </p>
        </div>
    );
}
