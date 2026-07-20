import { useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ClearGlyph, INPUT_FONT } from '@/components/passive-tree/chrome';
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
 * Same engraved-bronze chrome as the rest of the tree controls, but a card, not
 * a pill: it holds stacked ledger rows and must breathe on a phone, where the
 * rows wrap label-over-value.
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
        <div className="absolute top-full right-3 left-3 z-30 mt-2 max-h-[calc(100dvh-160px)] overflow-y-auto rounded-xl border border-[#6e5526] bg-gradient-to-b from-[#15100a] to-[#0b0805] opacity-[0.97] shadow-lg shadow-black/45 backdrop-blur-sm sm:left-auto sm:w-[36rem] sm:max-w-[calc(100%-3rem)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#3a2f18] px-4 py-2.5">
                <span className="text-[11px] font-semibold tracking-[0.16em] text-[#b39a64] uppercase">
                    Build links
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close build links"
                    className="grid size-6 shrink-0 place-items-center rounded-full text-[#8a7850] transition-colors hover:bg-[#f0c869]/10 hover:text-[#ecc878] focus-visible:text-[#ecc878] focus-visible:outline-none"
                >
                    <ClearGlyph />
                </button>
            </div>

            <div className="px-4">
                <Row label="Public" divider>
                    <a
                        href={publicUrl}
                        style={INPUT_FONT}
                        className="min-w-0 flex-1 truncate text-sm text-[#f5ecd8] hover:text-[#ffdf9a]"
                    >
                        {publicUrl}
                    </a>
                    <CopyButton text={publicUrl} label="Copy public link" />
                </Row>
                <Row label="Edit" divider>
                    <a
                        href={editUrl}
                        style={INPUT_FONT}
                        className="min-w-0 flex-1 truncate text-sm text-[#f5ecd8] hover:text-[#ffdf9a]"
                    >
                        {editUrl}
                    </a>
                    <CopyButton text={editUrl} label="Copy edit link" />
                </Row>
                <Row label="Token">
                    <TokenValue token={editToken} />
                    <CopyButton
                        text={editToken}
                        label="Copy edit token"
                        emphasis
                    />
                    <p className="w-full text-xs text-[#8a7850]">
                        The only key to edit this build - save it somewhere safe
                        and keep it private.
                    </p>
                </Row>
            </div>

            <div className="border-t border-[#7a2e2e]/50 bg-[#2a1010]/45 px-4 py-2.5">
                {deleting ? (
                    <DeleteConfirm
                        slug={slug}
                        onCancel={() => setDeleting(false)}
                    />
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-[#e09a9a]">
                            Danger zone - deleting is permanent.
                        </p>
                        <PillButton
                            variant="danger"
                            onClick={() => setDeleting(true)}
                        >
                            Delete build
                        </PillButton>
                    </div>
                )}
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
 * One ledger row: an uppercase label and its value + action. On a phone the
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
            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 ${divider ? 'border-b border-[#3a2f18]' : ''}`}
        >
            <span className="w-full shrink-0 text-[10px] font-semibold tracking-[0.16em] text-[#8a7850] uppercase sm:w-16">
                {label}
            </span>
            {children}
        </div>
    );
}

/** A small gold pill action, matching the planner bar's button language. */
function PillButton({
    variant = 'ghost',
    disabled = false,
    onClick,
    children,
    title,
    ariaLabel,
    className = '',
}: {
    variant?: 'ghost' | 'accent' | 'danger';
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
    ariaLabel?: string;
    className?: string;
}) {
    const palette = {
        ghost: 'border-[#a9842f]/35 text-[#b39a64] hover:bg-[#f0c869]/12 hover:text-[#ecc878] focus-visible:bg-[#f0c869]/12',
        accent: 'border-[#a9842f]/55 text-[#ecc878] hover:bg-[#f0c869]/22 hover:text-[#ffdf9a] focus-visible:bg-[#f0c869]/22',
        danger: 'border-[#a34141]/60 text-[#e09a9a] hover:bg-[#c65454]/18 hover:text-[#f3bcbc] focus-visible:bg-[#c65454]/18',
    }[variant];

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={ariaLabel}
            className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors focus-visible:outline-none disabled:border-[#3a2f18] disabled:text-[#5a4d30] disabled:hover:bg-transparent',
                palette,
                className,
            )}
        >
            {children}
        </button>
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
    emphasis = false,
}: {
    text: string;
    /** Accessible name naming WHAT is copied - the visible text stays "Copy". */
    label: string;
    emphasis?: boolean;
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
        <PillButton
            variant={
                state === 'copied' ? 'accent' : emphasis ? 'accent' : 'ghost'
            }
            onClick={copy}
            title="Copy to clipboard"
            ariaLabel={label}
            // Fixed width, "Copy failed" (its longest label) sized with room to
            // spare: the label swaps on click, and a resizing button mid-click
            // reads as layout jitter to a human and as an unstable click target
            // to Playwright, which can then redispatch the click as a retry.
            className="min-w-[6.5rem] text-center"
        >
            {state === 'copied'
                ? 'Copied ✓'
                : state === 'failed'
                  ? 'Copy failed'
                  : 'Copy'}
        </PillButton>
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
            style={INPUT_FONT}
            className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-[#f5ecd8] hover:text-[#ffdf9a]"
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
            className="my-1 flex flex-col gap-2 rounded-lg border border-[#a34141]/70 bg-[#15100a] p-3"
        >
            <p className="text-sm font-semibold text-[#f3bcbc]">
                Delete this build permanently?
            </p>
            <p className="text-sm text-[#cdb784]">
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
                        style={INPUT_FONT}
                        className="w-full rounded-full border border-[#6e5526] bg-[#0b0805] px-3.5 py-1.5 pr-16 text-sm text-[#f5ecd8] outline-none placeholder:text-[#8a7850] focus:border-[#a9842f]"
                    />
                    <button
                        type="button"
                        onClick={() => setShown((value) => !value)}
                        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[10px] font-semibold tracking-[0.14em] text-[#8a7850] uppercase hover:text-[#ecc878]"
                    >
                        {shown ? 'Hide' : 'Show'}
                    </button>
                </div>
                <button
                    type="submit"
                    disabled={form.processing || form.data.token.trim() === ''}
                    className="shrink-0 rounded-full border border-[#a34141]/60 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#e09a9a] uppercase transition-colors hover:bg-[#c65454]/18 hover:text-[#f3bcbc] focus-visible:bg-[#c65454]/18 focus-visible:outline-none disabled:border-[#3a2f18] disabled:text-[#5a4d30] disabled:hover:bg-transparent"
                >
                    {form.processing ? 'Deleting…' : 'Delete for good'}
                </button>
                <PillButton variant="ghost" onClick={onCancel}>
                    Cancel
                </PillButton>
            </div>
            {error && <p className="text-sm text-[#f3bcbc]">{error}</p>}
        </form>
    );
}
