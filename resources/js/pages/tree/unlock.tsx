import { Head, useForm } from '@inertiajs/react';
import { LABEL, Medallion } from '@/components/passive-tree/chrome';
import shared from '@/routes/shared';

/**
 * The gate in front of a saved tree's editor: the build's secret edit token is
 * entered here, in a POST form, and verified server-side - so it never travels
 * in a URL (and its logs, history or referrers). On success the session is
 * unlocked and the editor opens. Wears the working-tier panel of the tree pages.
 */
export default function TreeUnlock({
    slug,
    className,
}: {
    slug: string;
    className: string;
}) {
    const form = useForm({ token: '' });

    function submit(event: React.FormEvent): void {
        event.preventDefault();
        form.post(shared.unlock.url({ sharedTree: slug }), {
            preserveScroll: true,
        });
    }

    return (
        <div className="mx-auto max-w-lg px-4 pt-16 pb-28 font-ui">
            <Head title="Unlock to edit" />

            <header className="mb-6 flex items-center gap-4">
                <Medallion className={className} size={56} />
                <div className="min-w-0">
                    <p className={LABEL}>Passive tree</p>
                    <h1 className="mt-0.5 font-display text-[30px] leading-[1.15] text-paper [word-spacing:-0.1em]">
                        Unlock to edit
                    </h1>
                </div>
            </header>

            <div className="panel p-4 sm:p-5">
                <p className="text-[15px] text-bone">
                    This {className} tree is edit-protected. Paste the edit
                    token you saved when you created it.
                </p>

                <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
                    <input
                        autoFocus
                        type="password"
                        name="token"
                        autoComplete="off"
                        value={form.data.token}
                        onChange={(event) =>
                            form.setData('token', event.target.value)
                        }
                        placeholder="Paste your edit token…"
                        className="input"
                    />

                    {form.errors.token && (
                        <p className="text-sm text-blood-lit">
                            {form.errors.token}
                        </p>
                    )}

                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={
                                form.processing || form.data.token.trim() === ''
                            }
                            className="btn btn-copper"
                        >
                            {form.processing ? 'Unlocking…' : 'Unlock'}
                        </button>
                        <a
                            href={shared.show.url({ sharedTree: slug })}
                            className="link text-sm"
                        >
                            Back to the build
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
