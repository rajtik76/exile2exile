import { useState } from 'react';
import Button from '@/components/planner/Button';

/**
 * Everything minted once a plan is saved: the public read link (safe to share), the edit
 * page link (lands on the unlock form) and - shown once - the secret edit token. The
 * token never travels in a URL; the author saves it and pastes it into the unlock form to
 * edit again from another browser.
 */
export default function SharePanel({
    publicUrl,
    editUrl,
    editToken,
}: {
    publicUrl: string;
    editUrl: string | null;
    editToken: string | null;
}) {
    return (
        <div
            className="mb-6 flex flex-col gap-3 border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] px-4 py-3"
            style={{ borderRadius: 'var(--pl-radius-lg)' }}
        >
            <CopyRow
                label="Public link"
                value={publicUrl}
                asUrl
                hint="Read-only - safe to share."
            />
            {editUrl && (
                <CopyRow
                    label="Edit link"
                    value={editUrl}
                    asUrl
                    hint="Opens the editor - it asks for your token first."
                />
            )}
            {editToken && (
                <CopyRow
                    label="Edit token"
                    value={editToken}
                    secret
                    hint="Save this now - it's the only key to edit this build. Paste it into the edit page to unlock. Keep it private."
                />
            )}
        </div>
    );
}

/**
 * One labelled, copyable value inside {@link SharePanel}. `asUrl` renders it as a link
 * (absolute-resolved) and copies the full URL; otherwise it's a plain code string.
 */
function CopyRow({
    label,
    value,
    hint,
    asUrl = false,
    secret = false,
}: {
    label: string;
    value: string;
    hint: string;
    asUrl?: boolean;
    secret?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const resolved =
        asUrl && typeof window !== 'undefined'
            ? new URL(value, window.location.origin).toString()
            : value;

    function copy(): void {
        void navigator.clipboard?.writeText(resolved).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        });
    }

    return (
        <div
            className={
                secret
                    ? 'border-2 border-[var(--pl-accent)] bg-[var(--pl-accent-soft)] px-3 py-2.5'
                    : undefined
            }
            style={secret ? { borderRadius: 'var(--pl-radius-lg)' } : undefined}
        >
            <div className="flex flex-wrap items-center gap-3">
                <span
                    className={`pl-text-sm font-semibold ${secret ? 'text-[var(--pl-accent-lit)]' : 'text-[var(--pl-muted)]'}`}
                >
                    {label}
                </span>
                {asUrl ? (
                    <a
                        href={value}
                        className="pl-text-sm min-w-40 flex-1 truncate font-mono text-[var(--pl-text)] hover:text-[var(--pl-accent-lit)]"
                    >
                        {resolved}
                    </a>
                ) : (
                    <code className="pl-text-sm min-w-40 flex-1 truncate font-mono text-[var(--pl-text)]">
                        {resolved}
                    </code>
                )}
                <Button
                    size="sm"
                    variant={secret ? 'primary' : 'ghost'}
                    onClick={copy}
                >
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
            <p className="pl-text-sm mt-1 text-[var(--pl-faint)]">{hint}</p>
        </div>
    );
}
