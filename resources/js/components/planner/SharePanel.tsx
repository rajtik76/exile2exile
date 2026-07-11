import { useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import Button from '@/components/planner/Button';
import { TextInput } from '@/components/planner/ui/Field';
import { clearDraft, draftKeyFor } from '@/lib/planner';
import planner from '@/routes/planner';

/**
 * Everything minted once a plan is saved, as a keyring of ledger rows: the public read
 * link (safe to share), the edit page link (lands on the unlock form) and the secret
 * edit token, masked until revealed. The footer is the danger zone: deleting the build
 * asks for the token to be re-typed, and the DELETE request body is the only place the
 * secret ever travels - never a URL, so it cannot reach logs, history or referrers.
 */
export default function SharePanel({
    publicUrl,
    editUrl,
    editToken,
    slug,
}: {
    publicUrl: string;
    editUrl: string | null;
    editToken: string | null;
    slug: string | null;
}) {
    // A failed delete redirects back with a token error; when that lands after a full
    // page reload (e.g. an asset-version refresh) this component remounts, so the
    // danger confirm must reopen itself - otherwise the feedback would be invisible.
    const pageErrors = usePage().props.errors as Record<string, string>;
    const [deleting, setDeleting] = useState(() => Boolean(pageErrors?.token));

    return (
        <div
            className="mb-6 overflow-hidden border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)]"
            style={{ borderRadius: 'var(--pl-radius-lg)' }}
        >
            <div className="px-4">
                <LinkRow label="Public" url={publicUrl} divider />
                {editUrl && (
                    <LinkRow label="Edit" url={editUrl} divider={!!editToken} />
                )}

                {editToken && (
                    <div className="flex flex-wrap items-center gap-3 py-2.5">
                        <span className="pl-text-2xs w-24 shrink-0 font-semibold tracking-[0.12em] text-[var(--pl-accent-lit)] uppercase">
                            Token
                        </span>
                        <TokenValue token={editToken} />
                        <CopyButton text={editToken} variant="primary" />
                        <p className="pl-text-2xs w-full text-[var(--pl-faint)]">
                            The only key to edit this build - save it somewhere
                            safe and keep it private.
                        </p>
                    </div>
                )}
            </div>

            {slug && editToken && (
                <div className="border-t border-[var(--pl-danger)]/40 bg-[var(--pl-danger-soft)] px-4 py-2.5">
                    {deleting ? (
                        <DeleteConfirm
                            slug={slug}
                            onCancel={() => setDeleting(false)}
                        />
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            <p className="pl-text-sm text-[var(--pl-danger-lit)]">
                                Danger zone - deleting is permanent.
                            </p>
                            <Button
                                size="sm"
                                variant="danger"
                                onClick={() => setDeleting(true)}
                            >
                                Delete build
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** One ledger row: an uppercase label, the resolved URL and its copy action. */
function LinkRow({
    label,
    url,
    divider,
}: {
    label: string;
    url: string;
    divider: boolean;
}) {
    const resolved =
        typeof window !== 'undefined'
            ? new URL(url, window.location.origin).toString()
            : url;

    return (
        <div
            className={`flex flex-wrap items-center gap-3 py-2.5 ${divider ? 'border-b border-[var(--pl-divider)]' : ''}`}
        >
            <span className="pl-text-2xs w-24 shrink-0 font-semibold tracking-[0.12em] text-[var(--pl-faint)] uppercase">
                {label}
            </span>
            <a
                href={url}
                className="pl-text-sm min-w-40 flex-1 truncate font-mono text-[var(--pl-text)] hover:text-[var(--pl-accent-lit)]"
            >
                {resolved}
            </a>
            <CopyButton text={resolved} />
        </div>
    );
}

/**
 * Copy with unmissable feedback: the button flips to an accent "Copied ✓" for a moment
 * (or reports the rare failure), with a hidden-textarea fallback for contexts where the
 * async clipboard API is unavailable.
 */
function CopyButton({
    text,
    variant = 'ghost',
}: {
    text: string;
    variant?: 'ghost' | 'primary';
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
        <Button
            size="sm"
            variant={state === 'copied' ? 'primary' : variant}
            onClick={copy}
            title="Copy to clipboard"
        >
            {state === 'copied'
                ? 'Copied ✓'
                : state === 'failed'
                  ? 'Copy failed'
                  : 'Copy'}
        </Button>
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
            className="pl-text-sm min-w-0 flex-1 cursor-pointer truncate text-left font-mono text-[var(--pl-text)] hover:text-[var(--pl-accent-lit)]"
        >
            {shown ? token : '•'.repeat(24) + '  (click to reveal)'}
        </button>
    );
}

/**
 * The delete confirmation. NOT a <form>: the whole editor already is one, and a nested
 * form is dropped by the browser (its submit would save instead of delete) - the
 * confirm button drives the DELETE directly. A successful delete also discards the
 * local editor draft, so the dead build cannot resurface from localStorage.
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

    function submit(): void {
        // A last native stop on top of the re-typed token: deleting is irreversible.
        if (
            !window.confirm(
                'Really delete this build for good? There is no undo.',
            )
        ) {
            return;
        }

        form.delete(planner.destroy.url({ plan: slug }), {
            preserveScroll: true,
            onSuccess: () => clearDraft(draftKeyFor(slug)),
        });
    }

    return (
        <div
            className="my-1 flex flex-col gap-2 border-2 border-[var(--pl-danger)] bg-[var(--pl-panel-2)] p-3"
            style={{ borderRadius: 'var(--pl-radius)' }}
        >
            <p className="pl-text-sm font-semibold text-[var(--pl-danger-lit)]">
                Delete this build permanently?
            </p>
            <p className="pl-text-sm text-[var(--pl-text)]">
                The build, its public page and its edit access disappear
                immediately. <strong>There is no undo</strong> - nobody can
                bring it back, not even with the token. Paste the edit token to
                confirm.
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-40 flex-1">
                    <TextInput
                        autoFocus
                        type={shown ? 'text' : 'password'}
                        autoComplete="off"
                        value={form.data.token}
                        onChange={(event) =>
                            form.setData('token', event.target.value)
                        }
                        placeholder="Edit token…"
                        className="w-full pr-16 font-mono"
                    />
                    <button
                        type="button"
                        onClick={() => setShown((value) => !value)}
                        className="pl-text-2xs absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer font-semibold text-[var(--pl-muted)] uppercase hover:text-[var(--pl-text)]"
                    >
                        {shown ? 'Hide' : 'Show'}
                    </button>
                </div>
                <Button
                    size="sm"
                    variant="danger"
                    onClick={submit}
                    disabled={form.processing || form.data.token.trim() === ''}
                >
                    {form.processing ? 'Deleting…' : 'Delete for good'}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
            {error && (
                <p className="pl-text-sm text-[var(--pl-danger-lit)]">
                    {error}
                </p>
            )}
        </div>
    );
}
