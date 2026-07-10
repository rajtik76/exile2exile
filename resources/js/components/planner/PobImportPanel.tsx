import { useState } from 'react';
import Button from '@/components/planner/Button';
import { TextArea } from '@/components/planner/ui/Field';
import { Panel } from '@/components/planner/ui/Panel';
import { xsrfToken } from '@/lib/csrf';
import planner from '@/routes/planner';
import type { PlanData } from '@/types/planner';

/**
 * Seed a fresh plan from a Path of Building export. Paste a PoB export code or a
 * pobb.in link and the server decodes it into a plan - class, ascendancy, passive
 * tree, gems and equipment - which is loaded straight into the editor. Nothing is
 * saved: the import is throwaway until the author chooses to save the plan, so it
 * never leaves a stray build in the database. It sits above the class gallery so a
 * build can start from an import or from scratch. Rendered inside a modal opened from
 * the class gallery.
 *
 * Only the button-gating shape check runs here; the server is the authority on whether
 * a code actually decodes (and whether a pobb.in link resolves), surfacing its verdict
 * as the field error.
 */
const POBBIN_LINK = /^https?:\/\/(?:www\.)?pobb\.in\/[\w-]+\/?$/i;
// PoB codes are URL-safe base64; anything shorter than this can't be a real build.
const PLAUSIBLE_CODE = /^[A-Za-z0-9\-_+/=\s]{40,}$/;

function looksImportable(value: string): boolean {
    const trimmed = value.trim();

    return POBBIN_LINK.test(trimmed) || PLAUSIBLE_CODE.test(trimmed);
}

export default function PobImportPanel({
    onImported,
    onClose,
}: {
    onImported: (
        title: string,
        plan: PlanData,
        droppedMods: Record<string, string[]>,
    ) => void;
    onClose: () => void;
}) {
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);

    async function submit(): Promise<void> {
        setImporting(true);
        setError(null);

        try {
            const response = await fetch(planner.import.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                credentials: 'same-origin',
                body: JSON.stringify({ code }),
            });

            if (response.status === 422) {
                const body = await response.json().catch(() => ({}));

                setError(
                    body.errors?.code?.[0] ??
                        'This build could not be imported.',
                );

                return;
            }

            if (!response.ok) {
                setError('This build could not be imported.');

                return;
            }

            const body = (await response.json()) as {
                title: string;
                plan: PlanData;
                droppedMods?: Record<string, string[]>;
            };
            onImported(body.title, body.plan, body.droppedMods ?? {});
        } catch {
            setError('The import could not be reached. Try again.');
        } finally {
            setImporting(false);
        }
    }

    return (
        <Panel
            title="Import from Path of Building"
            action={
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="inline-flex size-6 items-center justify-center rounded-[var(--pl-radius)] text-[var(--pl-muted)] transition outline-none hover:text-[var(--pl-accent-lit)] focus-visible:text-[var(--pl-accent-lit)]"
                >
                    <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        className="size-4"
                    >
                        <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                </button>
            }
        >
            {/* Not a <form>: the whole planner editor is already one form, and HTML
            forbids nesting them. The button posts directly. */}
            <div className="flex flex-col gap-3">
                <p className="pl-text-sm text-[var(--pl-muted)]">
                    Paste a PoB export code or a pobb.in link to start from an
                    existing build. Nothing is saved until you save the plan.
                </p>
                <TextArea
                    name="code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Path of Building export code, or https://pobb.in/…"
                    rows={4}
                    spellCheck={false}
                    className="font-mono"
                />
                {error && (
                    <p className="pl-text-sm text-[var(--pl-danger-lit)]">
                        {error}
                    </p>
                )}
                <div className="flex justify-end">
                    <Button
                        type="button"
                        variant="primary"
                        className="border-2"
                        onClick={submit}
                        disabled={importing || !looksImportable(code)}
                    >
                        {importing ? 'Importing…' : 'Import build'}
                    </Button>
                </div>
            </div>
        </Panel>
    );
}
