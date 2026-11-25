import { useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    ClearGlyph,
    FIELD_ICON_BUTTON,
    LABEL,
} from '@/components/passive-tree/chrome';
import { cn } from '@/lib/utils';
import shared from '@/routes/shared';

/**
 * The keyring of a saved tree, floating under the planner bar on the edit page:
 * the public read link (safe to share), the edit page link (lands on the unlock
 * form) and the secret edit token, masked until revealed. The footer is the
 * danger zone: deleting the build asks for the token to be re-typed, and the
 * DELETE request body is the only place the secret ever travels - never a URL,
 * so it cannot reach logs, history or referrers.
 *
 * The panel is a floating dialog of the working tier and keeps its rows readable
 * on phones, where the labels wrap above their values.
 */
export default function TreeSharePanel({
    slug,
    editToken,
    onClose,
}: {
    slug: string;
    editToken: string;
    onClose: () => void;
}) {
    // A failed delete redirects back with a token error; when that lands after a
    // full page reload this component remounts, so the danger confirm must reopen
    // itself - otherwise the feedback would be invisible.
    const pageErrors = usePage().props.errors as Record<string, string>;
    const [deleting, setDeleting] = useState(() => Boolean(pageErrors?.token));

    const publicUrl = resolve(shared.show.url({ sharedTree: slug }));
    const editUrl = resolve(shared.edit.url({ sharedTree: slug }));

    return (
        <div className="dialog absolute top-full right-[6%] left-[6%] z-30 mt-2 flex max-h-[calc(100dvh-160px)] flex-col font-ui min-[821px]:right-[min(3.4%,76px)] sm:left-auto sm:w-[36rem] sm:max-w-[calc(100%-3rem)]">
            {/* The pewter rule sits on the dialog's border, so the scrolling
                box is this inner one - a scroller would clip the rule. */}
            <div className="min-h-0 overflow-y-auto">
                <div className="panel-head">
                    <span className="mr-auto">Build links</span>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close"
                        aria-label="Close build links"
                        className={FIELD_ICON_BUTTON}
                    >
                        <ClearGlyph />
                    </button>
                </div>

                <div className="px-4">
                    <Row label="Public" divider>
                        <a
                            href={publicUrl}
                            className="min-w-0 flex-1 truncate text-sm text-paper transition-colors duration-[120ms] hover:text-ember-300"
                        >
                            {publicUrl}
                        </a>
                        <CopyButton text={publicUrl} label="Copy public link" />
                    </Row>
                    <Row label="Edit" divider>
                        <a
                            href={editUrl}
                            className="min-w-0 flex-1 truncate text-sm text-paper transition-colors duration-[120ms] hover:text-ember-300"
                        >
                            {editUrl}
                        </a>
                        <CopyButton text={editUrl} label="Copy edit link" />
                    </Row>
                    <Row label="Token">
                        <TokenValue token={editToken} />
                        <CopyButton text={editToken} label="Copy edit token" />
                        <p className="w-full text-[13px] text-mist">
                            The only key to edit this build - save it somewhere
                            safe and keep it private.
                        </p>
                    </Row>
                </div>

                <div className="border-t border-line bg-void px-4 py-3">
                    {deleting ? (
                        <DeleteConfirm
                            slug={slug}
                            onCancel={() => setDeleting(false)}
                        />
                    ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-slate">
                                Danger zone - deleting is permanent.
                            </p>
                            <button
                                type="button"
                                onClick={() => setDeleting(true)}
                                className="btn btn-sm btn-danger"
                            >
                                Delete build
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Absolute URL for a path, so the copied link works pasted anywhere. */
function resolve(path: string): string {
    return typeof window !== 'undefined'
        ? new URL(path, window.location.origin).toString()
        : path;
}

/**
 * One ledger row: a small-caps label and its value + action. On a phone the
 * label takes the full first line and the value wraps beneath it; from `sm`
 * up they sit side by side.
 */
function Row({
    label,
    divider = false,
    children,
}: {
    label: string;
    divider?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3 ${divider ? 'border-b border-line' : ''}`}
        >
            <span className={`w-full shrink-0 sm:w-16 ${LABEL}`}>{label}</span>
            {children}
        </div>
    );
}

/**
 * Copy with unmissable feedback: the button flips to "Copied ✓" for a moment (or
 * reports the rare failure), with a hidden-textarea fallback for contexts where
 * the async clipboard API is unavailable.
 */
function CopyButton({
    text,
    label,
}: {
    text: string;
    /** Accessible name naming WHAT is copied - the visible text stays "Copy". */
    label: string;
}) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

    function flash(next: 'copied' | 'failed'): void {
        setState(next);
        window.setTimeout(() => setState('idle'), 1800);
    }

    function fallbackCopy(): void {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();

        try {
            flash(document.execCommand('copy') ? 'copied' : 'failed');
        } catch {
            flash('failed');
        } finally {
            area.remove();
        }
    }

    function copy(): void {
        if (!navigator.clipboard?.writeText) {
            fallbackCopy();

            return;
        }

        navigator.clipboard
            .writeText(text)
            .then(() => flash('copied'))
            .catch(fallbackCopy);
    }

    return (
        <button
            type="button"
            onClick={copy}
            title="Copy to clipboard"
            aria-label={label}
            // Fixed width, "Copy failed" (its longest label) sized with room to
            // spare: the label swaps on click, and a resizing button mid-click
            // reads as layout jitter to a human and as an unstable click target
            // to Playwright, which can then redispatch the click as a retry.
            className={cn(
                'btn btn-sm btn-iron min-w-[6.5rem]',
                state === 'copied' && 'border-verdigris text-verdigris',
                state === 'failed' && 'border-blood text-blood-lit',
            )}
        >
            {state === 'copied'
                ? 'Copied ✓'
                : state === 'failed'
                  ? 'Copy failed'
                  : 'Copy'}
        </button>
    );
}

/** The token, masked until the author asks for it - shoulder-surf safe by default. */
function TokenValue({ token }: { token: string }) {
    const [shown, setShown] = useState(false);

    return (
        <button
            type="button"
            onClick={() => setShown((value) => !value)}
            title={shown ? 'Hide token' : 'Reveal token'}
            className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-paper transition-colors duration-[120ms] hover:text-ember-300"
        >
            {shown ? token : '•'.repeat(24) + '  (click to reveal)'}
        </button>
    );
}

/**
 * The delete confirmation. The token is re-typed here and travels only in the
 * DELETE request body; a native confirm is the final stop on top of it. A
 * successful delete redirects to the blank planner server-side.
 */
function DeleteConfirm({
    slug,
    onCancel,
}: {
    slug: string;
    onCancel: () => void;
}) {
    const form = useForm({ token: '' });
    const [shown, setShown] = useState(false);
    // After a full reload the fresh form has no errors yet - fall back to the
    // page-level error the failed delete flashed.
    const pageErrors = usePage().props.errors as Record<string, string>;
    const error = form.errors.token ?? pageErrors?.token;

    function submit(event: React.FormEvent): void {
        event.preventDefault();

        // A last native stop on top of the re-typed token: deleting is irreversible.
        if (
            !window.confirm(
                'Really delete this build for good? There is no undo.',
            )
        ) {
            return;
        }

        form.delete(shared.destroy.url({ sharedTree: slug }), {
            preserveScroll: true,
        });
    }

    return (
        <form
            onSubmit={submit}
            className="notice notice-bad flex flex-col gap-2 p-3"
        >
            <p className="text-sm font-semibold text-paper">
                Delete this build permanently?
            </p>
            <p className="text-sm text-bone">
                The build and its public page disappear immediately.{' '}
                <strong>There is no undo</strong> - nobody can bring it back,
                not even with the token. Paste the edit token to confirm.
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-40 flex-1">
                    <input
                        autoFocus
                        type={shown ? 'text' : 'password'}
                        autoComplete="off"
                        value={form.data.token}
                        onChange={(event) =>
                            form.setData('token', event.target.value)
                        }
                        placeholder="Edit token…"
                        className="input pr-16"
                    />
                    <button
                        type="button"
                        onClick={() => setShown((value) => !value)}
                        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[13px] font-medium text-mist transition-colors duration-[120ms] hover:text-paper"
                    >
                        {shown ? 'Hide' : 'Show'}
                    </button>
                </div>
                <button
                    type="submit"
                    disabled={form.processing || form.data.token.trim() === ''}
                    className="btn btn-danger"
                >
                    {form.processing ? 'Deleting…' : 'Delete for good'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="btn btn-ghost"
                >
                    Cancel
                </button>
            </div>
            {error && <p className="text-sm text-blood-lit">{error}</p>}
        </form>
    );
}
